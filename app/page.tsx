import { prisma } from '@/lib/prisma';
import MainDashboard from '@/components/MainDashboard';
import type { HubSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const hubs = (await prisma.hub.findMany({
    include: {
      cycles: {
        select: {
          id: true,
          qrCode: true,
          status: true,
        },
      },
    },
  })) as HubSummary[];

  return <MainDashboard initialHubs={hubs} />;
}
