// Generates a realistic-looking data/fixtures.json so the site renders
// something sensible before the first real API sync runs.
//
// Usage: node scripts/generate-seed-data.js
//
// This is placeholder data, NOT real fixtures. The nightly workflow
// overwrites it with live data from football-data.org on its first run.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'fixtures.json');

const TEAMS = {
  PL: ['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea', 'Tottenham Hotspur', 'Newcastle United', 'Aston Villa', 'Brighton & Hove Albion'],
  PD: ['Real Madrid', 'FC Barcelona', 'Atlético Madrid', 'Athletic Club', 'Real Sociedad', 'Villarreal', 'Real Betis', 'Valencia'],
  BL1: ['Bayern München', 'Bayer Leverkusen', 'Borussia Dortmund', 'RB Leipzig', 'VfB Stuttgart', 'Eintracht Frankfurt'],
  SA: ['Inter', 'AC Milan', 'Juventus', 'Napoli', 'AS Roma', 'Atalanta'],
  FL1: ['Paris Saint-Germain', 'Olympique de Marseille', 'AS Monaco', 'Lille', 'Olympique Lyonnais', 'Nice'],
  CL: ['Real Madrid', 'Bayern München', 'Manchester City', 'Inter', 'Paris Saint-Germain', 'Arsenal', 'FC Barcelona', 'Liverpool'],
};

// Typical kickoff slots (UTC hours) per competition.
const KICKOFF_SLOTS = {
  PL: [11.5, 14, 16.5],
  PD: [13, 15.25, 17.5, 20],
  BL1: [13.5, 16.5],
  SA: [13, 16, 18.75],
  FL1: [15, 19],
  CL: [17, 20],
};

// Which weekdays each competition typically plays (0 = Sunday).
const MATCH_DAYS = {
  PL: [6, 0],
  PD: [6, 0],
  BL1: [6, 0],
  SA: [6, 0],
  FL1: [6, 0],
  CL: [2, 3],
};

function pickPairs(teams, count) {
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const pairs = [];
  for (let i = 0; i + 1 < shuffled.length && pairs.length < count; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }
  return pairs;
}

function main() {
  const now = new Date();
  const start = new Date(now.getTime() - 7 * 86400000);
  const end = new Date(now.getTime() + 60 * 86400000);

  const matches = [];
  let idCounter = 900000;

  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
    const weekday = d.getUTCDay();

    for (const [code, days] of Object.entries(MATCH_DAYS)) {
      if (!days.includes(weekday)) continue;

      // Champions League only plays on some midweeks, not every week.
      if (code === 'CL' && Math.random() > 0.45) continue;

      const slots = KICKOFF_SLOTS[code];
      const matchCount = code === 'CL' ? 4 : 3;
      const pairs = pickPairs(TEAMS[code], matchCount);

      pairs.forEach(([home, away], i) => {
        const slot = slots[i % slots.length];
        const hours = Math.floor(slot);
        const minutes = Math.round((slot - hours) * 60);
        const kickoff = new Date(Date.UTC(
          d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hours, minutes, 0
        ));

        matches.push({
          id: idCounter++,
          competition: code,
          utcDate: kickoff.toISOString(),
          status: kickoff < now ? 'FINISHED' : 'SCHEDULED',
          matchday: null,
          stage: code === 'CL' ? 'LEAGUE_STAGE' : 'REGULAR_SEASON',
          homeTeam: home,
          awayTeam: away,
          venue: null,
        });
      });
    }
  }

  matches.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

  const output = {
    generatedAt: now.toISOString(),
    windowStart: start.toISOString().slice(0, 10),
    windowEnd: end.toISOString().slice(0, 10),
    leaguesRequested: Object.keys(TEAMS),
    leaguesFailed: [],
    isPlaceholderData: true,
    matches,
  };

  return mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
    .then(() => writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8'))
    .then(() => console.log(`Wrote ${matches.length} placeholder matches to ${OUTPUT_PATH}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
