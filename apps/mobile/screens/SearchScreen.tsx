import { useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiClientError, apiFetch } from '../lib/api-client';
import type { DesignSummaryDto } from '../lib/types';
import type { SearchStackParamList } from '../navigation/types';

// Port of apps/web/app/search/page.tsx — GET /api/designs?q=<query>.
type Props = NativeStackScreenProps<SearchStackParamList, 'Search'>;

export function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DesignSummaryDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<DesignSummaryDto[]>(`/api/designs?q=${encodeURIComponent(query)}&page=1&pageSize=20`);
      setResults(data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.error.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput style={styles.input} placeholder="Search designs" value={query} onChangeText={setQuery} onSubmitEditing={onSearch} returnKeyType="search" />
        <Pressable style={styles.searchButton} onPress={onSearch}>
          <Text style={styles.searchButtonText}>Go</Text>
        </Pressable>
      </View>
      {loading && <ActivityIndicator style={styles.center} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {results && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListEmptyComponent={<Text style={styles.empty}>No results for "{query}".</Text>}
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
  searchBar: { flexDirection: 'row', padding: 12, gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  searchButton: { backgroundColor: '#1a1a2e', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  searchButtonText: { color: '#fff', fontWeight: '600' },
  center: { marginTop: 20 },
  error: { color: '#c0392b', padding: 16, textAlign: 'center' },
  empty: { padding: 24, textAlign: 'center', color: '#777' },
  card: { flex: 1, margin: 8, maxWidth: '46%' },
  image: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#eee' },
  name: { marginTop: 6, fontWeight: '600' },
});
