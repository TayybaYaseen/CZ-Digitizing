import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useApiQuery } from '../lib/use-api-query';
import { OfflineBanner } from '../components/OfflineBanner';
import type { DesignSummaryDto } from '../lib/types';
import type { HomeStackParamList, RootTabParamList } from '../navigation/types';
import { colors, fonts, radius, space } from '../lib/theme';

// docs/specs/2026-08-29-18-mobile-app-android-ios.md §5 Route(s): Home. Thin screen over the same
// /api/designs listing apps/web's Home page uses (docs/specs/2026-08-28-13-home-promotions-cms.md
// owns the home-sections business logic; this reuses its API one-for-one, no new logic).
//
// The "Get a Quote" CTA below is this screen's only cross-tab navigation call (Home's own stack
// only knows DesignDetail/Cart — Quote lives under MoreTab per navigation/types.ts's own comment on
// why Services/Bundles/Pricing/Quote are grouped there). CompositeScreenProps + getParent() is the
// standard React Navigation pattern for reaching a screen outside the current stack; every other
// screen in this app stays single-stack, so this is deliberately the one exception, not a new norm.
type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'Home'>,
  { navigation: BottomTabNavigationProp<RootTabParamList> }
>;

const FEATURED_COUNT = 6;

export function HomeScreen({ navigation }: Props) {
  const query = useApiQuery<DesignSummaryDto[]>('/api/designs?page=1&pageSize=20');
  const featured = query.status === 'success' ? query.data.slice(0, FEATURED_COUNT) : [];

  function openDesign(designId: string) {
    navigation.navigate('DesignDetail', { designId });
  }

  function goToQuote() {
    navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()?.navigate('MoreTab', { screen: 'Quote' } as never);
  }

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {query.status === 'loading' && <ActivityIndicator style={styles.center} />}
      {query.status === 'error' && <Text style={styles.error}>Something went wrong loading designs.</Text>}
      {query.status === 'offline' && <Text style={styles.error}>You're offline.</Text>}
      {query.status === 'success' && (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          numColumns={2}
          refreshControl={<RefreshControl refreshing={false} onRefresh={query.refetch} />}
          ListHeaderComponent={
            <View>
              <View style={styles.hero}>
                <Text style={styles.heroEyebrow}>MACHINE EMBROIDERY DESIGN</Text>
                <Text style={styles.heroTitle}>Your Vision, Our Stitches</Text>
                <Text style={styles.heroBody}>
                  Logo, cap &amp; hat, 3D puff and vector art — turned into machine-ready files.
                </Text>
                <Pressable style={styles.heroCta} onPress={goToQuote}>
                  <Text style={styles.heroCtaText}>Get a Quote</Text>
                </Pressable>
              </View>

              {featured.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Featured Designs</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.featuredRow} contentContainerStyle={{ paddingRight: space[4] }}>
                    {featured.map((item) => (
                      <Pressable key={item.id} style={styles.featuredCard} onPress={() => openDesign(item.id)}>
                        <Image source={{ uri: item.previewImageUrl }} style={styles.featuredImage} />
                        <Text style={styles.featuredName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.price}>PKR {item.salePricePkr ?? item.pricePkr}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={styles.sectionTitle}>All Designs</Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>No designs yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => openDesign(item.id)}>
              <Image source={{ uri: item.previewImageUrl }} style={styles.image} />
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.price}>PKR {item.salePricePkr ?? item.pricePkr}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray100 },
  center: { marginTop: 40 },
  error: { color: '#c0392b', padding: 16, textAlign: 'center' },
  empty: { padding: 24, textAlign: 'center', color: colors.gray600 },

  hero: {
    margin: space[4],
    marginBottom: space[5],
    borderRadius: radius.xl,
    backgroundColor: colors.navy800,
    padding: space[5],
  },
  heroEyebrow: { color: colors.gold400, fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  heroTitle: { color: colors.white, fontFamily: fonts.display, fontWeight: '700', fontSize: 24, marginTop: space[2], lineHeight: 30 },
  heroBody: { color: 'rgba(250,250,250,.7)', fontSize: 13, lineHeight: 19, marginTop: space[2] },
  heroCta: { alignSelf: 'flex-start', backgroundColor: colors.gold500, borderRadius: radius.button, paddingVertical: 10, paddingHorizontal: space[5], marginTop: space[4] },
  heroCtaText: { color: colors.navy800, fontWeight: '700', fontSize: 13 },

  sectionTitle: { fontFamily: fonts.display, fontWeight: '700', fontSize: 17, color: colors.navy800, marginHorizontal: space[4], marginBottom: space[2] },

  featuredRow: { marginBottom: space[5] },
  featuredCard: { width: 132, marginLeft: space[4] },
  featuredImage: { width: '100%', aspectRatio: 1, borderRadius: radius.card, backgroundColor: colors.gray300 },
  featuredName: { marginTop: space[2], fontWeight: '600', fontSize: 12.5, color: colors.navy800 },

  card: { flex: 1, margin: space[2], maxWidth: '46%' },
  image: { width: '100%', aspectRatio: 1, borderRadius: radius.card, backgroundColor: colors.gray300 },
  name: { marginTop: space[2], fontWeight: '600', color: colors.navy800 },
  price: { color: colors.gold700, fontFamily: fonts.display, fontWeight: '700', marginTop: 2 },
});
