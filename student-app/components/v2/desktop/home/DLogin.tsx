/**
 * Kompyuter: Kirish (dizayn: D_Login). Menyusiz to'liq oyna:
 * chapda ko'k sahna (640px), o'ngda 440px forma.
 * Kirish mantig'i mobil ekran (app/v2/login.tsx) bilan aynan bir xil:
 * o'sha API, token saqlash, keyin onboarding yoki Bosh sahifa.
 * Klaviatura: Enter — kirish.
 */
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';

import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { isOnboarded, supportUrl } from '@/components/v2/home/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';
import { invalidateCache } from '@/services/contentApi';
import { loadLessonProgress } from '@/services/lessonProgressStore';
import { setAuth } from '@/services/studentAuthStore';

import { BellIcon, CalendarIcon, ChevronIcon, EyeIcon, TgIcon, VideoIcon } from './icons';

const LOGIN_API = Platform.OS === 'web' ? '/api/auth/student-login' : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/auth/student-login';

// Kurs tiliga qarab (mobil ekrandagi BRAND bilan bir xil).
const BRAND = {
  russian: { name: 'Domwork', sub: 'Rus tili · onlayn maktab', tagline: 'Rus tilida 0 dan\nerkin suhbatgacha', hello: 'Приве́т!', letters: ['Ж', 'Я', 'Ё', 'Щ'] },
  english: { name: 'Homework', sub: 'Ingliz tili · onlayn maktab', tagline: 'Ingliz tilida 0 dan\nerkin suhbatgacha', hello: 'Hello!', letters: ['W', 'Q', 'Th', 'R'] },
} as const;

// Harf kartochkalari — dizayndagi joy, o'lcham, burilish.
const TILES = [
  { left: 4, top: 80, size: 96, radius: 28, bg: '#FFFFFF', fg: '#2F5BFF', rotate: '-10deg', font: 50 },
  { left: 436, top: 60, size: 100, radius: 29, bg: '#FFC93C', fg: '#0B1220', rotate: '8deg', font: 54 },
  { left: 14, top: 310, size: 92, radius: 27, bg: '#FF7A1A', fg: '#0B1220', rotate: '7deg', font: 48 },
  { left: 440, top: 300, size: 96, radius: 28, bg: '#0B1220', fg: '#FFFFFF', rotate: '-8deg', font: 50 },
];

