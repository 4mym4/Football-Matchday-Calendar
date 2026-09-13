// Pulls upcoming + recent fixtures for each configured league from
// football-data.org and writes them to data/fixtures.json.
//
// Requires: Node 18+ (uses the built-in fetch, no npm install needed).
// Reads the API key from the FOOTBALL_DATA_API_KEY environment variable.
//
// Usage: node scripts/fetch-fixtures.js

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { LEAGUE_ORDER, LEAGUES } from '../leagueMeta.js';

const API_BASE = 'https://api.football-data.org/v4';
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;

// How wide a window to pull, in days relative to today.
const DAYS_BACK = 7;
const DAYS_FORWARD = 60;

// Baseline gap between requests. The real throttling is driven by the
// response headers below; this is just a floor so we never burst.
const REQUEST_DELAY_MS = 2000;

// football-data.org reports remaining quota on every response:
//   X-Requests-Available-Minute — requests left in the current window
//   X-RequestCounter-Reset      — seconds until that window resets
// Reading these is more reliable than guessing a fixed delay, and it's what
// the API author explicitly asks clients to do.
const HEADER_AVAILABLE = 'x-requests-available-minute';
const HEADER_RESET = 'x-requestcounter-reset';

// Wait this much longer than the reported reset, to absorb clock skew.
const RESET_SAFETY_SECONDS = 5;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'fixtures.json');

function toISODate(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readQuota(res) {
  const availableRaw = res.headers?.get?.(HEADER_AVAILABLE);
  const resetRaw = res.headers?.get?.(HEADER_RESET);
  const available = availableRaw == null ? null : Number.parseInt(availableRaw, 10);
  const reset = resetRaw == null ? null : Number.parseInt(resetRaw, 10);
  return {
    available: Number.isFinite(available) ? available : null,
    reset: Number.isFinite(reset) ? reset : null,
  };
}

// Fetches one competition. Returns { matches, quota } so the caller can pace
// the next request based on what the server just told us.
async function fetchLeagueMatches(code, dateFrom, dateTo) {
  const url = `${API_BASE}/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': API_KEY },
  });

  const quota = readQuota(res);

  // If we're throttled anyway, wait out the window and retry once rather
  // than dropping the league from this run.
  if (res.status === 429) {
    const waitSeconds = (quota.reset ?? 60) + RESET_SAFETY_SECONDS;
    console.log(`  ${code}: rate limited, waiting ${waitSeconds}s then retrying once`);
    await sleep(waitSeconds * 1000);

    const retry = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } });
    if (!retry.ok) {
      const body = await retry.text().catch(() => '');
      throw new Error(
        `${code}: retry failed with status ${retry.status} ${retry.statusText}. Body: ${body.slice(0, 300)}`
      );
    }
    const retryData = await retry.json();
    return {
      matches: Array.isArray(retryData.matches) ? retryData.matches : [],
      quota: readQuota(retry),
    };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `${code}: request failed with status ${res.status} ${res.statusText}. Body: ${body.slice(0, 300)}`
    );
  }

  const data = await res.json();
  return {
    matches: Array.isArray(data.matches) ? data.matches : [],
    quota,
  };
}

function normalizeMatch(raw, leagueCode) {
  return {
    id: raw.id,
    competition: leagueCode,
    utcDate: raw.utcDate,
    status: raw.status,
    matchday: raw.matchday ?? null,
    stage: raw.stage ?? null,
    homeTeam: raw.homeTeam?.name ?? raw.homeTeam?.shortName ?? 'TBD',
    awayTeam: raw.awayTeam?.name ?? raw.awayTeam?.shortName ?? 'TBD',
    venue: raw.venue ?? null,
  };
}

async function main() {
  if (!API_KEY) {
    console.error(
      'Missing FOOTBALL_DATA_API_KEY environment variable. ' +
        'Set it as a GitHub Actions secret named FOOTBALL_DATA_API_KEY.'
    );
    process.exit(1);
  }

  const now = new Date();
  const dateFrom = toISODate(new Date(now.getTime() - DAYS_BACK * 86400000));
  const dateTo = toISODate(new Date(now.getTime() + DAYS_FORWARD * 86400000));

  console.log(`Fetching fixtures from ${dateFrom} to ${dateTo} for: ${LEAGUE_ORDER.join(', ')}`);

  const allMatches = [];
  const errors = [];
  let lastQuota = { available: null, reset: null };

  for (let i = 0; i < LEAGUE_ORDER.length; i++) {
    const code = LEAGUE_ORDER[i];
    const leagueName = LEAGUES[code].name;
    try {
      const { matches: rawMatches, quota } = await fetchLeagueMatches(code, dateFrom, dateTo);
      lastQuota = quota;
      const normalized = rawMatches.map((m) => normalizeMatch(m, code));
      allMatches.push(...normalized);

      const quotaNote = quota.available == null ? '' : ` (${quota.available} requests left this minute)`;
      console.log(`  ${leagueName} (${code}): ${normalized.length} matches${quotaNote}`);
    } catch (err) {
      console.error(`  ${leagueName} (${code}): FAILED — ${err.message}`);
      errors.push({ code, message: err.message });
    }

    if (i < LEAGUE_ORDER.length - 1) {
      // If the server says we've used up the window, wait for it to reset.
      // Otherwise just keep a steady baseline pace.
      if (lastQuota.available !== null && lastQuota.available <= 1) {
        const waitSeconds = (lastQuota.reset ?? 60) + RESET_SAFETY_SECONDS;
        console.log(`  quota exhausted, pausing ${waitSeconds}s for the window to reset`);
        await sleep(waitSeconds * 1000);
      } else {
        await sleep(REQUEST_DELAY_MS);
      }
    }
  }

  if (allMatches.length === 0 && errors.length > 0) {
    console.error('All league fetches failed. Not overwriting existing data/fixtures.json.');
    process.exit(1);
  }

  allMatches.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

  const output = {
    generatedAt: now.toISOString(),
    windowStart: dateFrom,
    windowEnd: dateTo,
    leaguesRequested: LEAGUE_ORDER,
    leaguesFailed: errors.map((e) => e.code),
    matches: allMatches,
  };

  // data/ won't exist on a fresh clone if it's empty (git doesn't track empty
  // directories), so make sure it's there before writing.
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8');
  console.log(`Wrote ${allMatches.length} matches to ${OUTPUT_PATH}`);

  if (errors.length > 0) {
    console.warn(
      `Completed with ${errors.length} league(s) failing: ${errors.map((e) => e.code).join(', ')}. ` +
        'Other leagues were still updated.'
    );
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
