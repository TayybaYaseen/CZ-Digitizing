import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '../../lib/locale-context';

// Port of the language-selector part of apps/web's header (docs/specs/2026-08-28-16-
// internationalization.md, aspect A-021) — same /api/languages + setLocale() contract via
// LocaleProvider, adapted to a dedicated mobile screen (AC-1's "Language selection" route).
export function LanguageSelectScreen() {
  const { locale, languages, setLocale } = useLocale();

  return (
    <View style={styles.container}>
      <FlatList
        data={languages}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => setLocale(item.code)}>
            <Text style={styles.name}>{item.name}</Text>
            {item.code === locale ? <Text style={styles.check}>✓</Text> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  name: { fontSize: 16 },
  check: { color: '#1a1a2e', fontWeight: '700' },
});
