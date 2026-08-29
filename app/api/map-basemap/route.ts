import { get } from 'node:https';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { CAMPUS_BOUNDS } from '@/lib/campus-map';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fetchBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    get(url, { rejectUnauthorized: false, headers: { 'User-Agent': 'YellowCycle/1.0' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchBuffer(res.headers.location).then(resolve, reject);
        return;
      }
      if (!res.statusCode || res.statusCode >= 400) {
        reject(new Error(`Upstream ${res.statusCode ?? 'error'}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: res.headers['content-type'] || 'image/jpeg',
        })
      );
      res.on('error', reject);
    }).on('error', reject);
  });
}

function googleStaticUrl(key: string) {
  const { south, west, north, east } = CAMPUS_BOUNDS;
  const params = new URLSearchParams({
    size: '640x740',
    scale: '2',
    maptype: 'hybrid',
    visible: `${south},${west}|${north},${east}`,
    key,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

function esriExportUrl() {
  const { south, west, north, east } = CAMPUS_BOUNDS;
  const bbox = `${west},${south},${east},${north}`;
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=1280,1480&format=jpg&f=image`;
}

async function localCampusJpg() {
  const filePath = path.join(process.cwd(), 'public', 'maps', 'campus.jpg');
  const buffer = await readFile(filePath);
  return { buffer, contentType: 'image/jpeg' };
}

export async function GET() {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (key) {
    try {
      const image = await fetchBuffer(googleStaticUrl(key));
      if (image.buffer.byteLength > 1000 && !image.contentType.includes('text')) {
        return new NextResponse(new Uint8Array(image.buffer), {
          headers: {
            'Content-Type': image.contentType,
            'Cache-Control': 'public, max-age=3600',
            'X-Map-Source': 'google-static',
          },
        });
      }
    } catch {
      // fall through
    }
  }

  try {
    const local = await localCampusJpg();
    return new NextResponse(new Uint8Array(local.buffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'X-Map-Source': 'local-satellite',
      },
    });
  } catch {
    // fall through
  }

  try {
    const image = await fetchBuffer(esriExportUrl());
    return new NextResponse(new Uint8Array(image.buffer), {
      headers: {
        'Content-Type': image.contentType,
        'Cache-Control': 'public, max-age=3600',
        'X-Map-Source': 'esri-export',
      },
    });
  } catch {
    return NextResponse.redirect(new URL('/maps/campus.svg', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'));
  }
}
