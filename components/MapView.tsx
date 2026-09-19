'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { LngLatBounds, Map as MapLibreMap, Marker, Popup } from 'maplibre-gl';
import type { GeoJSONSource, FlyToOptions } from 'maplibre-gl';
import type { Feature, LineString } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Box, Crosshair } from 'lucide-react';
import type { HubSummary, LiveRide } from '@/lib/types';
import { availableCount, faultCount } from '@/lib/types';
import { CAMPUS_CENTER, haversineMeters, hubPosition, toLngLat } from '@/lib/geo';
import { campusMaxBounds, campusSatelliteStyle, pitchForZoom } from '@/lib/map-style';

/** Pitched campus view — foothills sit behind the ashram when bearing is slight west. */
const VIEW_3D = { pitch: 52, bearing: -28 } as const;
const VIEW_2D = { pitch: 0, bearing: 0 } as const;

function pinElement(hub: HubSummary, selected: boolean) {
  const available = availableCount(hub);
  const faults = faultCount(hub);
  const stateClass = faults > 0 ? 'is-fault' : available === 0 ? 'is-empty' : '';
  const selectedClass = selected ? 'is-selected' : '';
  const wrap = document.createElement('button');
  wrap.type = 'button';
  wrap.className = 'yc-map-pin-btn';
  wrap.setAttribute('aria-label', `${hub.name}, ${available} yellow cycles available`);
  wrap.innerHTML = `<div class="yc-pin ${stateClass} ${selectedClass}"><div class="yc-pin-bubble">${available}</div><div class="yc-pin-tip"></div><span class="yc-pin-label">${hub.name.split(' ')[0]}</span></div>`;
  return wrap;
}

function riderElement() {
  const wrap = document.createElement('div');
  wrap.innerHTML = '<div class="yc-rider-dot"></div>';
  return wrap;
}

function pathToGeoJSON(path: [number, number][]): Feature<LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: path.map((point) => toLngLat(point)),
    },
  };
}

