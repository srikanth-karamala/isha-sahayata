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
 * Keep pan/zoom inside the packed tile footprint.
 * Large padding showed empty black beyond the local imagery when zoomed out.
 */
export function campusMaxBounds(): [[number, number], [number, number]] {
  const padLng = (CAMPUS_BOUNDS.east - CAMPUS_BOUNDS.west) * 0.08;
  const padLat = (CAMPUS_BOUNDS.north - CAMPUS_BOUNDS.south) * 0.08;
  return [
    [CAMPUS_BOUNDS.west - padLng, CAMPUS_BOUNDS.south - padLat],
    [CAMPUS_BOUNDS.east + padLng, CAMPUS_BOUNDS.north + padLat],
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
