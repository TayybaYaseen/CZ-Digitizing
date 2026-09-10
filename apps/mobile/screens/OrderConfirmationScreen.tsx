import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CartStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<CartStackParamList, 'OrderConfirmation'>;

export function OrderConfirmationScreen({ route }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thank you for your order!</Text>
      <Text style={styles.note}>Order #{route.params.orderId} has been placed. You can track it under Account → Orders.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  note: { textAlign: 'center', color: '#555' },
});
