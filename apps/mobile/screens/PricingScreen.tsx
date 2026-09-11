import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiClientError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { CreditPackageDto, SubscriptionPlanDto } from '../lib/types';

// Port of apps/web/app/pricing/page.tsx — GET /api/subscriptions/plans + /api/credits/packages,
// POST /api/subscriptions/subscribe + /api/credits/purchase. Closes A-023's §5 Pricing gap.
//
// Unlike web (window.location.href = approveUrl, a full-page redirect with no in-app return
// handling), React Native has no browser to redirect within — Linking.openURL hands the PayPal
// approval page to the system browser, same "no client-side confirmation step exists" gap web
// already has (the customer returns to the app manually; PayPal's webhook is what actually
// updates the subscription/credit balance, per this app's own AC-12 sync guarantee).
type Tab = 'subscriptions' | 'credits';

export function PricingScreen() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>('subscriptions');
  const [plans, setPlans] = useState<SubscriptionPlanDto[] | null>(null);
  const [packages, setPackages] = useState<CreditPackageDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<SubscriptionPlanDto[]>('/api/subscriptions/plans')
      .then(setPlans)
      .catch((e) => setError(e instanceof ApiClientError ? e.error.message : 'Could not load plans.'));
    apiFetch<CreditPackageDto[]>('/api/credits/packages')
      .then(setPackages)
      .catch((e) => setError(e instanceof ApiClientError ? e.error.message : 'Could not load credit packages.'));
  }, []);

  const publishedPlans = (plans ?? []).filter((p) => p.isPublished);
  const publishedPackages = (packages ?? []).filter((p) => p.isPublished);
  const loading = plans === null || packages === null;

  async function onSubscribe(planId: string) {
    setActionError(null);
    setBusyId(planId);
    try {
      const res = await apiFetch<{ approveUrl: string | null; clientSecret: string | null }>('/api/subscriptions/subscribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ planId, paymentMethod: 'paypal' }),
      });
      if (res.approveUrl) await Linking.openURL(res.approveUrl);
    } catch (e) {
      setActionError(e instanceof ApiClientError ? e.error.message : 'Subscribe failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function onBuyCredits(packageId: string) {
    setActionError(null);
    setBusyId(packageId);
    try {
      const res = await apiFetch<{ approveUrl: string | null; clientSecret: string | null }>('/api/credits/purchase', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ packageId, paymentMethod: 'paypal' }),
      });
      if (res.approveUrl) await Linking.openURL(res.approveUrl);
    } catch (e) {
      setActionError(e instanceof ApiClientError ? e.error.message : 'Purchase failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pricing</Text>
        <Text style={styles.subtitle}>Subscribe for monthly credits and perks, or buy a one-time credit package.</Text>
      </View>

      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === 'subscriptions' && styles.tabActive]} onPress={() => setTab('subscriptions')}>
          <Text style={[styles.tabText, tab === 'subscriptions' && styles.tabTextActive]}>Subscription Plans</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'credits' && styles.tabActive]} onPress={() => setTab('credits')}>
          <Text style={[styles.tabText, tab === 'credits' && styles.tabTextActive]}>Buy Credits</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

      {loading ? (
        <ActivityIndicator style={styles.center} />
      ) : tab === 'subscriptions' ? (
        publishedPlans.length === 0 ? (
          <Text style={styles.empty}>No subscription plans available right now.</Text>
        ) : (
          publishedPlans.map((plan) => (
            <View key={plan.id} style={[styles.card, plan.isBestValue && styles.cardBest]}>
              {plan.isBestValue && <Text style={styles.badge}>Best Value</Text>}
              <Text style={styles.cardTitle}>{plan.name}</Text>
              <Text style={styles.cardPrice}>Rs {plan.pricePkr} / {plan.billingPeriod === 'monthly' ? 'mo' : 'yr'}</Text>
              <Text style={styles.cardLine}>{plan.monthlyCredits} credits / month</Text>
              <Text style={styles.cardLine}>{plan.logoLimit === null ? 'Unlimited' : plan.logoLimit} logo downloads / month</Text>
              {plan.perks.map((perk, i) => (
                <Text key={i} style={styles.perk}>• {perk}</Text>
              ))}
              <Pressable style={styles.button} onPress={() => onSubscribe(plan.id)} disabled={busyId === plan.id}>
                {busyId === plan.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Subscribe</Text>}
              </Pressable>
            </View>
          ))
        )
      ) : publishedPackages.length === 0 ? (
        <Text style={styles.empty}>No credit packages available right now.</Text>
      ) : (
        publishedPackages.map((pkg) => (
          <View key={pkg.id} style={styles.card}>
            <Text style={styles.cardTitle}>{pkg.name}</Text>
            <Text style={styles.cardPrice}>Rs {pkg.pricePkr}</Text>
            <Text style={styles.cardLine}>{pkg.credits} credits{pkg.bonusCredits > 0 ? ` + ${pkg.bonusCredits} bonus` : ''}</Text>
            <Pressable style={styles.button} onPress={() => onBuyCredits(pkg.id)} disabled={busyId === pkg.id}>
              {busyId === pkg.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Buy Credits</Text>}
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { marginTop: 40 },
  header: { padding: 16, paddingBottom: 0 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#666', marginTop: 4 },
  tabs: { flexDirection: 'row', margin: 16, borderBottomWidth: 1, borderColor: '#eee' },
  tab: { paddingVertical: 10, paddingHorizontal: 16 },
  tabActive: { borderBottomWidth: 2, borderColor: '#1a1a2e' },
  tabText: { color: '#777', fontWeight: '600' },
  tabTextActive: { color: '#1a1a2e' },
  error: { color: '#c0392b', marginHorizontal: 16, marginBottom: 12 },
  empty: { textAlign: 'center', color: '#777', padding: 24 },
  card: { marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#eee' },
  cardBest: { borderColor: '#d4af37', backgroundColor: '#fdf8ea' },
  badge: { alignSelf: 'flex-start', backgroundColor: '#d4af37', color: '#1a1a2e', fontSize: 11, fontWeight: '700', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10, marginBottom: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardPrice: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  cardLine: { color: '#555', marginTop: 4 },
  perk: { color: '#555', marginTop: 2 },
  button: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
