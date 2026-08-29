import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Hub pins from OpenStreetMap building centroids (Overpass, Aug 2026):
 * - Spanda Hall          10.979925, 76.736903
 * - Biksha Hall          10.981258, 76.737336
 * - Dhyanalinga          10.978067, 76.735315 (campus anchor)
 * - Isha Info Center     10.977239, 76.737505 (Main Gate approach)
 * - Shivapadam Cottages  10.984728, 76.738878
 * - Chamundi Cottages    10.980926, 76.734025 (Kondrai vicinity)
 * Opposite Spanda = dock across the driveway south of Spanda Hall.
 */
const HUBS = [
  {
    name: 'Main Gate',
    capacity: 40,
    latitude: 10.97724,
    longitude: 76.73751,
  },
  {
    name: 'Spanda Hall',
    capacity: 30,
    latitude: 10.979925,
    longitude: 76.736903,
  },
  {
    name: 'Opposite Spanda Hall',
    capacity: 20,
    latitude: 10.97955,
    longitude: 76.73715,
  },
  {
    name: 'Biksha Hall',
    capacity: 25,
    latitude: 10.981258,
    longitude: 76.737336,
  },
  {
    name: 'Kondrai',
    capacity: 15,
    latitude: 10.98093,
    longitude: 76.73355,
  },
  {
    name: 'Sivapadam 2',
    capacity: 15,
    latitude: 10.9842,
    longitude: 76.73888,
  },
] as const;

async function main() {
  console.log('Seeding Isha Yoga Center station hubs...');

  const hubsByName: Record<string, { id: string }> = {};

  for (const hub of HUBS) {
    const row = await prisma.hub.upsert({
      where: { name: hub.name },
      update: {
        latitude: hub.latitude,
        longitude: hub.longitude,
        capacity: hub.capacity,
      },
      create: hub,
    });
    hubsByName[hub.name] = row;
  }

  const cycles = [
    { qrCode: 'ISHA-CYC-101', status: 'AVAILABLE', currentHubId: hubsByName['Spanda Hall'].id },
    { qrCode: 'ISHA-CYC-102', status: 'AVAILABLE', currentHubId: hubsByName['Opposite Spanda Hall'].id },
    { qrCode: 'ISHA-CYC-103', status: 'MAINTENANCE', currentHubId: hubsByName['Biksha Hall'].id },
    { qrCode: 'ISHA-CYC-104', status: 'AVAILABLE', currentHubId: hubsByName['Main Gate'].id },
    { qrCode: 'ISHA-CYC-105', status: 'AVAILABLE', currentHubId: hubsByName['Kondrai'].id },
    { qrCode: 'ISHA-CYC-106', status: 'AVAILABLE', currentHubId: hubsByName['Sivapadam 2'].id },
  ];

  for (const cycle of cycles) {
    await prisma.cycle.upsert({
      where: { qrCode: cycle.qrCode },
      update: {},
      create: cycle,
    });
  }

  console.log('6 Station hubs & cycles seeded successfully!');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
