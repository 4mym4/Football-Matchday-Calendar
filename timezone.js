// Timezone helpers. Two kinds of operations here, and they must not be mixed:
//
// 1. "Instant" operations — a match's utcDate is a real instant in time, so
//    converting it to a viewer's timezone can shift it onto a different
//    calendar date. Use getDateKeyInTimezone / formatMatchTime for these.
// 2. "Calendar" operations — the calendar grid itself (which weekday does
//    Sept 15 fall on, what's the headline for the selected date) is pure
//    date arithmetic with no instant involved. Use formatDateHeadline for
//    these; it deliberately ignores timezone.

const FALLBACK_ZONES = [
  'UTC', 'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles',
  'America/Denver', 'America/Chicago', 'America/New_York', 'America/Sao_Paulo',
  'Atlantic/Reykjavik', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Europe/Madrid', 'Europe/Rome', 'Europe/Athens', 'Europe/Moscow',
  'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka',
  'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney',
  'Pacific/Auckland',
];

export function getDefaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function getOffsetMinutes(timeZone, date) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    }).formatToParts(date);
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT';
    const match = tzPart.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
    if (!match) return 0;
    const sign = match[1] === '-' ? -1 : 1;
    const hours = parseInt(match[2], 10);
    const minutes = match[3] ? parseInt(match[3], 10) : 0;
    return sign * (hours * 60 + minutes);
  } catch {
    return 0;
  }
}

export function getOffsetLabel(timeZone, date = new Date()) {
  const totalMinutes = getOffsetMinutes(timeZone, date);
  const sign = totalMinutes < 0 ? '-' : '+';
  const abs = Math.abs(totalMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${hh}:${mm}`;
}

// Returns [{ zone, label, offsetMinutes }], sorted by current UTC offset
// then alphabetically, for a friendly dropdown ordering.
export function getAllTimezones() {
  let zones;
  try {
    zones = typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : FALLBACK_ZONES;
  } catch {
    zones = FALLBACK_ZONES;
  }

  const now = new Date();
  const withOffsets = zones.map((zone) => ({
    zone,
    offsetMinutes: getOffsetMinutes(zone, now),
    label: getOffsetLabel(zone, now),
  }));

  withOffsets.sort((a, b) => {
    if (a.offsetMinutes !== b.offsetMinutes) return a.offsetMinutes - b.offsetMinutes;
    return a.zone.localeCompare(b.zone);
  });

  return withOffsets;
}

// The calendar-day key (YYYY-MM-DD) that a given instant falls on, as seen
// from timeZone. This is what determines which day cell a match belongs in.
export function getDateKeyInTimezone(utcDateString, timeZone) {
  const d = new Date(utcDateString);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

// Kickoff time formatted in the viewer's chosen timezone, e.g. "3:00 PM".
export function formatMatchTime(utcDateString, timeZone) {
  const d = new Date(utcDateString);
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(d);
}

// Today's date key in a given timezone.
export function getTodayKeyInTimezone(timeZone) {
  return getDateKeyInTimezone(new Date().toISOString(), timeZone);
}

// Pure calendar-date headline for a YYYY-MM-DD key. Deliberately does NOT
// take a timezone: the key already represents "the calendar date", so this
// is just weekday/month/day arithmetic, not an instant-in-time conversion.
export function formatDateHeadline(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const localDate = new Date(y, m - 1, d);
  return localDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function dateKeyFromParts(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
