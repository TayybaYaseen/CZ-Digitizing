import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApiQuery } from '../lib/use-api-query';
import { OfflineBanner } from '../components/OfflineBanner';
import type { DesignSummaryDto } from '../lib/types';
import type { CategoriesStackParamList } from '../navigation/types';

// Port of apps/web/app/categories/[slug]/page.tsx — GET /api/designs?category=<slug>.
type Props = NativeStackScreenProps<CategoriesStackParamList, 'CategoryDesigns'>;

export function CategoryDesignsScreen({ route, navigation }: Props) {
  const { categorySlug } = route.params;
  const query = useApiQuery<DesignSummaryDto[]>(`/api/designs?category=${encodeURIComponent(categorySlug)}&page=1&pageSize=20`);

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {query.status === 'loading' && <ActivityIndicator style={styles.center} />}
      {query.status === 'error' && <Text style={styles.error}>Something went wrong loading designs.</Text>}
      {query.status === 'success' && (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListEmptyComponent={<Text style={styles.empty}>No designs in this category yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => navigation.navigate('DesignDetail', { designId: item.id })}>
              <Image source={{ uri: item.previewImageUrl }} style={styles.image} />
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
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
  card: { flex: 1, margin: 8, maxWidth: '46%' },
  image: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#eee' },
  name: { marginTop: 6, fontWeight: '600' },
});
