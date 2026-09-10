import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApiQuery } from '../lib/use-api-query';
import { OfflineBanner } from '../components/OfflineBanner';
import type { CategoryDto } from '../lib/types';
import type { CategoriesStackParamList } from '../navigation/types';

// Port of apps/web/app/categories/page.tsx — GET /api/categories.
type Props = NativeStackScreenProps<CategoriesStackParamList, 'Categories'>;

export function CategoriesScreen({ navigation }: Props) {
  const query = useApiQuery<CategoryDto[]>('/api/categories');

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {query.status === 'loading' && <ActivityIndicator style={styles.center} />}
      {query.status === 'error' && <Text style={styles.error}>Something went wrong loading categories.</Text>}
      {query.status === 'offline' && <Text style={styles.error}>You're offline.</Text>}
      {query.status === 'success' && (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('CategoryDesigns', { categorySlug: item.slug, categoryName: item.name })}>
              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.thumb} /> : <View style={styles.thumb} />}
              <Text style={styles.name}>{item.name}</Text>
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
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#eee', marginRight: 12 },
  name: { fontSize: 16, fontWeight: '600' },
});
