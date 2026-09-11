import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApiQuery } from '../../lib/use-api-query';
import { OfflineBanner } from '../../components/OfflineBanner';
import type { ActivityEventDto } from '../../lib/types';
import type { AccountStackParamList } from '../../navigation/types';

// Port of apps/web/app/account/activity/page.tsx — GET /api/users/activity, reverse-chronological
// (aspect A-019 AC-13; this screen closes A-023's own §5 Route(s) gap for Account Activity).
type Props = NativeStackScreenProps<AccountStackParamList, 'Activity'>;

const EVENT_LABEL: Record<ActivityEventDto['eventType'], string> = {
  VIEWED: 'Viewed a design',
  ADDED_TO_CART: 'Added to cart',
  REMOVED_FROM_CART: 'Removed from cart',
  PURCHASED: 'Placed an order',
  PAID: 'Payment confirmed',
  DOWNLOADED: 'Downloaded a file',
};

export function ActivityScreen({ navigation }: Props) {
  const query = useApiQuery<ActivityEventDto[]>('/api/users/activity?page=1&pageSize=50');

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {query.status === 'loading' && <ActivityIndicator style={styles.center} />}
      {query.status === 'error' && <Text style={styles.error}>Could not load your activity.</Text>}
      {query.status === 'offline' && <Text style={styles.error}>You're offline.</Text>}
      {query.status === 'success' && (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No activity yet — browse a design to get started.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              disabled={!item.orderId && !item.designId}
              onPress={() => {
                if (item.orderId) navigation.navigate('Orders');
                else if (item.designId) (navigation as { navigate: (...args: unknown[]) => void }).navigate('HomeTab', { screen: 'DesignDetail', params: { designId: item.designId } });
              }}
            >
              <Text style={styles.title}>{EVENT_LABEL[item.eventType]}</Text>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { marginTop: 40 },
  error: { color: '#c0392b', padding: 16, textAlign: 'center' },
  empty: { padding: 24, textAlign: 'center', color: '#777' },
  row: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontWeight: '600' },
  date: { color: '#777', fontSize: 12, marginTop: 2 },
});
