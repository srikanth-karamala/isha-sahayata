import { getActiveRides, getHubs, getMaintenanceCycles, getTodayStats } from '@/app/actions';
import { getFleetSummary, getHourlyDemand, getHubBalances } from '@/lib/analytics';
import { generateBriefing } from '@/lib/briefing';
import AdminClient from './AdminClient';
import FleetInsights from '@/components/FleetInsights';

export const revalidate = 0;

export default async function AdminPage() {
  const [maintenanceCycles, hubs, stats, liveRides, summary, demand, balances] =
    await Promise.all([
      getMaintenanceCycles(),
      getHubs(),
      getTodayStats(),
      getActiveRides(),
      getFleetSummary(),
      getHourlyDemand(),
      getHubBalances(),
    ]);

  // Depends on the aggregates above, so it runs after them.
  const briefing = await generateBriefing(summary, balances, demand);

  return (
    <main
      className="h-dvh overflow-y-auto"
      style={{
        background:
          'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(245,183,0,0.1) 0%, transparent 50%), var(--paper)',
        color: 'var(--ink)',
        fontFamily: 'var(--sans)',
      }}
    >
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <FleetInsights
          summary={summary}
          hubs={balances}
          demand={demand}
          briefing={briefing}
        />
        <AdminClient
          initialMaintenanceCycles={maintenanceCycles}
          hubs={hubs}
          stats={stats}
          initialLiveRides={liveRides}
        />
      </div>
    </main>
  );
}
