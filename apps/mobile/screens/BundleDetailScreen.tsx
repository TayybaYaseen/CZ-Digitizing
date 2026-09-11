import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiClientError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { BundleDetailDto } from '../lib/types';
import type { MoreStackParamList } from '../navigation/types';

// Port of apps/web/app/bundles/[id]/page.tsx — GET /api/bundles/:id + POST /api/cart/items with
// bundleId (same route DesignDetailScreen already calls with designId). Closes A-023's §5 Design
// Bundles gap.
type Props = NativeStackScreenProps<MoreStackParamList, 'BundleDetail'>;

export function BundleDetailScreen({ route, navigation }: Props) {
  const { bundleId } = route.params;
  const { accessToken } = useAuth();
  const [bundle, setBundle] = useState<BundleDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    apiFetch<BundleDetailDto>(`/api/bundles/${bundleId}`)
      .then(setBundle)
      .catch((e) => setError(e instanceof ApiClientError ? e.error.message : 'Failed to load bundle.'));
  }, [bundleId]);

  async function onAddToCart() {
    setError(null);
    setAdding(true);
    try {
      await apiFetch('/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({ bundleId, quantity: 1 }),
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      setAdded(true);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.error.message : 'Failed to add to cart.');
    } finally {
      setAdding(false);
    }
  }

  if (error) return <View style={styles.container}><Text style={styles.error}>{error}</Text></View>;
  if (!bundle) return <ActivityIndicator style={styles.center} />;

  return (
    <ScrollView style={styles.container}>
      {bundle.previewImageUrl ? <Image source={{ uri: bundle.previewImageUrl }} style={styles.image} /> : <View style={styles.image} />}
      <View style={styles.body}>
        <Text style={styles.title}>{bundle.name}</Text>
        <Text style={styles.price}>
          {bundle.salePricePkr ? `PKR ${bundle.salePricePkr} ` : `PKR ${bundle.pricePkr}`}
          {bundle.salePricePkr ? <Text style={styles.strike}>PKR {bundle.pricePkr}</Text> : null}
        </Text>
        {bundle.description ? <Text style={styles.description}>{bundle.description}</Text> : null}
        <Text style={styles.count}>{bundle.includedDesigns.length} design{bundle.includedDesigns.length === 1 ? '' : 's'} included</Text>

        <Pressable style={styles.button} onPress={onAddToCart} disabled={adding}>
          {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{added ? 'Added ✓' : 'Add to cart'}</Text>}
        </Pressable>
        {added ? (
          <Pressable onPress={() => navigation.navigate('CartTab' as never)}>
            <Text style={styles.link}>View cart</Text>
          </Pressable>
        ) : null}

        <Text style={styles.sectionTitle}>Included designs</Text>
        <View style={styles.grid}>
          {bundle.includedDesigns.map((d) => (
            <View key={d.id} style={styles.designCard}>
              <Image source={{ uri: d.previewImageUrl }} style={styles.designImage} />
              <Text style={styles.designName} numberOfLines={1}>{d.name}</Text>
              <Text style={styles.designPrice}>PKR {d.priceOverridePkr ?? d.pricePkr}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { marginTop: 40 },
  error: { color: '#c0392b', padding: 16, textAlign: 'center' },
  image: { width: '100%', aspectRatio: 1.5, backgroundColor: '#eee' },
  body: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  price: { fontSize: 18, color: '#1a1a2e', marginTop: 4 },
  strike: { fontSize: 13, color: '#999', textDecorationLine: 'line-through' },
  description: { color: '#444', marginTop: 8 },
  count: { color: '#777', marginTop: 8, marginBottom: 16 },
  button: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  link: { color: '#1a1a2e', textAlign: 'center', marginTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  designCard: { width: '30%' },
  designImage: { width: '100%', aspectRatio: 1, borderRadius: 6, backgroundColor: '#eee' },
  designName: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  designPrice: { fontSize: 12, color: '#777' },
});
