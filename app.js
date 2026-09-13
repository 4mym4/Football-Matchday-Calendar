import { LEAGUES, LEAGUE_ORDER, getLeague } from './leagueMeta.js';
import {
  getDefaultTimezone,
  getAllTimezones,
  getOffsetLabel,
  getDateKeyInTimezone,
  formatMatchTime,
  getTodayKeyInTimezone,
  formatDateHeadline,
} from './timezone.js';
import { shapeMarkup } from './shapes.js';
import { renderCalendar } from './calendar.js';

const FIXTURES_URL = './data/fixtures.json';
const NON_FINAL_STATUS_TAGS = ['POSTPONED', 'CANCELLED', 'SUSPENDED'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const state = {
  timezone: getDefaultTimezone(),
  selectedLeagues: new Set(LEAGUE_ORDER),
  allMatches: [], // raw matches enriched with league metadata
  viewYear: null,
  viewMonth: null, // 1-indexed
  selectedDateKey: null,
  dataMeta: null,
};

const el = {
  tzSelect: document.getElementById('timezone-select'),
  leagueToggle: document.getElementById('league-toggle'),
  leagueToggleText: document.getElementById('league-toggle-text'),
  leaguePanel: document.getElementById('league-panel'),
  matchPanel: document.getElementById('match-panel'),
  calendarContainer: document.getElementById('calendar-container'),
  monthLabel: document.getElementById('month-label'),
  prevMonthBtn: document.getElementById('prev-month'),
  nextMonthBtn: document.getElementById('next-month'),
  todayBtn: document.getElementById('today-btn'),
  footer: document.getElementById('app-footer'),
};

init();

async function init() {
  const todayKey = getTodayKeyInTimezone(state.timezone);
  const [y, m] = todayKey.split('-').map(Number);
  state.viewYear = y;
  state.viewMonth = m;
  state.selectedDateKey = todayKey;

  populateTimezoneSelect();
  populateLeaguePanel();
  wireStaticEvents();

  await loadFixtures();
  renderAll();
}

async function loadFixtures() {
  try {
    const res = await fetch(FIXTURES_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.allMatches = (data.matches || []).map(enrichMatch).filter(Boolean);
    state.dataMeta = {
      generatedAt: data.generatedAt || null,
      leaguesFailed: data.leaguesFailed || [],
    };
  } catch (err) {
    console.error('Failed to load fixtures.json', err);
    state.allMatches = [];
    state.dataMeta = { error: true };
  }
}

function enrichMatch(raw) {
  const league = getLeague(raw.competition);
  if (!league) return null;
  return { ...raw, leagueName: league.shortName, color: league.color, shape: league.shape };
}

// ---------------------------------------------------------------
// Control population
// ---------------------------------------------------------------
function populateTimezoneSelect() {
  const zones = getAllTimezones();
  el.tzSelect.innerHTML = '';

  zones.forEach(({ zone, label }) => {
    const opt = document.createElement('option');
    opt.value = zone;
    opt.textContent = `${zone.replace(/_/g, ' ')} (${label})`;
    el.tzSelect.appendChild(opt);
  });

  el.tzSelect.value = state.timezone;

  // If the browser's resolved local zone is an alias not present in
  // Intl.supportedValuesOf('timeZone'), <select>.value silently fails to
  // match any option. Add it explicitly so the dropdown still reflects
  // the visitor's real timezone.
  if (el.tzSelect.value !== state.timezone) {
    const fallbackOption = document.createElement('option');
    fallbackOption.value = state.timezone;
    fallbackOption.textContent = `${state.timezone.replace(/_/g, ' ')} (${getOffsetLabel(state.timezone)})`;
    el.tzSelect.prepend(fallbackOption);
    el.tzSelect.value = state.timezone;
  }
}

function populateLeaguePanel() {
  el.leaguePanel.innerHTML = '';

  const actions = document.createElement('div');
  actions.className = 'league-panel-actions';

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.textContent = 'Select all';
  allBtn.addEventListener('click', () => {
    state.selectedLeagues = new Set(LEAGUE_ORDER);
    syncLeagueCheckboxes();
    onFilterChanged();
  });

  const noneBtn = document.createElement('button');
  noneBtn.type = 'button';
  noneBtn.textContent = 'Clear';
  noneBtn.addEventListener('click', () => {
    state.selectedLeagues = new Set();
    syncLeagueCheckboxes();
    onFilterChanged();
  });

  actions.append(allBtn, noneBtn);
  el.leaguePanel.appendChild(actions);

  LEAGUE_ORDER.forEach((code) => {
    const league = LEAGUES[code];

    const label = document.createElement('label');
    label.className = 'league-option';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = code;
    checkbox.checked = state.selectedLeagues.has(code);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.selectedLeagues.add(code);
      else state.selectedLeagues.delete(code);
      onFilterChanged();
    });

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.innerHTML = shapeMarkup(league.shape, league.color, 14);

    const text = document.createElement('span');
    text.textContent = league.name;

    label.append(checkbox, swatch, text);
    el.leaguePanel.appendChild(label);
  });
}

