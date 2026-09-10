import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useApiQuery } from '../../lib/use-api-query';
import { OfflineBanner } from '../../components/OfflineBanner';

// docs/specs/2026-08-28-03-admin-platform-settings.md AC-12–AC-14, referenced by AC-4 of the
// mobile spec: a mobile-adapted, read-only KPI summary — not the full desktop admin surface.
// Port of the stats half of apps/admin/app/dashboard/page.tsx — GET /api/admin/dashboard/stats.
interface DashboardStatsDto {
  totalOrders: number;
  totalRevenuePkr: number;
  newCustomers: number;
  pendingCustomRequests: number;
}

export function AdminDashboardScreen() {
  const query = useApiQuery<DashboardStatsDto>('/api/admin/dashboard/stats');

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <Text style={styles.title}>Admin Dashboard</Text>
      {query.status === 'loading' && <ActivityIndicator style={styles.center} color="#fff" />}
      {query.status === 'error' && <Text style={styles.error}>Could not load dashboard stats.</Text>}
      {query.status === 'success' && (
        <View style={styles.grid}>
          <KpiTile label="Total Orders" value={String(query.data.totalOrders)} />
          <KpiTile label="Total Revenue" value={`PKR ${query.data.totalRevenuePkr}`} />
          <KpiTile label="New Customers" value={String(query.data.newCustomers)} />
          <KpiTile label="Pending Custom Requests" value={String(query.data.pendingCustomRequests)} />
        </View>
      )}
    </View>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a', padding: 16 },
  center: { marginTop: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 16 },
  error: { color: '#ff6b6b' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '47%', backgroundColor: '#1a1a2e', borderRadius: 10, padding: 16 },
  tileValue: { color: '#d4af37', fontSize: 22, fontWeight: '700' },
  tileLabel: { color: '#ccc', marginTop: 4 },
});
