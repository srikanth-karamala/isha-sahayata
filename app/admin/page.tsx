import { getActiveRides, getHubs, getMaintenanceCycles, getTodayStats } from '@/app/actions';
import { getFleetSummary, getHourlyDemand, getHubBalances } from '@/lib/analytics';
import { generateBriefing } from '@/lib/briefing';
import { getLostFoundSummary, getOpenItems } from '@/app/lost-found-actions';
import AdminClient from './AdminClient';
import FleetInsights from '@/components/FleetInsights';
import StaffConsole from './StaffConsole';
import LostFoundBoard from './LostFoundBoard';

export const revalidate = 0;

export default async function AdminPage() {
  const [
    maintenanceCycles,
    hubs,
    stats,
    liveRides,
    summary,
    demand,
    balances,
    lfSummary,
    lostItems,
    foundItems,
  ] = await Promise.all([
    getMaintenanceCycles(),
    getHubs(),
    getTodayStats(),
    getActiveRides(),
    getFleetSummary(),
    getHourlyDemand(),
    getHubBalances(),
    getLostFoundSummary(),
    getOpenItems('LOST', 20),
    getOpenItems('FOUND', 20),
  ]);

  // Depends on the aggregates above, so it runs after them.
  const briefing = await generateBriefing(summary, balances, demand);

  return (
    <StaffConsole
      maintenanceCount={maintenanceCycles.length}
      unsafeCount={summary.unsafeCycles}
      lostFoundCount={lfSummary.openLost + lfSummary.openFound}
      overview={
        <FleetInsights
          summary={summary}
          hubs={balances}
          demand={demand}
          briefing={briefing}
        />
      }
      cycles={
        <AdminClient
          initialMaintenanceCycles={maintenanceCycles}
          hubs={hubs}
          stats={stats}
          initialLiveRides={liveRides}
        />
      }
      lostFound={
        <LostFoundBoard
          summary={lfSummary}
          openLostItems={lostItems}
          openFoundItems={foundItems}
        />
      }
    />
  );
}
