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
    <main className="min-h-dvh" style={{ background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'var(--sans)' }}>
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