function MapView({
  hubs,
  selectedHubId,
  followRider,
  currentPos,
  ridePath,
  liveRides = [],
  showLocate = true,
  onSelectHub,
  onUserLocated,
}: {
  hubs: HubSummary[];
  selectedHubId: string | null;
  followRider: boolean;
  currentPos: [number, number] | null;
  ridePath: [number, number][];
  liveRides?: LiveRide[];
  showLocate?: boolean;
  onSelectHub?: (hubId: string) => void;
  onUserLocated?: (pos: [number, number]) => void;
}) {
  const [is3D, setIs3D] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const liveMarkersRef = useRef<Map<string, Marker>>(new Map());
  const riderRef = useRef<Marker | null>(null);
  const fittedRef = useRef(false);
  const lastFollowRef = useRef<[number, number] | null>(null);
  const lastSelectedRef = useRef<string | null>(null);
  const is3DRef = useRef(is3D);
  const userToggledViewRef = useRef(false);
  const onSelectHubRef = useRef(onSelectHub);
  const onUserLocatedRef = useRef(onUserLocated);
  const ridePathRef = useRef(ridePath);
  const liveRidesRef = useRef(liveRides);

  is3DRef.current = is3D;
  onSelectHubRef.current = onSelectHub;
  onUserLocatedRef.current = onUserLocated;
  ridePathRef.current = ridePath;
  liveRidesRef.current = liveRides;

  const cameraExtras = (): Pick<FlyToOptions, 'pitch' | 'bearing'> => {
    if (!is3DRef.current) return { ...VIEW_2D };
    const zoom = mapRef.current?.getZoom() ?? 16.2;
    return { pitch: pitchForZoom(zoom, true), bearing: VIEW_3D.bearing };
  };

  const ensureRideLayers = (map: MapLibreMap) => {
    if (!map.getSource('ride-path')) {
      map.addSource('ride-path', { type: 'geojson', data: pathToGeoJSON(ridePathRef.current) });
      map.addLayer({
        id: 'ride-path-line',
        type: 'line',
        source: 'ride-path',
        paint: {
          'line-color': '#f5b700',
          'line-width': 5,
          'line-opacity': 0.92,
        },
      });
    }
    if (!map.getSource('live-rides')) {
      map.addSource('live-rides', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'live-rides-line',
        type: 'line',
        source: 'live-rides',
        paint: {
          'line-color': '#ca8a04',
          'line-width': 4,
          'line-opacity': 0.85,
        },
      });
    }
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const map = new MapLibreMap({
      container: el,
      style: campusSatelliteStyle,
      center: toLngLat(CAMPUS_CENTER),
      zoom: 16.2,
      minZoom: 15,
      // The offline pack stops at z18 (lib/map-style.ts declares maxzoom: 18).
      // Allowing 18.5 let the camera past the deepest tile, so MapLibre had to
      // upscale one level and the imagery went soft exactly when a rider zoomed
      // in to find a dock. Cap the camera at what the pack actually contains.
      maxZoom: 18,
      pitch: VIEW_3D.pitch,
      bearing: VIEW_3D.bearing,
      maxPitch: 62,
      maxBounds: campusMaxBounds(),
      attributionControl: { compact: true },
      dragRotate: true,
      pitchWithRotate: true,
      touchPitch: true,
      renderWorldCopies: false,
      fadeDuration: 120,
    });
    mapRef.current = map;

    map.on('load', () => {
      ensureRideLayers(map);
      map.resize();
    });

    // Flatten pitch when zooming out so black void / empty tile edges stay off-screen.
    const syncPitchToZoom = () => {
      if (!is3DRef.current) return;
      const target = pitchForZoom(map.getZoom(), true);
      if (Math.abs(map.getPitch() - target) < 1.5) return;
      map.easeTo({ pitch: target, duration: 180 });
    };
    map.on('zoomend', syncPitchToZoom);

    const onResize = () => map.resize();
    window.addEventListener('resize', onResize);
    const timer = window.setTimeout(() => map.resize(), 250);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      map.off('zoomend', syncPitchToZoom);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      liveMarkersRef.current.forEach((marker) => marker.remove());
      liveMarkersRef.current.clear();
      riderRef.current?.remove();
      riderRef.current = null;
      map.remove();
      mapRef.current = null;
      fittedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const nextIds = new Set(hubs.map((hub) => hub.id));
    markersRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    const points: [number, number][] = [];

    for (const hub of hubs) {
      const pos = hubPosition(hub);
      if (!pos) continue;
      points.push(toLngLat(pos));

      const existing = markersRef.current.get(hub.id);
      if (existing) {
        existing.setLngLat(toLngLat(pos));
        const fresh = pinElement(hub, hub.id === selectedHubId);
        existing.getElement().className = fresh.className;
        existing.getElement().innerHTML = fresh.innerHTML;
        existing.getElement().setAttribute('aria-label', fresh.getAttribute('aria-label') || '');
      } else {
        const marker = new Marker({
          element: pinElement(hub, hub.id === selectedHubId),
          anchor: 'bottom',
        })
          .setLngLat(toLngLat(pos))
          .setPopup(
            new Popup({ offset: 18, closeButton: false }).setHTML(
              `<div class="yc-popup"><p class="yc-popup-title">${hub.name}</p><p class="yc-popup-meta">${availableCount(hub)} yellow cycles ready</p></div>`
            )
          )
          .addTo(map);
        marker.getElement().addEventListener('click', () => onSelectHubRef.current?.(hub.id));
        markersRef.current.set(hub.id, marker);
      }
    }

    if (!fittedRef.current && points.length >= 2) {
      const el = map.getContainer();
      const width = el.clientWidth;
      const height = el.clientHeight;

      // The rider layout reserves room for the header and the bottom sheet.
      // In a short container — the admin's live-rides panel, or any map whose
      // tab is hidden and therefore zero-sized — that padding exceeds the
      // canvas and MapLibre refuses the fit with a console warning. Scale the
      // padding to what the canvas can actually give, and skip the fit
      // entirely until the map has been laid out.
      // fitBounds warns when the padding leaves no usable area. Cap each axis
      // at a third of the container so a meaningful viewport always remains,
      // and weight the vertical split toward the bottom, where the rider's
      // sheet sits. Measured in CSS pixels, which is what fitBounds expects.
      if (width > 120 && height > 120) {
        const padX = Math.floor(Math.min(width / 3, 104) / 2);
        const padY = Math.floor(Math.min(height / 3, 240));

        const bounds = new LngLatBounds(points[0], points[0]);
        points.forEach((point) => bounds.extend(point));

        // cameraForBounds warns when it cannot honour the request exactly —
        // here the hubs sit close enough together that framing them wants a
        // zoom above maxZoom, so the camera is clamped and a warning is
        // logged even though the result is correct. Compute the camera first
        // and apply it with easeTo, which performs no such check.
        const camera = map.cameraForBounds(bounds, {
          padding: {
            top: Math.round(padY * 0.32),
            bottom: Math.round(padY * 0.68),
            left: padX,
            right: padX,
          },
        });

        if (camera) {
          map.easeTo({
            center: camera.center,
            zoom: Math.min(camera.zoom ?? 16.2, 17),
            duration: 700,
            ...cameraExtras(),
          });
        }
        fittedRef.current = true;
      }
    }
  }, [hubs, selectedHubId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || followRider) return;
    if (!selectedHubId || selectedHubId === lastSelectedRef.current) return;
    lastSelectedRef.current = selectedHubId;
    const hub = hubs.find((item) => item.id === selectedHubId);
    const pos = hub ? hubPosition(hub) : null;
    if (pos) {
      map.flyTo({
        center: toLngLat(pos),
        zoom: Math.max(map.getZoom(), 17),
        duration: 650,
        ...cameraExtras(),
      });
    }
  }, [selectedHubId, hubs, followRider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userToggledViewRef.current) return;
    if (!is3D) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
      return;
    }
    map.easeTo({
      pitch: pitchForZoom(map.getZoom(), true),
      bearing: VIEW_3D.bearing,
      duration: 700,
    });
  }, [is3D]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource('ride-path') as GeoJSONSource | undefined;
    source?.setData(pathToGeoJSON(ridePath));

    if (!currentPos) {
      riderRef.current?.remove();
      riderRef.current = null;
      return;
    }

    if (riderRef.current) {
      riderRef.current.setLngLat(toLngLat(currentPos));
    } else {
      riderRef.current = new Marker({ element: riderElement(), anchor: 'center' })
        .setLngLat(toLngLat(currentPos))
        .addTo(map);
    }

    if (followRider) {
      if (!lastFollowRef.current) {
        map.flyTo({
          center: toLngLat(currentPos),
          zoom: Math.max(map.getZoom(), 17),
          duration: 650,
          ...cameraExtras(),
        });
        lastFollowRef.current = currentPos;
      } else if (haversineMeters(lastFollowRef.current, currentPos) > 28) {
        map.easeTo({
          center: toLngLat(currentPos),
          duration: 450,
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        });
        lastFollowRef.current = currentPos;
      }
    }
  }, [currentPos, ridePath, followRider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource('live-rides') as GeoJSONSource | undefined;
    source?.setData({
      type: 'FeatureCollection',
      features: liveRides
        .filter((ride) => ride.path.length > 1)
        .map((ride) => pathToGeoJSON(ride.path)),
    });

    const nextIds = new Set(liveRides.map((ride) => ride.id));
    liveMarkersRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        liveMarkersRef.current.delete(id);
      }
    });

    for (const ride of liveRides) {
      if (ride.lastLat == null || ride.lastLng == null) continue;
      const existing = liveMarkersRef.current.get(ride.id);
      const lngLat: [number, number] = [ride.lastLng, ride.lastLat];
      if (existing) {
        existing.setLngLat(lngLat);
      } else {
        const phone = ride.riderPhone ? ` · ${ride.riderPhone}` : '';
        const marker = new Marker({ element: riderElement(), anchor: 'center' })
          .setLngLat(lngLat)
          .setPopup(
            new Popup({ offset: 12, closeButton: false }).setHTML(
              `<div class="yc-popup"><p class="yc-popup-title">${ride.qrCode}</p><p class="yc-popup-meta">${ride.riderName}${phone}</p></div>`
            )
          )
          .addTo(map);
        liveMarkersRef.current.set(ride.id, marker);
      }
    }
  }, [liveRides]);

  const handleLocateMe = () => {
    const map = mapRef.current;
    if (!navigator.geolocation) {
      map?.flyTo({
        center: toLngLat(CAMPUS_CENTER),
        zoom: 17,
        duration: 650,
        ...cameraExtras(),
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userPos: [number, number] = [position.coords.latitude, position.coords.longitude];
        onUserLocatedRef.current?.(userPos);
        map?.flyTo({
          center: toLngLat(userPos),
          zoom: 17.2,
          duration: 750,
          ...cameraExtras(),
        });
      },
      () => {
        map?.flyTo({
          center: toLngLat(CAMPUS_CENTER),
          zoom: 17,
          duration: 650,
          ...cameraExtras(),
        });
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  return (
    <div className="yc-map relative h-full w-full overflow-hidden">
      <div ref={wrapRef} className="absolute inset-0 h-full w-full" />

      <div className="yc-map-controls" aria-label="Map controls">
        <button
          type="button"
          onClick={() => {
            userToggledViewRef.current = true;
            setIs3D((value) => !value);
          }}
          title={is3D ? 'Switch to 2D map' : 'Switch to 3D map'}
          aria-label={is3D ? 'Switch to 2D map' : 'Switch to 3D map'}
          aria-pressed={is3D}
          className={`yc-map-ctrl yc-map-ctrl-3d${is3D ? ' is-active' : ''}`}
        >
          <Box className="w-4 h-4" />
          <span>{is3D ? '3D' : '2D'}</span>
        </button>
        {showLocate && (
          <button
            type="button"
            onClick={handleLocateMe}
            title="Locate me"
            aria-label="Locate me"
            className="yc-map-ctrl"
          >
            <Crosshair className="w-5 h-5" />
          </button>
        )}
        <div className="yc-map-zoom">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn({ duration: 250 })}
            title="Zoom in"
            aria-label="Zoom in"
            className="yc-map-ctrl yc-map-ctrl-zoom"
          >
            <span className="yc-zoom-glyph yc-zoom-glyph-plus" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut({ duration: 250 })}
            title="Zoom out"
            aria-label="Zoom out"
            className="yc-map-ctrl yc-map-ctrl-zoom"
          >
            <span className="yc-zoom-glyph yc-zoom-glyph-minus" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(MapView);
