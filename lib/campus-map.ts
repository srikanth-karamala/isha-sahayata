/** Offline campus frame covering seeded Isha dock positions + packed tiles. */
export const CAMPUS_BOUNDS = {
  south: 10.9715,
  west: 76.7315,
  north: 10.9843,
  east: 76.7425,
} as const;

/** Project [lat, lng] into percent of the offline campus map (0–100). */
export function projectToMapPercent(lat: number, lng: number): { x: number; y: number } {
  const { south, west, north, east } = CAMPUS_BOUNDS;
  const x = ((lng - west) / (east - west)) * 100;
  const y = ((north - lat) / (north - south)) * 100;
  return {
    x: Math.min(100, Math.max(0, x)),
    y: Math.min(100, Math.max(0, y)),
  };
}

export function pathToSvgPoints(path: [number, number][]): string {
  return path
    .map(([lat, lng]) => {
      const { x, y } = projectToMapPercent(lat, lng);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}
