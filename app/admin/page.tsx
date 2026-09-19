import { getActiveRides, getHubs, getMaintenanceCycles, getTodayStats } from '@/app/actions';
import AdminClient from './AdminClient';

export const revalidate = 0;

export default async function AdminPage() {
  const [maintenanceCycles, hubs, stats, liveRides] = await Promise.all([
    getMaintenanceCycles(),
    getHubs(),
    getTodayStats(),
    getActiveRides(),
  ]);

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
      <div className="max-w-4xl mx-auto px-4 py-8">
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