function syncLeagueCheckboxes() {
  el.leaguePanel.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.checked = state.selectedLeagues.has(cb.value);
  });
}

// ---------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------
function wireStaticEvents() {
  el.tzSelect.addEventListener('change', () => {
    state.timezone = el.tzSelect.value;
    // The selected calendar date stays put; only which matches land on it
    // (and which cell counts as "today") can shift with the new timezone.
    renderAll();
  });

  el.leagueToggle.addEventListener('click', () => {
    setLeaguePanelOpen(el.leaguePanel.hidden);
  });

  document.addEventListener('click', (e) => {
    const clickedInsidePanel = el.leaguePanel.contains(e.target);
    const clickedToggle = el.leagueToggle.contains(e.target);
    if (!el.leaguePanel.hidden && !clickedInsidePanel && !clickedToggle) {
      setLeaguePanelOpen(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.leaguePanel.hidden) {
      setLeaguePanelOpen(false);
      el.leagueToggle.focus();
    }
  });

  el.prevMonthBtn.addEventListener('click', () => shiftMonth(-1));
  el.nextMonthBtn.addEventListener('click', () => shiftMonth(1));

  el.todayBtn.addEventListener('click', () => {
    const todayKey = getTodayKeyInTimezone(state.timezone);
    const [y, m] = todayKey.split('-').map(Number);
    state.viewYear = y;
    state.viewMonth = m;
    state.selectedDateKey = todayKey;
    renderAll();
  });
}

function setLeaguePanelOpen(open) {
  el.leaguePanel.hidden = !open;
  el.leagueToggle.setAttribute('aria-expanded', String(open));
}

function shiftMonth(delta) {
  let m = state.viewMonth + delta;
  let y = state.viewYear;
  if (m > 12) { m = 1; y += 1; }
  if (m < 1) { m = 12; y -= 1; }
  state.viewMonth = m;
  state.viewYear = y;
  // Only the calendar view moves; the match panel keeps showing whichever
  // date was last selected until the user taps a new day.
  renderCalendarSection();
}

function onFilterChanged() {
  updateLeagueToggleLabel();
  renderAll();
}

function updateLeagueToggleLabel() {
  const n = state.selectedLeagues.size;
  if (n === LEAGUE_ORDER.length) {
    el.leagueToggleText.textContent = 'All leagues';
  } else if (n === 0) {
    el.leagueToggleText.textContent = 'No leagues';
  } else if (n <= 2) {
    el.leagueToggleText.textContent = LEAGUE_ORDER
      .filter((c) => state.selectedLeagues.has(c))
      .map((c) => LEAGUES[c].shortName)
      .join(', ');
  } else {
    el.leagueToggleText.textContent = `${n} leagues`;
  }
}

// ---------------------------------------------------------------
// Derived data
// ---------------------------------------------------------------
function computeMatchesByDate() {
  const map = new Map();
  state.allMatches
    .filter((m) => state.selectedLeagues.has(m.competition))
    .forEach((m) => {
      const key = getDateKeyInTimezone(m.utcDate, state.timezone);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    });
  map.forEach((list) => list.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate)));
  return map;
}

