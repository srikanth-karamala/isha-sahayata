'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { haversineMeters } from '@/lib/geo';

export interface RideTracker {
  isTracking: boolean;
  currentPos: [number, number] | null;
  ridePath: [number, number][];
  distanceMeters: number;
  elapsedSeconds: number;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export default function useRideTracker(): RideTracker {
  const [isTracking, setIsTracking] = useState(false);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [ridePath, setRidePath] = useState<[number, number][]>([]);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    setIsTracking(true);
  }, []);

  const stop = useCallback(() => {
    setIsTracking(false);
  }, []);

  const reset = useCallback(() => {
    setRidePath([]);
    setDistanceMeters(0);
    setElapsedSeconds(0);
  }, []);

  useEffect(() => {
    if (!isTracking || typeof window === 'undefined') return;

    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          if (position.coords.accuracy > 45) return;
          const newPoint: [number, number] = [
            position.coords.latitude,
            position.coords.longitude,
          ];
          setCurrentPos(newPoint);
          setRidePath((prev) => {
            if (prev.length > 0) {
              const added = haversineMeters(prev[prev.length - 1], newPoint);
              if (added < 4) return prev;
              setDistanceMeters((d) => d + added);
            }
            return [...prev, newPoint];
          });
        },
        (err) => console.warn('GPS Error:', err),
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTracking]);

  return { isTracking, currentPos, ridePath, distanceMeters, elapsedSeconds, start, stop, reset };
}
