import type { StyleSpecification } from 'maplibre-gl';
import { CAMPUS_BOUNDS } from '@/lib/campus-map';

/** Soft forest fill for unloaded tiles — matches Esri canopy, not phone chrome. */
const GROUND = '#3a5238';

/** Local offline satellite tiles for the ashram (Esri imagery, cached under /public/tiles/isha). */
export const campusSatelliteStyle: StyleSpecification = {
  version: 8,
  name: 'Isha campus satellite',
  sources: {
    isha: {
      type: 'raster',
      tiles: ['/tiles/isha/{z}/{x}/{y}.jpg'],
      tileSize: 256,
      minzoom: 14,
      maxzoom: 18,
      attribution: 'Imagery © Esri',
      // Avoid blank world wraps outside the packed campus pack.
      bounds: [
        CAMPUS_BOUNDS.west,
        CAMPUS_BOUNDS.south,
        CAMPUS_BOUNDS.east,
        CAMPUS_BOUNDS.north,
      ],
    },
  },
  layers: [
    {
      id: 'campus-ground',
      type: 'background',
      paint: {
        'background-color': GROUND,
      },
    },
    {
      id: 'isha-satellite',
      type: 'raster',
      source: 'isha',
      paint: {
        'raster-fade-duration': 150,
        'raster-opacity': 1,
      },
    },
  ],
  // Replaces the default black void above the horizon in pitched 3D.
  sky: {
    'sky-color': '#7eb6d9',
    'sky-horizon-blend': 0.75,
    'horizon-color': '#d7e2c8',
    'horizon-fog-blend': 0.85,
    'fog-color': '#c5d4b8',
    'fog-ground-blend': 0.45,
    'atmosphere-blend': [
      'interpolate',
      ['linear'],
      ['zoom'],
      14,
      0.55,
      16,
      0.35,
      18,
      0.15,
    ],
  },
};

/**
 * The area the packed z18 tiles actually cover, in degrees.
 *
 * This is the footprint of the tile grid on disk (x 186945–186954,
 * y 123024–123034 at z18), not the seeded hub extent. The two are close but
 * not identical, and the difference is what used to show as blank ground.
 */
const TILE_COVERAGE = {
  west: 76.72989,
  south: 10.96951,
  east: 76.74362,
  north: 10.98434,
} as const;

/**
 * Keep pan/zoom inside the packed tile footprint.
 *
 * This previously padded CAMPUS_BOUNDS outward by 8%, which let the camera
 * reach about 109 m north of where the imagery ends. Sivapadam 2 sits at
 * latitude 10.9842 — roughly 15 m inside the tile edge — so selecting that hub
 * panned straight into the blank strip and the map read as failing to load.
 * Clamping to the imagery itself means every reachable view has tiles under it.
 */
export function campusMaxBounds(): [[number, number], [number, number]] {
  return [
    [TILE_COVERAGE.west, TILE_COVERAGE.south],
    [TILE_COVERAGE.east, TILE_COVERAGE.north],
  ];
}

/** Pitch softens as you zoom out so the horizon void stays off-screen. */
export function pitchForZoom(zoom: number, want3D: boolean): number {
  if (!want3D) return 0;
  if (zoom >= 16.4) return 58;
  if (zoom <= 15) return 22;
  const t = (zoom - 15) / (16.4 - 15);
  return 22 + t * (58 - 22);
}
