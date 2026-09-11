import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { FaqDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '../lib/api-client';
import type { ServiceDetailDto } from '../lib/types';
import type { MoreStackParamList } from '../navigation/types';

// Port of apps/web/components/ServiceDetail.tsx — GET /api/services/:slug (shared by both a main
// service and a sub-service, resolved flat), plus its related-FAQs and related-category lookups.
// Closes A-023's §5 Services gap.
type Props = NativeStackScreenProps<MoreStackParamList, 'ServiceDetail'>;

export function ServiceDetailScreen({ route, navigation }: Props) {
  const { slug } = route.params;
  const [service, setService] = useState<ServiceDetailDto | null>(null);
  const [faqs, setFaqs] = useState<FaqDto[]>([]);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  useEffect(() => {
    setService(null);
    setError(null);
    apiFetch<ServiceDetailDto>(`/api/services/${slug}`)
      .then(setService)
      .catch((e) => setError(e instanceof ApiClientError ? e.error.message : 'Could not load this service.'));
  }, [slug]);

  useEffect(() => {
    if (!service || service.relatedFaqIds.length === 0) {
      setFaqs([]);
      return;
    }
    Promise.all(service.relatedFaqIds.map((id) => apiFetch<FaqDto>(`/api/faqs/${id}`).catch(() => null)))
      .then((rows) => setFaqs(rows.filter((r): r is FaqDto => r !== null)));
  }, [service]);

  useEffect(() => {
    if (!service?.relatedDesignCategoryId) {
      setCategorySlug(null);
      return;
    }
    apiFetch<{ slug: string; name: string }>(`/api/categories/${service.relatedDesignCategoryId}`)
      .then((c) => setCategorySlug(c.slug))
      .catch(() => setCategorySlug(null));
  }, [service?.relatedDesignCategoryId]);

  if (error) return <View style={styles.container}><Text style={styles.error}>{error}</Text></View>;
  if (!service) return <ActivityIndicator style={styles.center} />;

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: service.visualImageUrl }} style={styles.image} />
      <View style={styles.body}>
        <Text style={styles.title}>{service.name}</Text>
        <Text style={styles.description}>{service.description}</Text>

        {service.subServices && service.subServices.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sub-categories</Text>
            <View style={styles.subGrid}>
              {service.subServices.map((sub) => (
                <Pressable key={sub.id} style={styles.subChip} onPress={() => navigation.push('ServiceDetail', { slug: sub.slug })}>
                  <Text style={styles.subChipText}>{sub.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Applications</Text>
          <Text style={styles.sectionBody}>{service.applications}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our process</Text>
          <Text style={styles.sectionBody}>{service.process}</Text>
        </View>

        {faqs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>FAQs</Text>
            {faqs.map((f) => (
              <Pressable key={f.id} style={styles.faqRow} onPress={() => setOpenFaqId(openFaqId === f.id ? null : f.id)}>
                <Text style={styles.faqQuestion}>{f.question}</Text>
                {openFaqId === f.id && <Text style={styles.faqAnswer}>{f.answer}</Text>}
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          <Pressable style={styles.button} onPress={() => navigation.navigate('Quote', { serviceSlug: service.slug })}>
            <Text style={styles.buttonText}>Get a Quote</Text>
          </Pressable>
          {categorySlug && (
            <Pressable
              style={styles.secondaryButton}
              onPress={() =>
                (navigation as { navigate: (...args: unknown[]) => void }).navigate('CategoriesTab', {
                  screen: 'CategoryDesigns',
                  params: { categorySlug, categoryName: service.name },
                })
              }
            >
              <Text style={styles.secondaryButtonText}>Browse pre-made designs</Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { marginTop: 40 },
  error: { color: '#c0392b', padding: 16, textAlign: 'center' },
  image: { width: '100%', aspectRatio: 2, backgroundColor: '#eee' },
  body: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  description: { color: '#444', marginTop: 8 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  sectionBody: { color: '#444' },
  subGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subChip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  subChipText: { fontSize: 13 },
  faqRow: { borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 10 },
  faqQuestion: { fontWeight: '600', color: '#1a1a2e' },
  faqAnswer: { color: '#444', marginTop: 6 },
  actions: { marginTop: 24, marginBottom: 8, gap: 10 },
  button: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { borderWidth: 1, borderColor: '#1a1a2e', borderRadius: 8, padding: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#1a1a2e', fontWeight: '600' },
});