// ---------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------
function renderAll() {
  const matchesByDate = computeMatchesByDate();
  renderMatchPanel(matchesByDate);
  renderCalendarSection(matchesByDate);
  renderFooter();
}

function renderMatchPanel(matchesByDate) {
  const map = matchesByDate || computeMatchesByDate();
  const matches = map.get(state.selectedDateKey) || [];

  el.matchPanel.innerHTML = '';

  const heading = document.createElement('h2');
  heading.className = 'match-panel-date';
  heading.textContent = formatDateHeadline(state.selectedDateKey);
  el.matchPanel.appendChild(heading);

  if (matches.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'match-panel-empty';
    empty.textContent = state.selectedLeagues.size === 0
      ? 'No leagues selected.'
      : 'No matches on this date for the selected leagues.';
    el.matchPanel.appendChild(empty);
    return;
  }

  matches.forEach((m) => {
    el.matchPanel.appendChild(buildMatchRow(m));
  });
}

function buildMatchRow(m) {
  const row = document.createElement('div');
  row.className = 'match-row';

  const swatch = document.createElement('span');
  swatch.className = 'swatch';
  swatch.innerHTML = shapeMarkup(m.shape, m.color, 14);

  const teams = document.createElement('div');
  teams.className = 'teams';

  const matchup = document.createElement('span');
  matchup.className = 'matchup';
  const homeSpan = document.createElement('span');
  homeSpan.textContent = m.homeTeam;
  const vsSpan = document.createElement('span');
  vsSpan.className = 'vs';
  vsSpan.textContent = ' vs ';
  const awaySpan = document.createElement('span');
  awaySpan.textContent = m.awayTeam;
  matchup.append(homeSpan, vsSpan, awaySpan);

  const leagueName = document.createElement('span');
  leagueName.className = 'league-name';
  leagueName.textContent = m.leagueName;

  teams.append(matchup, leagueName);

  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = formatMatchTime(m.utcDate, state.timezone);

  if (NON_FINAL_STATUS_TAGS.includes(m.status)) {
    const tag = document.createElement('span');
    tag.className = 'status-tag';
    tag.textContent = m.status.charAt(0) + m.status.slice(1).toLowerCase();
    time.appendChild(document.createElement('br'));
    time.appendChild(tag);
  }

  row.append(swatch, teams, time);
  return row;
}

function renderCalendarSection(matchesByDate) {
  const map = matchesByDate || computeMatchesByDate();
  el.monthLabel.textContent = `${MONTH_NAMES[state.viewMonth - 1]} ${state.viewYear}`;

  renderCalendar({
    container: el.calendarContainer,
    year: state.viewYear,
    month: state.viewMonth,
    selectedDateKey: state.selectedDateKey,
    todayKey: getTodayKeyInTimezone(state.timezone),
    matchesByDate: map,
    onSelectDate: (dateKey) => {
      state.selectedDateKey = dateKey;
      const [y, m] = dateKey.split('-').map(Number);
      // Tapping a padding cell from an adjacent month follows it there.
      if (y !== state.viewYear || m !== state.viewMonth) {
        state.viewYear = y;
        state.viewMonth = m;
      }
      renderAll();
    },
  });
}

function renderFooter() {
  if (!state.dataMeta) {
    el.footer.textContent = '';
    return;
  }
  if (state.dataMeta.error) {
    el.footer.textContent = "Couldn't load fixture data. Try refreshing the page.";
    return;
  }
  const updated = state.dataMeta.generatedAt ? new Date(state.dataMeta.generatedAt) : null;
  let text = updated
    ? `Fixtures updated ${updated.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
    : '';
  if (state.dataMeta.leaguesFailed && state.dataMeta.leaguesFailed.length > 0) {
    text += ` — note: ${state.dataMeta.leaguesFailed.join(', ')} didn't refresh in the last sync.`;
  }
  el.footer.textContent = text;
}
