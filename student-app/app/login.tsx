import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { invalidateCache } from '@/services/contentApi';
import { setAuth } from '@/services/studentAuthStore';

const LOGIN_API_BASE =
  Platform.OS === 'web'
    ? '/api/auth/student-login'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/auth/student-login';

// 150-ish: CRM'da admin biriktirgan login/parol bilan haqiqiy o'quvchi
// sifatida kirish ekrani. Bu — (tabs) navigatoridan alohida, ixtiyoriy
// modal sahifa: kirmagan holatda ham ilova avvalgidek "Namuna o'quvchi"
// tajribasini ko'rsatishda davom etadi (CRM'ning "O'quvchi ilovasi" ko'rib
// chiqish tabi shu bir xil /student/ manzilini ochadi, shuning uchun bu
// yerga majburiy yo'naltirish qo'yish CRM xodimlari uchun ilovani buzadi).
export default function LoginScreen() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!login.trim() || !password) {
      setError('Login va parolni kiriting');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(LOGIN_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login yoki parol noto\'g\'ri');
        setLoading(false);
        return;
      }
      await setAuth(data.token, data.student);
      invalidateCache();
      router.replace('/');
    } catch {
      setError('Internet aloqasini tekshiring');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={theme.colors.text} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="person-circle-outline" size={48} color={theme.colors.purple} />
        </View>
        <Text style={styles.title}>Hisobingizga kiring</Text>
        <Text style={styles.subtitle}>Login va parolni ustozingiz yoki ma'muriyatdan olishingiz mumkin.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Login</Text>
          <TextInput
            style={styles.input}
            placeholder="Login yoki telefon raqam"
            placeholderTextColor={theme.colors.textLight}
            value={login}
            onChangeText={setLogin}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Parol</Text>
          <TextInput
            style={styles.input}
            placeholder="Parol"
            placeholderTextColor={theme.colors.textLight}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable style={[styles.submitBtn, loading && styles.submitBtnDisabled]} disabled={loading} onPress={submit}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Kirish</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingVertical: 12 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8, alignItems: 'center' },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontFamily: theme.fonts.extraBold, fontSize: 22, color: theme.colors.text, marginBottom: 6, textAlign: 'center' },
  subtitle: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 10,
  },
  field: { width: '100%', marginBottom: 16 },
  label: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.text, marginBottom: 6 },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    color: theme.colors.text,
    ...theme.shadow.card,
  },
  errorText: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.danger, marginBottom: 12, textAlign: 'center' },
  submitBtn: {
    width: '100%',
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});
