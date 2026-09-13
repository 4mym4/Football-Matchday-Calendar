import { shapeMarkup } from './shapes.js';
import { dateKeyFromParts } from './timezone.js';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_MARKERS_PER_DAY = 3;

function daysInMonth(year, month) {
  // month is 1-indexed here; day 0 of next month = last day of this month
  return new Date(year, month, 0).getDate();
}

/**
 * Renders a month calendar grid into `container`.
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.container
 * @param {number} opts.year
 * @param {number} opts.month - 1-indexed (1 = January)
 * @param {string} opts.selectedDateKey - 'YYYY-MM-DD'
 * @param {string} opts.todayKey - 'YYYY-MM-DD'
 * @param {Map<string, Array>} opts.matchesByDate - date key -> matches on that day (already league-filtered)
 * @param {(dateKey: string) => void} opts.onSelectDate
 */
export function renderCalendar({ container, year, month, selectedDateKey, todayKey, matchesByDate, onSelectDate }) {
  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'calendar-grid';

  WEEKDAY_LABELS.forEach((label) => {
    const head = document.createElement('div');
    head.className = 'calendar-weekday';
    head.textContent = label;
    grid.appendChild(head);
  });

  const firstOfMonth = new Date(year, month - 1, 1);
  const startOffset = firstOfMonth.getDay(); // 0 = Sunday
  const totalDays = daysInMonth(year, month);

  // Leading padding cells from the previous month
  const prevMonthDays = daysInMonth(year, month - 1 < 1 ? 12 : month - 1);
  const prevMonthYear = month - 1 < 1 ? year - 1 : year;
  const prevMonth = month - 1 < 1 ? 12 : month - 1;
  for (let i = 0; i < startOffset; i++) {
    const dayNum = prevMonthDays - startOffset + i + 1;
    grid.appendChild(
      buildDayCell({
        dateKey: dateKeyFromParts(prevMonthYear, prevMonth, dayNum),
        dayNum,
        muted: true,
        selectedDateKey,
        todayKey,
        matchesByDate,
        onSelectDate,
      })
    );
  }

  for (let day = 1; day <= totalDays; day++) {
    grid.appendChild(
      buildDayCell({
        dateKey: dateKeyFromParts(year, month, day),
        dayNum: day,
        muted: false,
        selectedDateKey,
        todayKey,
        matchesByDate,
        onSelectDate,
      })
    );
  }

  // Trailing padding cells to complete the final week row
  const totalCellsSoFar = startOffset + totalDays;
  const trailingCount = (7 - (totalCellsSoFar % 7)) % 7;
  const nextMonthYear = month + 1 > 12 ? year + 1 : year;
  const nextMonth = month + 1 > 12 ? 1 : month + 1;
  for (let i = 1; i <= trailingCount; i++) {
    grid.appendChild(
      buildDayCell({
        dateKey: dateKeyFromParts(nextMonthYear, nextMonth, i),
        dayNum: i,
        muted: true,
        selectedDateKey,
        todayKey,
        matchesByDate,
        onSelectDate,
      })
    );
  }

  container.appendChild(grid);
}

function buildDayCell({ dateKey, dayNum, muted, selectedDateKey, todayKey, matchesByDate, onSelectDate }) {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'day-cell';
  cell.dataset.date = dateKey;
  if (muted) cell.classList.add('is-muted');
  if (dateKey === todayKey) cell.classList.add('is-today');
  if (dateKey === selectedDateKey) cell.classList.add('is-selected');

  const numberEl = document.createElement('span');
  numberEl.className = 'day-number';
  numberEl.textContent = String(dayNum);
  cell.appendChild(numberEl);

  const matches = matchesByDate.get(dateKey) || [];
  if (matches.length > 0) {
    const markers = document.createElement('span');
    markers.className = 'day-markers';

    const visibleCount = matches.length > MAX_MARKERS_PER_DAY ? MAX_MARKERS_PER_DAY - 1 : matches.length;
    for (let i = 0; i < visibleCount; i++) {
      const m = matches[i];
      markers.insertAdjacentHTML('beforeend', shapeMarkup(m.shape, m.color, 9));
    }
    if (matches.length > MAX_MARKERS_PER_DAY) {
      const more = document.createElement('span');
      more.className = 'day-markers-more';
      more.textContent = `+${matches.length - visibleCount}`;
      markers.appendChild(more);
    }
    cell.appendChild(markers);

    cell.setAttribute(
      'aria-label',
      `${dateKey}, ${matches.length} match${matches.length === 1 ? '' : 'es'}`
    );
  } else {
    cell.setAttribute('aria-label', dateKey);
  }

  cell.addEventListener('click', () => onSelectDate(dateKey));

  return cell;
}
