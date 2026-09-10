import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiClientError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { HomeStackParamList } from '../navigation/types';

// Mirrors apps/api/src/designs/dto/design.dto.ts's DesignDetailDto (same shape apps/web/app/
// designs/[id]/page.tsx consumes).
interface DesignDetailDto {
  id: string;
  name: string;
  description: string | null;
  previewImageUrl: string;
  pricePkr: number;
  salePricePkr: number | null;
  sizes: { id: string; label: string }[];
}

type Props = NativeStackScreenProps<HomeStackParamList, 'DesignDetail'>;

// docs/specs/2026-08-29-18-mobile-app-android-ios.md §5 Route(s): Design Detail. Thin screen over
// GET /api/designs/:id + POST /api/cart/items — same contract as apps/web's page, no new logic.
export function DesignDetailScreen({ route, navigation }: Props) {
  const { designId } = route.params;
  const { accessToken } = useAuth();
  const [design, setDesign] = useState<DesignDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    apiFetch<DesignDetailDto>(`/api/designs/${designId}`)
      .then((d) => {
        setDesign(d);
        setSelectedSizeId(d.sizes[0]?.id ?? null);
      })
      .catch((e) => setError(e instanceof ApiClientError ? e.error.message : 'Failed to load this design.'));
    apiFetch(`/api/designs/${designId}/view`, { method: 'POST', headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} }).catch(() => {});
  }, [designId, accessToken]);

  async function onAddToCart() {
    if (!selectedSizeId) return;
    setAdding(true);
    try {
      await apiFetch('/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({ designId, sizeId: selectedSizeId, quantity: 1 }),
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      setAdded(true);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.error.message : 'Could not add this item to your cart.');
    } finally {
      setAdding(false);
    }
  }

  if (error) return <View style={styles.container}><Text style={styles.error}>{error}</Text></View>;
  if (!design) return <ActivityIndicator style={styles.center} />;

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: design.previewImageUrl }} style={styles.image} />
      <View style={styles.body}>
        <Text style={styles.title}>{design.name}</Text>
        <Text style={styles.price}>PKR {design.salePricePkr ?? design.pricePkr}</Text>
        {design.description ? <Text style={styles.description}>{design.description}</Text> : null}
        {design.sizes.length > 0 && (
          <View style={styles.sizes}>
            {design.sizes.map((size) => (
              <Pressable key={size.id} style={[styles.sizeChip, selectedSizeId === size.id && styles.sizeChipSelected]} onPress={() => setSelectedSizeId(size.id)}>
                <Text style={selectedSizeId === size.id ? styles.sizeTextSelected : styles.sizeText}>{size.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Pressable style={styles.button} onPress={onAddToCart} disabled={adding || !selectedSizeId}>
          {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{added ? 'Added ✓' : 'Add to cart'}</Text>}
        </Pressable>
        {added ? (
          <Pressable onPress={() => navigation.navigate('Cart')}>
            <Text style={styles.link}>View cart</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { marginTop: 40 },
  error: { color: '#c0392b', padding: 16, textAlign: 'center' },
  image: { width: '100%', aspectRatio: 1, backgroundColor: '#eee' },
  body: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  price: { fontSize: 18, color: '#1a1a2e', marginTop: 4, marginBottom: 12 },
  description: { color: '#444', marginBottom: 12 },
  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  sizeChip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, marginRight: 8, marginBottom: 8 },
  sizeChipSelected: { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' },
  sizeText: { color: '#1a1a2e' },
  sizeTextSelected: { color: '#fff' },
  button: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  link: { color: '#1a1a2e', textAlign: 'center', marginTop: 12 },
});
