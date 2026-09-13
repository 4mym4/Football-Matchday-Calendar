// Generates small SVG marker icons for each league shape. Shape carries the
// league identity alongside color, so filtering by league is never
// color-only (colorblind-safe by construction, not as an afterthought).

function regularPolygonPoints(cx, cy, radius, sides, rotationDeg = -90) {
  const points = [];
  const step = (2 * Math.PI) / sides;
  const rotation = (rotationDeg * Math.PI) / 180;
  for (let i = 0; i < sides; i++) {
    const angle = rotation + i * step;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(' ');
}

function starPoints(cx, cy, outerRadius, innerRadius, spikes = 5, rotationDeg = -90) {
  const points = [];
  const step = Math.PI / spikes;
  const rotation = (rotationDeg * Math.PI) / 180;
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = rotation + i * step;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(' ');
}

const SHAPE_BUILDERS = {
  circle: () => `<circle cx="12" cy="12" r="8.5" />`,
  square: () => `<rect x="4" y="4" width="16" height="16" rx="2.5" />`,
  diamond: () => `<polygon points="${regularPolygonPoints(12, 12, 10, 4, -90)}" />`,
  triangle: () => `<polygon points="${regularPolygonPoints(12, 12.5, 10, 3, -90)}" />`,
  hexagon: () => `<polygon points="${regularPolygonPoints(12, 12, 9.5, 6, -90)}" />`,
  star: () => `<polygon points="${starPoints(12, 12.5, 10, 4, 5, -90)}" />`,
};

// Returns an SVG markup string for the given shape/color/size.
export function shapeMarkup(shape, color, size = 14) {
  const build = SHAPE_BUILDERS[shape] || SHAPE_BUILDERS.circle;
  return (
    `<svg class="league-marker" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="${color}" aria-hidden="true">${build()}</svg>`
  );
}

// Returns an actual SVG element (for cases where innerHTML isn't convenient).
export function shapeElement(shape, color, size = 14) {
  const wrapper = document.createElement('span');
  wrapper.innerHTML = shapeMarkup(shape, color, size);
  return wrapper.firstElementChild;
}
