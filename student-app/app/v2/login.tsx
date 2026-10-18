/**
 * v2 Kirish ekrani (dizayn: 01 · Kirish).
 *
 * Login mantig'i eski `app/login.tsx` bilan bir xil: o'sha API, o'sha
 * token saqlash joyi. Shuning uchun v2'da kirgan o'quvchi eski ilovada
 * ham kirgan hisoblanadi va aksincha.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Input, V2Text } from '@/components/v2';
import { colors, radius } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';
import { invalidateCache } from '@/services/contentApi';
import { loadLessonProgress } from '@/services/lessonProgressStore';
import { setAuth } from '@/services/studentAuthStore';

const LOGIN_API =
  Platform.OS === 'web'
    ? '/api/auth/student-login'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/auth/student-login';

const domik = require('@/assets/images/v2/domik-wave.png');

type Tile = { char: string; bg: string; fg: string; left: number; top: number; size: number; rotate: string; round?: boolean };

// Kurs tiliga qarab: Domwork (rus) yoki Homework (ingliz).
const BRAND = {
  russian: {
    name: 'Domwork',
    tagline: 'Rus tilida 0 dan\nerkin suhbatgacha',
    hello: 'Привет!',
    letters: ['Ж', 'Я', 'Ё', 'Щ'],
  },
  english: {
    name: 'Homework',
    tagline: 'Ingliz tilida 0 dan\nerkin suhbatgacha',
    hello: 'Hello!',
    letters: ['W', 'Q', 'Th', 'R'],
  },
} as const;

export default function V2Login() {
  const insets = useSafeAreaInsets();
  const { courseLang } = useLang();
  const brand = BRAND[courseLang === 'russian' ? 'russian' : 'english'];
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tiles: Tile[] = [
    { char: brand.letters[0], bg: colors.surface, fg: colors.cobalt, left: 18, top: 70, size: 78, rotate: '-10deg' },
    { char: brand.letters[1], bg: colors.sunflower, fg: colors.ink, left: 292, top: 58, size: 74, rotate: '8deg', round: true },
    { char: brand.letters[2], bg: colors.streak, fg: colors.ink, left: 30, top: 196, size: 70, rotate: '9deg' },
    { char: brand.letters[3], bg: colors.ink, fg: colors.textOnDark, left: 300, top: 186, size: 72, rotate: '-8deg' },
  ];

  const submit = async () => {
    if (!login.trim() || !password) {
      setError('Login va parolni kiriting');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(LOGIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Login yoki parol noto'g'ri");
        setLoading(false);
        return;
      }
      invalidateCache();
      await setAuth(data.token, data.student);
      await loadLessonProgress(true);
      invalidateCache();
      router.replace('/v2');
    } catch {
      setError('Internet aloqasini tekshiring');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={[styles.hero, { paddingTop: insets.top }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.stage}>
            {tiles.map((t) => (
              <View
                key={t.char}
                style={[
                  styles.tile,
                  {
                    left: t.left,
                    top: t.top,
                    width: t.size,
                    height: t.size,
                    borderRadius: t.round ? t.size / 2 : 22,
                    backgroundColor: t.bg,
                    transform: [{ rotate: t.rotate }],
                  },
                ]}
              >
                <V2Text variant="hero" color={t.fg} cyrillic={courseLang === 'russian'} style={{ fontSize: t.size * 0.56, lineHeight: t.size * 0.66 }}>
                  {t.char}
                </V2Text>
              </View>
            ))}
            <Image source={domik} style={styles.mascot} resizeMode="contain" />
            <View style={styles.bubble}>
              <V2Text variant="subheading" cyrillic={courseLang === 'russian'} style={{ fontSize: 18 }}>
                {brand.hello}
              </V2Text>
            </View>
            <V2Text variant="hero" color={colors.textOnDark} style={styles.tagline}>
              {brand.tagline}
            </V2Text>
          </View>
        </View>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <V2Text variant="subheading" color={colors.textOnDark} style={{ fontSize: 18 }}>
                {brand.name[0]}
              </V2Text>
            </View>
            <View>
              <V2Text variant="subheading" accessibilityRole="header">{brand.name}</V2Text>
              <V2Text variant="caption" color={colors.textMuted}>Hisobingizga kiring</V2Text>
            </View>
          </View>

          <Input
            label="Login"
            placeholder="Login yoki telefon raqam"
            value={login}
            onChangeText={(v) => { setLogin(v); setError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            returnKeyType="next"
          />
          <Input
            label="Parol"
            placeholder="Parolingiz"
            value={password}
            onChangeText={(v) => { setPassword(v); setError(null); }}
            secure
            autoCapitalize="none"
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={submit}
            error={error ?? undefined}
          />

          <Button label="Kirish" onPress={submit} loading={loading} style={{ marginTop: 4 }} />

          <View style={styles.help}>
            <V2Text variant="bodySmall" color={colors.textMuted}>
              Login va parolni ustozingiz yoki menejeringizdan olasiz.
            </V2Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cobalt },
  hero: { alignItems: 'center' },
  stage: { width: 390, height: 380, position: 'relative' },
  tile: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  mascot: { position: 'absolute', left: 105, top: 62, width: 190, height: 205 },
  bubble: {
    position: 'absolute',
    left: 236,
    top: 46,
    height: 38,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 19,
    borderTopRightRadius: 19,
    borderBottomRightRadius: 19,
    borderBottomLeftRadius: 4,
  },
  tagline: { position: 'absolute', left: 30, right: 30, top: 300 },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 14,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  help: { marginTop: 'auto', backgroundColor: colors.bg, borderRadius: radius.lg, padding: 16 },
});
