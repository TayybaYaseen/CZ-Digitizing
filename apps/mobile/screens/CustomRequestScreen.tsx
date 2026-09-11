import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CustomRequestDto, CustomRequestType } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { MoreStackParamList } from '../navigation/types';

// Port of apps/web/app/custom-request/page.tsx — POST /api/custom-requests, multipart (aspect
// A-017 AC-1). Reachable only from inside CustomerTabs (already login-gated by RootNavigator —
// unlike web, no separate "requires auth" redirect is needed here). Closes A-023's §5 Custom
// Design Request gap.
type Props = NativeStackScreenProps<MoreStackParamList, 'CustomRequestNew'>;

const REQUEST_TYPES: { value: CustomRequestType; label: string }[] = [
  { value: 'embroidery_custom', label: 'Embroidery digitizing' },
  { value: 'vector_custom', label: 'Vector art' },
];

export function CustomRequestScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const [requestType, setRequestType] = useState<CustomRequestType>('embroidery_custom');
  const [sizeValue, setSizeValue] = useState('');
  const [machineFormat, setMachineFormat] = useState('');
  const [fabricType, setFabricType] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [references, setReferences] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<CustomRequestDto | null>(null);

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) setImage(result.assets[0]);
  }

  async function pickReferences() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsMultipleSelection: true });
    if (!result.canceled) setReferences(result.assets.slice(0, 10));
  }

  function asFormFile(asset: ImagePicker.ImagePickerAsset, fallbackName: string) {
    return { uri: asset.uri, name: asset.fileName ?? fallbackName, type: asset.mimeType ?? 'image/jpeg' } as unknown as Blob;
  }

  async function onSubmit() {
    setError(null);
    if (!machineFormat.trim()) {
      setError('Machine format is required.');
      return;
    }
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('requestType', requestType);
      if (sizeValue) body.append('sizeValue', sizeValue);
      body.append('machineFormat', machineFormat);
      if (fabricType) body.append('fabricType', fabricType);
      if (specialInstructions) body.append('specialInstructions', specialInstructions);
      if (image) body.append('image', asFormFile(image, 'design.jpg'));
      references.forEach((ref, i) => body.append('references', asFormFile(ref, `reference-${i}.jpg`)));

      const created = await apiFetch<CustomRequestDto>('/api/custom-requests', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body,
      });
      setSubmitted(created);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.error.message : 'Could not submit your custom request.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Custom request received</Text>
        <Text style={styles.note}>
          Your request #{submitted.requestNumber} is in our review queue. We'll follow up with a quote soon.
        </Text>
        <Pressable onPress={() => (navigation as { navigate: (...args: unknown[]) => void }).navigate('AccountTab', { screen: 'CustomRequests' })}>
          <Text style={styles.link}>Track it in My Account</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Custom Design Request</Text>
      <Text style={styles.subtitle}>Upload your logo/artwork and tell us the details — we'll digitize or vectorize it and send you a quote.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>Request type</Text>
      <View style={styles.typeRow}>
        {REQUEST_TYPES.map((t) => (
          <Pressable key={t.value} style={[styles.typeChip, requestType === t.value && styles.typeChipSelected]} onPress={() => setRequestType(t.value)}>
            <Text style={requestType === t.value ? styles.typeChipTextSelected : styles.typeChipText}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Logo / artwork *</Text>
      <Pressable style={styles.secondaryButton} onPress={pickImage}>
        <Text style={styles.secondaryButtonText}>{image ? 'Change image' : 'Choose image'}</Text>
      </Pressable>

      <Text style={styles.label}>Additional reference images</Text>
      <Pressable style={styles.secondaryButton} onPress={pickReferences}>
        <Text style={styles.secondaryButtonText}>{references.length > 0 ? `${references.length} selected` : 'Choose images'}</Text>
      </Pressable>

      <TextInput style={styles.input} placeholder="Size (e.g. 4x4in)" value={sizeValue} onChangeText={setSizeValue} />
      <TextInput style={styles.input} placeholder="Machine format (e.g. DST) *" value={machineFormat} onChangeText={setMachineFormat} />
      <TextInput style={styles.input} placeholder="Fabric (optional)" value={fabricType} onChangeText={setFabricType} />
      <TextInput style={[styles.input, styles.multiline]} placeholder="Special instructions" multiline value={specialInstructions} onChangeText={setSpecialInstructions} />

      <Pressable style={styles.button} onPress={onSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit Request</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#666', marginTop: 4, marginBottom: 16 },
  note: { textAlign: 'center', color: '#555', marginTop: 12 },
  link: { color: '#1a1a2e', textAlign: 'center', marginTop: 16, textDecorationLine: 'underline' },
  error: { color: '#c0392b', marginBottom: 12 },
  label: { fontWeight: '600', marginBottom: 6, marginTop: 4 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeChip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  typeChipSelected: { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' },
  typeChipText: { color: '#1a1a2e' },
  typeChipTextSelected: { color: '#fff' },
  secondaryButton: { borderWidth: 1, borderColor: '#1a1a2e', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 12 },
  secondaryButtonText: { color: '#1a1a2e', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 10 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  button: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
