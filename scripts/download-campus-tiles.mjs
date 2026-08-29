#!/usr/bin/env node
/**
 * Re-pack local Esri World Imagery tiles for the Isha campus.
 * Usage: node scripts/download-campus-tiles.mjs
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const BOUNDS = { south: 10.9705, west: 76.7305, north: 10.9835, east: 76.7430 };
const ZOOMS = [14, 15, 16, 17, 18];
const ROOT = path.join(__dirname, '..', 'public', 'tiles', 'isha');

function latLngToTile(lat, lng, z) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

function fetchTile(z, x, y) {
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false, headers: { 'User-Agent': 'YellowCycleTilePack/1.0' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, { rejectUnauthorized: false }, (res2) => collect(res2, resolve, reject)).on('error', reject);
        return;
      }
      collect(res, resolve, reject);
    }).on('error', reject);
  });
}

function collect(res, resolve, reject) {
  if (!res.statusCode || res.statusCode >= 400) {
    reject(new Error(`HTTP ${res.statusCode}`));
    return;
  }
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => resolve(Buffer.concat(chunks)));
  res.on('error', reject);
}

async function main() {
  let ok = 0;
  let fail = 0;
  let skip = 0;
  for (const z of ZOOMS) {
    const nw = latLngToTile(BOUNDS.north, BOUNDS.west, z);
    const se = latLngToTile(BOUNDS.south, BOUNDS.east, z);
    const x0 = Math.min(nw.x, se.x);
    const x1 = Math.max(nw.x, se.x);
    const y0 = Math.min(nw.y, se.y);
    const y1 = Math.max(nw.y, se.y);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const dir = path.join(ROOT, String(z), String(x));
        const file = path.join(dir, `${y}.jpg`);
        if (fs.existsSync(file) && fs.statSync(file).size > 500) {
          skip++;
          continue;
        }
        fs.mkdirSync(dir, { recursive: true });
        try {
          const buf = await fetchTile(z, x, y);
          if (buf.length < 400) throw new Error('tiny');
          fs.writeFileSync(file, buf);
          ok++;
        } catch (e) {
          fail++;
          console.error(`fail ${z}/${x}/${y}`, e.message);
        }
      }
    }
  }
  console.log({ ok, fail, skip, root: ROOT });
}

main();
