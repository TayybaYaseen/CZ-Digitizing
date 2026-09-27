import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Pressable } from 'react-native';
import { apiFetch } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { useApiQuery } from '../../lib/use-api-query';
import { OfflineBanner } from '../../components/OfflineBanner';
import type { NotificationPreferenceDto } from '../../lib/types';

function humanize(value: string) {
  return value.replace(/_/g, ' ');
}

// docs/specs/2026-08-28-02-notifications-system.md AC-9 — mobile counterpart to
// apps/web/app/account/notifications/settings/page.tsx. Same GET/PUT /api/notifications/preferences
// contract, and — since a mobile OS has its own separate push permission the app can't override —
// this screen also surfaces that OS-level toggle (read-only here; changed only via OS Settings)
// distinctly from the app-level per-type/per-channel preferences below it.
export function NotificationSettingsScreen() {
  const { accessToken } = useAuth();
  const query = useApiQuery<NotificationPreferenceDto[]>('/api/notifications/preferences');
  const [preferences, setPreferences] = useState<NotificationPreferenceDto[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [osPushEnabled, setOsPushEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (query.status === 'success') setPreferences(query.data);
  }, [query.status, query.data]);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => setOsPushEnabled(status === 'granted'));
  }, []);

  const toggle = useCallback((notificationType: string, channel: string) => {
    setPreferences((prev) =>
      prev?.map((p) => (p.notificationType === notificationType && p.channel === channel ? { ...p, enabled: !p.enabled } : p)) ?? null,
    );
  }, []);

  async function onSave() {
    if (!preferences) return;
    setSaving(true);
    setSaveError(false);
    try {
      await apiFetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ preferences }),
      });
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  const grouped = preferences
    ? Array.from(new Set(preferences.map((p) => p.notificationType))).map((type) => ({
        type,
        entries: preferences.filter((p) => p.notificationType === type),
      }))
    : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <OfflineBanner />

      <View style={styles.osSection}>
        <Text style={styles.osTitle}>Push notifications (device setting)</Text>
        <Text style={styles.osStatus}>{osPushEnabled === null ? 'Checking…' : osPushEnabled ? 'Enabled' : 'Disabled'}</Text>
        {osPushEnabled === false && (
          <Pressable style={styles.osButton} onPress={() => Linking.openSettings()}>
            <Text style={styles.osButtonText}>Open device settings</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.sectionTitle}>Notification preferences</Text>
      <Text style={styles.sectionSubtitle}>Choose which channels you want to hear from us on, per notification type.</Text>

      {query.status === 'loading' && <ActivityIndicator style={styles.center} />}
      {query.status === 'error' && <Text style={styles.error}>Could not load your preferences.</Text>}
      {saveError && <Text style={styles.error}>Could not save your preferences. Please try again.</Text>}

      {preferences &&
        grouped.map(({ type, entries }) => (
          <View key={type} style={styles.typeGroup}>
            <Text style={styles.typeLabel}>{humanize(type)}</Text>
            {entries.map((entry) => (
              <View key={`${entry.notificationType}:${entry.channel}`} style={styles.channelRow}>
                <Text style={styles.channelLabel}>{humanize(entry.channel)}</Text>
                <Switch value={entry.enabled} onValueChange={() => toggle(entry.notificationType, entry.channel)} />
              </View>
            ))}
          </View>
        ))}

      {preferences && (
        <Pressable style={styles.saveButton} onPress={onSave} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save preferences'}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  center: { marginTop: 24 },
  error: { color: '#c0392b', marginTop: 8 },
  osSection: { padding: 12, borderRadius: 8, backgroundColor: '#f5f6ff', marginBottom: 20 },
  osTitle: { fontWeight: '600' },
  osStatus: { color: '#555', marginTop: 2 },
  osButton: { marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#1a1a2e', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  osButtonText: { color: '#1a1a2e', fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionSubtitle: { color: '#666', marginTop: 4, marginBottom: 12 },
  typeGroup: { marginBottom: 16, borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 12 },
  typeLabel: { fontWeight: '600', marginBottom: 6, textTransform: 'capitalize' },
  channelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  channelLabel: { color: '#333', textTransform: 'capitalize' },
  saveButton: { marginTop: 8, backgroundColor: '#1a1a2e', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
