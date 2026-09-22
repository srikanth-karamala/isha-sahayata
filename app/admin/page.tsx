import {
  getActiveRides,
  getHubs,
  getMaintenanceCycles,
  getRepairQueue,
  getTodayStats,
} from '@/app/actions';
import { getFleetSummary, getHourlyDemand, getHubBalances } from '@/lib/analytics';
import { generateBriefing } from '@/lib/briefing';
import { getLostFoundSummary, getOpenFeed } from '@/app/lost-found-actions';
import { activeProvider } from '@/lib/ai';
import AdminClient from './AdminClient';
import Overview from './Overview';
import StaffConsole from './StaffConsole';
import LostFoundBoard from './LostFoundBoard';
import CabBoard from './CabBoard';
import { getCabRequests } from '@/app/cab-actions';

export const revalidate = 0;

export default async function AdminPage() {
  const [
    maintenanceCycles,
    hubs,
    stats,
    liveRides,
    summary,
    avgDemand,
    balances,
    lfSummary,
    feed,
    repairs,
    cabRequests,
  ] = await Promise.all([
    getMaintenanceCycles(),
    getHubs(),
    getTodayStats(),
    getActiveRides(),
    getFleetSummary(),
    getHourlyDemand(),
    getHubBalances(),
    getLostFoundSummary(),
    getOpenFeed(40),
    getRepairQueue(40),
    getCabRequests(40),
  ]);

  // Depends on the aggregates above, so it runs after them. The briefing
  // reasons about the campus rhythm, so it gets the 14-day average rather
  // than today alone.
  const briefing = await generateBriefing(summary, balances, avgDemand);

  return (
    <StaffConsole
      maintenanceCount={maintenanceCycles.length}
      unsafeCount={summary.unsafeCycles}
      lostFoundCount={lfSummary.openLost + lfSummary.openFound}
      overview={
        <Overview summary={summary} briefing={briefing} repairs={repairs} />
      }
      cycles={
        <AdminClient
          initialMaintenanceCycles={maintenanceCycles}
          hubs={hubs}
          stats={stats}
          initialLiveRides={liveRides}
        />
      }
      cabCount={
        cabRequests.filter(
          (r) => r.status === 'REQUESTED' || r.status === 'ACCEPTED'
        ).length
      }
      cabs={<CabBoard requests={cabRequests} />}
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
