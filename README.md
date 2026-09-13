# Match Calendar

A fixtures calendar for Europe's top leagues — Premier League, La Liga, Serie A, Bundesliga, Ligue 1, and the Champions League — shown in whichever time zone you pick.

Runs entirely on free infrastructure: a nightly GitHub Actions job pulls fixtures from [football-data.org](https://www.football-data.org) into a JSON file, and GitHub Pages serves the static site that reads it. No server, no database, no hosting bill.

## How it works

```
  Nightly (03:15 UTC)
  GitHub Actions ──► football-data.org API ──► data/fixtures.json ──► commit
                                                       │
                                     GitHub Pages ─────┴──► your browser
```

The API key lives in GitHub Actions secrets and is only ever used inside the workflow runner. It never reaches the browser, because the browser only ever reads the committed JSON file.

## Setup

### 1. Get a football-data.org API key

1. Register at <https://www.football-data.org/client/register>.
2. Confirm your email; the token appears in your account page.
3. Keep it handy for step 3. Don't paste it into any file in the repo.

The free tier covers all six competitions this app uses, at 10 requests per minute. This app makes 6 requests per night, so you have enormous headroom.

**Verify your email address** using the link in the registration email. Unverified accounts are deleted after a period of inactivity, which would silently break the nightly sync.

The fetch script reads the `X-Requests-Available-Minute` and `X-RequestCounter-Reset` response headers and paces itself accordingly, pausing for the window to reset if quota runs low and retrying once if throttled. This is what football-data.org asks clients to do instead of guessing at fixed delays.

### 2. Create the repository

Create a new **public** repository on GitHub (Pages requires public on free accounts), then push these files to it:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

### 3. Add your API key as a secret

In your repository on GitHub:

1. **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name it exactly `FOOTBALL_DATA_API_KEY`
4. Paste your token as the value, then **Add secret**

The name must match exactly — the workflow looks for that specific name.

### 4. Turn on GitHub Pages

1. **Settings** → **Pages**
2. Under **Source**, choose **GitHub Actions**

That's all; the included deploy workflow handles the rest. Your site will be at `https://YOUR-USERNAME.github.io/YOUR-REPO/`.

### 5. Run the first data fetch

The nightly schedule won't have fired yet, so trigger it once by hand:

1. Go to the **Actions** tab
2. Select **Update fixtures** in the left sidebar
3. Click **Run workflow** → **Run workflow**

When it finishes, `data/fixtures.json` holds real fixtures and the site shows them. Until then it displays placeholder data.

## Using it

- **Time zone** — pick any zone; all kickoff times convert, and matches move to a different calendar day when the conversion crosses midnight.
- **Leagues** — tick as many as you like. Each has both a colour and a shape, so the calendar stays readable without relying on colour vision.
- **Calendar** — coloured markers show which leagues play each day. Busy days show two markers plus a `+N` count. Tap any day to see its full fixture list at the top.

## Project layout

```
├── index.html                     Page structure
├── style.css                      All styling
├── app.js                         State, filtering, rendering
├── calendar.js                    Month grid + day markers
├── timezone.js                    Time zone conversion + date keys
├── shapes.js                      SVG league markers
├── leagueMeta.js                  League colours, shapes, API codes
├── data/fixtures.json             Fixture data (rewritten nightly)
├── scripts/
│   ├── fetch-fixtures.js          Pulls from football-data.org
│   └── generate-seed-data.js      Placeholder data generator
└── .github/workflows/
    ├── update-fixtures.yml        Nightly fetch + commit
    └── deploy-pages.yml           Publish to GitHub Pages
```

No build step and no dependencies. The scripts need Node 18+ for its built-in `fetch`; the workflow pins Node 20.

## Running locally

ES modules need a real HTTP server — opening `index.html` from the file system will fail on CORS.

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

To refresh fixtures locally:

```bash
FOOTBALL_DATA_API_KEY=your_token_here node scripts/fetch-fixtures.js
```

## Changing things

**Adjust which leagues appear** — edit `LEAGUE_ORDER` in `leagueMeta.js`. Every league in it needs a matching entry in `LEAGUES` with a unique colour and shape. Codes must match football-data.org's (`PL`, `PD`, `BL1`, `SA`, `FL1`, `CL`); check <https://www.football-data.org/coverage> before adding anything outside the free tier.

**Change the fetch window** — `DAYS_BACK` and `DAYS_FORWARD` at the top of `scripts/fetch-fixtures.js`.

**Change the sync time** — the `cron` line in `.github/workflows/update-fixtures.yml`, in UTC.

**Change how many markers fit in a day cell** — `MAX_MARKERS_PER_DAY` in `calendar.js`.

## Troubleshooting

**Workflow fails with a 403** — the API key is missing or wrong. Check the secret is named `FOOTBALL_DATA_API_KEY` and the token is current.

**Workflow fails on `git push`** — Settings → Actions → General → Workflow permissions, set to **Read and write permissions**.

**Site shows placeholder fixtures** — the fetch workflow hasn't succeeded yet. Run it manually (step 5) and check the Actions log.

**A league is missing after a sync** — the footer names any league that failed to refresh. One league failing doesn't block the others; the next night's run retries. If it persists, that competition may have moved off the free tier.

**Scheduled runs are late or skipped** — GitHub delays scheduled workflows on shared runners under load, and pauses them entirely on repositories with no activity for 60 days. A manual run re-activates them.

## Notes and limits

- Fixture data on the free tier is slightly delayed and covers the current season only. That's fine for a schedule, but this is not a live-score app.
- Fixtures move. The nightly sync rewrites the whole window each run, so postponements and reschedules are picked up on the next run rather than instantly.
- Data from football-data.org, maintained by Daniel Freitag. Please respect the free tier's rate limits if you fork this.
