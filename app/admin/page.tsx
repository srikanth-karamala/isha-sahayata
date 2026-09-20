import { getActiveRides, getHubs, getMaintenanceCycles, getTodayStats } from '@/app/actions';
import {
  getFleetSummary,
  getHourlyDemand,
  getHubBalances,
  getTodayDemand,
} from '@/lib/analytics';
import { generateBriefing } from '@/lib/briefing';
import { getLostFoundSummary, getOpenFeed } from '@/app/lost-found-actions';
import { activeProvider } from '@/lib/ai';
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
    avgDemand,
    balances,
    lfSummary,
    feed,
  ] = await Promise.all([
    getMaintenanceCycles(),
    getHubs(),
    getTodayStats(),
    getActiveRides(),
    getFleetSummary(),
    getTodayDemand(),
    getHourlyDemand(),
    getHubBalances(),
    getLostFoundSummary(),
    getOpenFeed(40),
  ]);

  // Depends on the aggregates above, so it runs after them.
  // The briefing reasons about the campus rhythm, so it gets the 14-day
  // average; the chart shows today, which is what staff watch change.
  const briefing = await generateBriefing(summary, balances, avgDemand);

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
          feed={feed}
          claimed={lfSummary.claimed}
          aiAvailable={activeProvider() !== 'none'}
        />
      }
    />
  );
}
