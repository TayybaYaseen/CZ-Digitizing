import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiClientError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { OfflineBanner } from '../components/OfflineBanner';
import type { CartDto, CartItemDto } from '../lib/types';
import type { CartStackParamList } from '../navigation/types';
import { useApiQuery } from '../lib/use-api-query';

// Port of apps/web/lib/cart-context.tsx + app/cart/page.tsx — GET/PUT/DELETE /api/cart* one-for-
// one, no local cart state treated as authoritative (AC-8/AC-16).
type Props = NativeStackScreenProps<CartStackParamList, 'Cart'>;

export function CartScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const query = useApiQuery<CartDto>('/api/cart');

  useFocusEffect(
    useCallback(() => {
      query.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  async function removeItem(itemId: string) {
    try {
      await apiFetch(`/api/cart/items/${itemId}`, { method: 'DELETE', headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
      query.refetch();
    } catch {
      // Surfaced implicitly by the next refetch's own error state.
    }
  }

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {query.status === 'loading' && <ActivityIndicator style={styles.center} />}
      {query.status === 'error' && <Text style={styles.error}>{query.error instanceof ApiClientError ? query.error.error.message : 'Could not load your cart.'}</Text>}
      {query.status === 'success' && (
        <>
          <FlatList
            data={query.data.items}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.empty}>Your cart is empty.</Text>}
            renderItem={({ item }: { item: CartItemDto }) => (
              <View style={styles.row}>
                {item.previewImageUrl ? <Image source={{ uri: item.previewImageUrl }} style={styles.thumb} /> : <View style={styles.thumb} />}
                <View style={styles.rowBody}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.meta}>{item.sizeLabel ?? ''} × {item.quantity}</Text>
                  <Text style={styles.price}>PKR {item.linePriceAtSelectionPkr}</Text>
                </View>
                <Pressable onPress={() => removeItem(item.id)}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            )}
          />
          <View style={styles.summary}>
            <Text style={styles.summaryLine}>Subtotal: PKR {query.data.subtotalPkr}</Text>
            <Text style={styles.summaryTotal}>Total: PKR {query.data.totalPkr}</Text>
            <Pressable style={styles.button} disabled={query.data.items.length === 0} onPress={() => navigation.navigate('Checkout')}>
              <Text style={styles.buttonText}>Checkout</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { marginTop: 40 },
  error: { color: '#c0392b', padding: 16, textAlign: 'center' },
  empty: { padding: 24, textAlign: 'center', color: '#777' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#eee', marginRight: 12 },
  rowBody: { flex: 1 },
  name: { fontWeight: '600' },
  meta: { color: '#777', fontSize: 12 },
  price: { color: '#1a1a2e' },
  remove: { color: '#c0392b' },
  summary: { padding: 16, borderTopWidth: 1, borderColor: '#eee' },
  summaryLine: { color: '#555' },
  summaryTotal: { fontSize: 18, fontWeight: '700', marginVertical: 8 },
  button: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
