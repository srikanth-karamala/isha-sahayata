import { prisma } from '@/lib/prisma';
import MainDashboard from '@/components/MainDashboard';
import type { HubSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Server actions on this page include the assistant, which calls a model and
// can take longer than Vercel's default 10 second function limit — a limit
// that kills the request mid-flight rather than returning an error, so the
// client sees a promise that never settles instead of a failure it could
// report. 60s is the Hobby plan's ceiling and ample: Groq answers in about a
// second, and the cost of being wrong is a chat that hangs.
export const maxDuration = 60;

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
