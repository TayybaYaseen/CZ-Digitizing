import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

interface Props extends Omit<TextInputProps, 'secureTextEntry' | 'style'> {
  // AdminLoginScreen/AdminTwoFactorScreen use a dark theme with white input text — the toggle
  // needs a matching color rather than the default dark-on-light styling.
  dark?: boolean;
}

// Shared by every password field (Login, Register, Reset Password, Admin Login) — a plain text
// glyph toggle rather than a new icon-library dependency, consistent with the rest of this app's
// buttons/links (see e.g. LoginScreen's "Create an account" Pressable).
export function PasswordInput({ dark, testID, ...inputProps }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrapper}>
      <TextInput
        style={[styles.input, dark && styles.inputDark]}
        secureTextEntry={!visible}
        testID={testID}
        {...inputProps}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        testID={testID ? `${testID}-toggle` : undefined}
      >
        <Text style={[styles.toggleText, dark && styles.toggleTextDark]}>{visible ? 'Hide' : 'Show'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', justifyContent: 'center', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, paddingRight: 56 },
  inputDark: { borderColor: '#444', color: '#fff' },
  toggle: { position: 'absolute', right: 12 },
  toggleText: { color: '#1a1a2e', fontWeight: '600', fontSize: 13 },
  toggleTextDark: { color: '#d4af37' },
});
