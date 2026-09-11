import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '../../navigation/types';

// docs/specs/2026-08-29-18-mobile-app-android-ios.md §5 Route(s): Services, Bundles, Pricing, Get
// a Quote, Custom Request — none of these are persistent-tab content on web (top-level links, not
// nav items), so this hub screen behind a 6th "More" tab is the mobile-appropriate home for them,
// following the same hub-plus-links pattern as AccountScreen.
type Props = NativeStackScreenProps<MoreStackParamList, 'More'>;

const LINKS: { label: string; description: string; onPress: (nav: Props['navigation']) => void }[] = [
  { label: 'Services', description: 'Embroidery Digitizing & Vector Art', onPress: (nav) => nav.navigate('Services') },
  { label: 'Design Bundles', description: 'Themed collections at a bundle price', onPress: (nav) => nav.navigate('Bundles') },
  { label: 'Pricing', description: 'Subscriptions & credit packages', onPress: (nav) => nav.navigate('Pricing') },
  { label: 'Get a Quote', description: 'Guided quote for your project', onPress: (nav) => nav.navigate('Quote', undefined) },
  { label: 'Custom Design Request', description: 'Upload artwork for a custom quote', onPress: (nav) => nav.navigate('CustomRequestNew') },
];

export function MoreScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      {LINKS.map((link) => (
        <Pressable key={link.label} style={styles.row} onPress={() => link.onPress(navigation)}>
          <Text style={styles.label}>{link.label}</Text>
          <Text style={styles.description}>{link.description}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  row: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  label: { fontSize: 16, fontWeight: '600' },
  description: { color: '#777', marginTop: 2, fontSize: 13 },
});