export function DLogin() {
  const { courseLang } = useLang();
  const brand = BRAND[courseLang === 'russian' ? 'russian' : 'english'];
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [hidden, setHidden] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const submit = async () => {
    if (busy.current) return;
    if (!login.trim() || !password) {
      setError('Login va parolni kiriting');
      return;
    }
    busy.current = true;
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
        busy.current = false;
        return;
      }
      invalidateCache();
      await setAuth(data.token, data.student);
      await loadLessonProgress(true);
      invalidateCache();
      router.replace((await isOnboarded()) ? R.home : R.onboarding);
    } catch {
      setError('Internet aloqasini tekshiring');
      setLoading(false);
      busy.current = false;
    }
  };
  const openSupport = () => Linking.openURL(supportUrl(courseLang));

  useDesktopKeys({ Enter: () => void submit() });

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <View style={s.root}>
        <View style={s.panel} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={s.circle1} />
          <View style={s.circle2} />
          <View style={s.brand}>
            <View style={s.brandIcon}>
              <Image source={designImages.b924b8ccc546d63f781f9ea1bd9db221} style={{ width: 42, height: 44, marginTop: 4 }} resizeMode="contain" />
            </View>
            <View>
              <Text style={s.brandName}>{brand.name}</Text>
              <Text style={s.brandSub}>{brand.sub}</Text>
            </View>
          </View>
          <View style={s.stageWrap}>
            <View style={s.stage}>
              {TILES.map((t, i) => (
                <View
                  key={i}
                  style={[
                    s.tile,
                    { left: t.left, top: t.top, width: t.size, height: t.size, borderRadius: t.radius, backgroundColor: t.bg, transform: [{ rotate: t.rotate }] },
                  ]}
                >
                  <Text style={[s.tileChar, { fontSize: t.font, color: t.fg }]}>{brand.letters[i]}</Text>
                </View>
              ))}
              <Image source={designImages.b924b8ccc546d63f781f9ea1bd9db221} style={s.mascot} resizeMode="contain" />
              <View style={s.bubble}>
                <Text style={s.bubbleText}>{brand.hello}</Text>
              </View>
            </View>
          </View>
          <View style={{ gap: 14 }}>
            <Text style={s.tagline}>{brand.tagline}</Text>
            <View style={s.chips}>
              <View style={s.chip}>
                <VideoIcon size={17} color="#FFFFFF" />
                <Text style={s.chipText}>Jonli darslar</Text>
              </View>
              <View style={s.chip}>
                <CalendarIcon />
                <Text style={s.chipText}>72 dars · 3 oy</Text>
              </View>
              <View style={s.chip}>
                <BellIcon />
                <Text style={s.chipText}>Telegram eslatmalar</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={s.right}>
          <View style={s.form}>
            <View style={s.brandRow}>
              <View style={s.mark}>
                <Text style={s.markText}>{brand.name[0]}</Text>
              </View>
              <View style={{ gap: 2 }}>
                <Text accessibilityRole="header" style={s.h2}>
                  {brand.name}
                </Text>
                <Text style={s.h2Sub}>Hisobingizga kiring</Text>
              </View>
            </View>
            <View style={s.field}>
              <Text style={s.label}>Login</Text>
              <TextInput
                accessibilityLabel="Login"
                placeholder="Masalan: AA424"
                placeholderTextColor="#6B7489"
                value={login}
                onChangeText={(v) => {
                  setLogin(v);
                  setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                style={[s.input, !!error && s.inputError]}
              />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Parol</Text>
              <View>
                <TextInput
                  accessibilityLabel="Parol"
                  placeholder="Parolingiz"
                  placeholderTextColor="#6B7489"
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    setError(null);
                  }}
                  secureTextEntry={hidden}
                  autoCapitalize="none"
                  autoComplete="current-password"
                  style={[s.input, { paddingRight: 60 }, !!error && s.inputError]}
                />
                <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Parolni koʻrsatish' : 'Parolni yashirish'} onPress={() => setHidden((h) => !h)} style={s.eye}>
                  <EyeIcon />
                </Pressable>
              </View>
              {/* Xato matni dizaynda yo'q — login mantig'i uchun shart (mobil ekrandagidek). */}
              {!!error && (
                <Text style={s.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
                  {error}
                </Text>
              )}
            </View>
            <Pressable accessibilityRole="link" onPress={openSupport} style={s.forgot}>
              <Text style={s.forgotText}>Parolni unutdingizmi?</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: loading, disabled: loading }}
              aria-keyshortcuts="Enter"
              onPress={submit}
              style={({ pressed }) => [s.submit, (pressed || loading) && { backgroundColor: '#1E3FD1' }]}
            >
              <Text style={s.submitText}>{loading ? 'Kirilmoqda…' : 'Kirish'}</Text>
              <View style={s.kbd}>
                <Text style={s.kbdText}>Enter</Text>
              </View>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={openSupport} style={s.help}>
              <View style={s.helpIcon}>
                <TgIcon size={20} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.helpTitle}>Login va parolni menejerdan oling</Text>
                <Text style={s.helpSub}>Telegram orqali yozing</Text>
              </View>
              <ChevronIcon size={18} color="#6B7489" strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const T = (f: string, size: number, extra?: TextStyle): TextStyle => ({ fontFamily: f, fontWeight: 'normal', fontSize: size, ...extra });

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  root: { flex: 1, minHeight: 760, flexDirection: 'row' },
  panel: { width: 640, backgroundColor: '#2F5BFF', overflow: 'hidden', paddingVertical: 36, paddingHorizontal: 48 },
  circle1: { position: 'absolute', right: -140, top: -120, width: 420, height: 420, borderRadius: 210, backgroundColor: '#3D67FF' },
  circle2: { position: 'absolute', left: -120, bottom: -160, width: 380, height: 380, borderRadius: 190, backgroundColor: '#2A52EB' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  brandName: T(fonts.display, 23, { lineHeight: 24.15, letterSpacing: -0.46, color: '#FFFFFF' }),
  brandSub: T(fonts.bodyBold, 12, { color: '#FFFFFF' }),
  stageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: { width: 544, height: 470 },
  tile: { position: 'absolute', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 0 rgba(11,18,32,0.18)' },
  tileChar: { fontFamily: fonts.display, fontWeight: 'normal', letterSpacing: -1 },
  mascot: { position: 'absolute', left: 112, top: 50, width: 320, height: 400 },
  bubble: {
    position: 'absolute',
    left: 210,
    top: 0,
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    boxShadow: '0 8px 0 rgba(11,18,32,0.15)',
  },
  bubbleText: T(fonts.display, 24, { letterSpacing: -0.48, color: '#0B1220' }),
  tagline: T(fonts.display, 48, { lineHeight: 50.4, letterSpacing: -0.96, color: '#FFFFFF' }),
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#1E3FD1', flexDirection: 'row', alignItems: 'center', gap: 7 },
  chipText: T(fonts.bodyHeavy, 14, { color: '#FFFFFF' }),

  right: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  form: { width: 440, maxWidth: '100%', gap: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  mark: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#0B1220', alignItems: 'center', justifyContent: 'center' },
  markText: T(fonts.display, 24, { letterSpacing: -0.48, color: '#FFFFFF' }),
  h2: T(fonts.display, 32, { lineHeight: 33.6, letterSpacing: -0.64, color: '#0B1220' }),
  h2Sub: T(fonts.bodyBold, 16, { color: '#4A5468' }),
  field: { gap: 8 },
  label: T(fonts.bodyHeavy, 15, { color: '#0B1220' }),
  input: {
    height: 58,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#D5DBE7',
    backgroundColor: '#F7F9FC',
    paddingHorizontal: 18,
    fontFamily: fonts.bodyBold,
    fontWeight: 'normal',
    fontSize: 16,
    color: '#0B1220',
    // Webda brauzer fokus chizig'i (dizaynda outline: none).
    ...({ outlineStyle: 'none' } as object),
  },
  inputError: { borderColor: '#D92D20' },
  eye: { position: 'absolute', right: 6, top: 6, width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  error: T(fonts.body, 14, { color: '#B42318' }),
  forgot: { alignSelf: 'flex-end', marginTop: -6 },
  forgotText: T(fonts.bodyHeavy, 15, { color: '#2F5BFF' }),
  submit: { height: 58, borderRadius: 18, backgroundColor: '#2F5BFF', boxShadow: '0 5px 0 #1E3FD1', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  submitText: T(fonts.bodyHeavy, 17, { color: '#FFFFFF' }),
  kbd: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 7,
    backgroundColor: '#1E3FD1',
    borderWidth: 1,
    borderBottomWidth: 2,
    borderColor: '#5B7BFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kbdText: T(fonts.bodyHeavy, 12, { color: '#FFFFFF' }),
  help: { marginTop: 6, minHeight: 72, borderRadius: 18, backgroundColor: '#F4F6FA', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  helpIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2AABEE', alignItems: 'center', justifyContent: 'center' },
  helpTitle: T(fonts.bodyHeavy, 15, { color: '#0B1220' }),
  helpSub: T(fonts.body, 14, { color: '#4A5468' }),
});
