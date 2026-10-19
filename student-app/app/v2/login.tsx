/**
 * v2 Kirish ekrani (dizayn: Login.dc.html).
 *
 * Login mantig'i eski `app/login.tsx` bilan bir xil: o'sha API, o'sha
 * token saqlash joyi. Kirgandan keyin onboarding shu qurilmada hali
 * o'tilmagan bo'lsa — Onboarding'ga, aks holda Bosh sahifaga.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronRightIcon, EyeIcon, SendOutlineIcon } from '@/components/v2/home/icons';
import { isOnboarded, supportUrl } from '@/components/v2/home/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';
import { invalidateCache } from '@/services/contentApi';
import { loadLessonProgress } from '@/services/lessonProgressStore';
import { setAuth } from '@/services/studentAuthStore';

const LOGIN_API =
  Platform.OS === 'web'
    ? '/api/auth/student-login'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/auth/student-login';

// Kurs tiliga qarab: Domwork (rus) yoki Homework (ingliz).
const BRAND = {
  russian: { name: 'Domwork', tagline: 'Rus tilida 0 dan\nerkin suhbatgacha', hello: 'Приве́т!', letters: ['Ж', 'Я', 'Ё', 'Щ'], cyr: true },
  english: { name: 'Homework', tagline: 'Ingliz tilida 0 dan\nerkin suhbatgacha', hello: 'Hello!', letters: ['W', 'Q', 'Th', 'R'], cyr: false },
} as const;

const TILES = [
  { left: 18, top: 70, size: 78, radius: 24, bg: '#FFFFFF', fg: '#2F5BFF', rotate: '-10deg', font: 46 },
  { left: 292, top: 58, size: 74, radius: 37, bg: '#FFC93C', fg: '#0B1220', rotate: '8deg', font: 42 },
  { left: 30, top: 196, size: 70, radius: 22, bg: '#FF7A1A', fg: '#0B1220', rotate: '9deg', font: 40 },
  { left: 300, top: 186, size: 72, radius: 22, bg: '#0B1220', fg: '#FFFFFF', rotate: '-8deg', font: 42 },
];

export default function V2Login() {
  const insets = useSafeAreaInsets();
  const { courseLang } = useLang();
  const brand = BRAND[courseLang === 'russian' ? 'russian' : 'english'];
  // Webda display steki kirill va urg'u belgisini o'zi to'g'ri ko'rsatadi (Приве́т).
  const letterFont = brand.cyr && Platform.OS !== 'web' ? fonts.displayCyrillic : fonts.display;
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [hidden, setHidden] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (loading) return;
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
      // Onboarding savoli bir marta so'raladi — javob qurilmada saqlanadi.
      router.replace((await isOnboarded()) ? R.home : R.onboarding);
    } catch {
      setError('Internet aloqasini tekshiring');
      setLoading(false);
    }
  };

  const openSupport = () => Linking.openURL(supportUrl(courseLang));

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={styles.column}>
          {/* Dizayndagi 380px sahna status bar joyini ham o'z ichiga oladi. */}
          <View style={[styles.hero, { marginTop: Math.max(0, insets.top - 20) }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {TILES.map((t, i) => (
              <View
                key={i}
                style={[
                  styles.tile,
                  { left: t.left, top: t.top, width: t.size, height: t.size, borderRadius: t.radius, backgroundColor: t.bg, transform: [{ rotate: t.rotate }] },
                ]}
              >
                <Text style={[styles.tileChar, { fontFamily: letterFont, fontSize: t.font, color: t.fg }]}>{brand.letters[i]}</Text>
              </View>
            ))}
            <Image source={designImages.b924b8ccc546d63f781f9ea1bd9db221} style={styles.mascot} resizeMode="contain" />
            <View style={styles.bubble}>
              <Text style={[styles.bubbleText, { fontFamily: letterFont }]}>{brand.hello}</Text>
            </View>
            <Text style={styles.tagline}>{brand.tagline}</Text>
          </View>

          <View style={[styles.form, { paddingBottom: Math.max(22, insets.bottom + 8) }]}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>{brand.name[0]}</Text>
              </View>
              <View>
                <Text style={styles.brandName} accessibilityRole="header">{brand.name}</Text>
                <Text style={styles.brandSub}>Hisobingizga kiring</Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label} nativeID="login-label">Login</Text>
              <TextInput
                accessibilityLabel="Login"
                placeholder="Masalan: AA424"
                placeholderTextColor="#6B7489"
                value={login}
                onChangeText={(v) => { setLogin(v); setError(null); }}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                returnKeyType="next"
                style={[styles.input, !!error && styles.inputError]}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Parol</Text>
              <View>
                <TextInput
                  accessibilityLabel="Parol"
                  placeholder="Parolingiz"
                  placeholderTextColor="#6B7489"
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(null); }}
                  secureTextEntry={hidden}
                  autoCapitalize="none"
                  autoComplete="current-password"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  style={[styles.input, styles.inputPass, !!error && styles.inputError]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={hidden ? 'Parolni koʻrsatish' : 'Parolni yashirish'}
                  onPress={() => setHidden((h) => !h)}
                  style={styles.eye}
                >
                  <EyeIcon />
                </Pressable>
              </View>
              {/* Xato matni dizaynda yo'q — login mantig'i uchun shart. */}
              {!!error && (
                <Text style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">{error}</Text>
              )}
            </View>

            <Pressable accessibilityRole="link" onPress={openSupport} style={styles.forgot}>
              <Text style={styles.forgotText}>Parolni unutdingizmi?</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: loading, disabled: loading }}
              onPress={submit}
              style={({ pressed }) => [styles.submit, (pressed || loading) && { backgroundColor: '#1E3FD1' }]}
            >
              <Text style={styles.submitText}>{loading ? 'Kirilmoqda…' : 'Kirish'}</Text>
            </Pressable>

            {/* Butun karta — Telegram'dagi menejerga havola. */}
            <Pressable accessibilityRole="link" onPress={openSupport} style={styles.help}>
              <View style={styles.helpIcon}>
                <SendOutlineIcon color="#0B1220" />
              </View>
              <View style={styles.helpBody}>
                <Text style={styles.helpTitle}>Login va parolni menejerdan oling</Text>
                <Text style={styles.helpSub}>Telegram orqali yozing</Text>
              </View>
              <ChevronRightIcon />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#2F5BFF' },
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  hero: { height: 380, width: 390, alignSelf: 'center', position: 'relative' },
  tile: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  tileChar: { fontWeight: 'normal', includeFontPadding: false },
  mascot: { position: 'absolute', left: 105, top: 62, width: 190, height: 205 },
  bubble: {
    position: 'absolute',
    left: 112,
    top: 22,
    height: 38,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 19,
    borderTopRightRadius: 19,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 19,
    boxShadow: '0 4px 12px rgba(11,18,32,0.18)',
  },
  bubbleText: { fontSize: 18, color: '#0B1220', fontWeight: 'normal' },
  tagline: {
    position: 'absolute',
    left: 30,
    right: 30,
    top: 300,
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 33.6,
    letterSpacing: -0.64,
    color: '#FFFFFF',
    fontWeight: 'normal',
  },
  form: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 20,
    paddingHorizontal: 24,
    gap: 12,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#0B1220', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { fontFamily: fonts.display, fontSize: 18, color: '#FFFFFF', fontWeight: 'normal' },
  brandName: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.2, color: '#0B1220', fontWeight: 'normal' },
  brandSub: { fontFamily: fonts.body, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
  field: { gap: 7 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#0B1220', fontWeight: 'normal' },
  input: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D5DBE7',
    backgroundColor: '#F7F9FC',
    paddingHorizontal: 16,
    fontFamily: fonts.body,
    fontSize: 16,
    color: '#0B1220',
    fontWeight: 'normal',
  },
  inputPass: { paddingRight: 52 },
  inputError: { borderColor: '#D92D20' },
  eye: { position: 'absolute', right: 4, top: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: fonts.body, fontSize: 13, color: '#B42318', fontWeight: 'normal' },
  forgot: { alignSelf: 'flex-end', height: 44, marginTop: -8, marginBottom: -6, justifyContent: 'center' },
  forgotText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#2F5BFF', fontWeight: 'normal' },
  submit: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: '#FFFFFF', fontWeight: 'normal' },
  help: {
    marginTop: 'auto',
    minHeight: 64,
    backgroundColor: '#F4F6FA',
    borderRadius: 18,
    paddingTop: 10,
    paddingRight: 14,
    paddingBottom: 10,
    paddingLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  helpIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#2AABEE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  helpBody: { flex: 1, minWidth: 0, gap: 2 },
  helpTitle: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#0B1220', fontWeight: 'normal' },
  helpSub: { fontFamily: fonts.body, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
});
