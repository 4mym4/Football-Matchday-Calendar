// Single source of truth for league identity: competition code, display name,
// accent color, and marker shape. Used by both scripts/fetch-fixtures.js (Node)
// and the browser app, so it's plain ESM with no dependencies.
//
// Competition codes match football-data.org's /v4/competitions/{code} resource.
// If football-data.org ever renames a code, update it here only.

export const LEAGUES = {
  PL: {
    code: 'PL',
    name: 'Premier League',
    shortName: 'Premier League',
    color: '#A56EFF',
    shape: 'circle',
  },
  PD: {
    code: 'PD',
    name: 'La Liga',
    shortName: 'La Liga',
    color: '#FF7A45',
    shape: 'diamond',
  },
  BL1: {
    code: 'BL1',
    name: 'Bundesliga',
    shortName: 'Bundesliga',
    color: '#E4463D',
    shape: 'square',
  },
  SA: {
    code: 'SA',
    name: 'Serie A',
    shortName: 'Serie A',
    color: '#2FD9C4',
    shape: 'triangle',
  },
  FL1: {
    code: 'FL1',
    name: 'Ligue 1',
    shortName: 'Ligue 1',
    color: '#4C8DFF',
    shape: 'hexagon',
  },
  CL: {
    code: 'CL',
    name: 'UEFA Champions League',
    shortName: 'Champions League',
    color: '#E8C34C',
    shape: 'star',
  },
};

// Ordered list (used for dropdown + legend display order)
export const LEAGUE_ORDER = ['PL', 'PD', 'CL', 'BL1', 'SA', 'FL1'];

export function getLeague(code) {
  return LEAGUES[code] || null;
}
