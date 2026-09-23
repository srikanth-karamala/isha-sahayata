import { CycleStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Hub pins from OpenStreetMap building centroids (Overpass, Aug 2026):
 * - Spanda Hall          10.979925, 76.736903
 * - Biksha Hall          10.981258, 76.737336
 * - Dhyanalinga          10.978067, 76.735315 (campus anchor)
 * - Isha Info Center     10.977239, 76.737505 (Main Gate approach)
 * - Shivapadam Cottages  10.984728, 76.738878
 * - Chamundi Cottages    10.980926, 76.734025 (NOT the Kondrai stand — this
 *   landmark was once used for it by mistake; the stand is by Sivapadam 2)
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
    // APPROXIMATE, not surveyed. This stand sits just south of Sivapadam 2,
    // about 110m away — confirmed by Srikanth on 23 September. It was
    // previously at 10.98093, 76.73355, which is the Chamundi Cottages
    // position noted above rather than the stand itself, and put it 686m from
    // Sivapadam 2: its furthest neighbour instead of its nearest.
    //
    // These figures are derived from that description, so they place the pin
    // in the right relationship to the other stands without being a reading
    // taken on the spot. Replace with a real one when somebody is there.
    latitude: 10.9832,
    longitude: 76.7388,
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

  const cycles: {
    qrCode: string;
    status: CycleStatus;
    currentHubId: string;
  }[] = [
    { qrCode: 'ISHA-CYC-101', status: CycleStatus.AVAILABLE, currentHubId: hubsByName['Spanda Hall'].id },
    { qrCode: 'ISHA-CYC-102', status: CycleStatus.AVAILABLE, currentHubId: hubsByName['Opposite Spanda Hall'].id },
    { qrCode: 'ISHA-CYC-103', status: CycleStatus.MAINTENANCE, currentHubId: hubsByName['Biksha Hall'].id },
    { qrCode: 'ISHA-CYC-104', status: CycleStatus.AVAILABLE, currentHubId: hubsByName['Main Gate'].id },
    { qrCode: 'ISHA-CYC-105', status: CycleStatus.AVAILABLE, currentHubId: hubsByName['Kondrai'].id },
    { qrCode: 'ISHA-CYC-106', status: CycleStatus.AVAILABLE, currentHubId: hubsByName['Sivapadam 2'].id },
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
