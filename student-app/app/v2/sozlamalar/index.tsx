/**
 * v2 Sozlamalar (dizayn: 55 · Settings).
 *
 * Eski `profile/settings/index.tsx` o'rnini bosadi: til, Telegram bot,
 * faol qurilmalar, FAQ, maxfiylik va hisobdan chiqish. Ma'lumotlar —
 * mavjud servislardan (auth, avatar, til, Telegram ulanish holati,
 * sessiyalar). Eslatma almashtirgichlari uchun serverda sozlama yo'q,
 * shuning uchun tanlov shu qurilmada (AsyncStorage) saqlanadi.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotConnectPopup } from '@/components/v2/popups/BotConnect';
import { LogoutConfirmPopup } from '@/components/v2/popups/LogoutConfirm';
import {
  CardIcon,
  CheckMarkIcon,
  ChevronRightIcon,
  DownloadIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LogoutIcon,
  MoonIcon,
  PhoneIcon,
  QuestionIcon,
  ShieldOutlineIcon,
  TelegramRowIcon,
  SpeakerIcon, VoiceIcon,
} from '@/components/v2/settings/icons';
import { Column, ScreenHeader, ToggleKnob } from '@/components/v2/settings/parts';
import { fetchSessions } from '@/components/v2/settings/sessions';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';
import { useAvatarUri } from '@/services/avatarStore';
import { fetchDemoStudentProfile } from '@/services/contentApi';
import { setSfxEnabled, useSfxEnabled } from '@/services/sfx';
import { setVoicePraiseEnabled, useVoicePraiseEnabled } from '@/services/voicePraise';
import { useAuth } from '@/services/studentAuthStore';
import { telegramLinkStatus } from '@/services/telegramLinkApi';

const REMINDERS_KEY = 'mh_v2_reminders';
type ReminderKey = 'lesson' | 'live' | 'streak';
const DEFAULT_REMINDERS: Record<ReminderKey, boolean> = { lesson: true, live: true, streak: true };

const BOT_URL = 'https://t.me/Domworkuz_bot';

const LANG_LABEL = { uz: 'Oʻzbekcha', ru: 'Русский' } as const;

const go = (href: string) => router.push(href as Href);

export default function V2Settings() {
  const insets = useSafeAreaInsets();
  const { token, student } = useAuth();
  const { lang } = useLang();
  const avatarUri = useAvatarUri();
  const isEmbedded = Platform.OS === 'web' && typeof window !== 'undefined' && window.self !== window.top;

  const [name, setName] = useState(student?.name ?? '');
  const [reminders, setReminders] = useState(DEFAULT_REMINDERS);
  const [botLinked, setBotLinked] = useState<boolean | null>(null);
  const [deviceCount, setDeviceCount] = useState<number | null>(null);
  const [botOpen, setBotOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const sfxOn = useSfxEnabled();
  const voiceOn = useVoicePraiseEnabled();

  useEffect(() => {
    if (student?.name) setName(student.name);
    fetchDemoStudentProfile()
      .then((p) => {
        if (p?.name) setName(p.name);
      })
      .catch(() => {});
  }, [student?.id, student?.name]);

  useEffect(() => {
    AsyncStorage.getItem(REMINDERS_KEY)
      .then((raw) => {
        if (raw) setReminders({ ...DEFAULT_REMINDERS, ...JSON.parse(raw) });
      })
      .catch(() => {});
  }, []);

  // Bot ulanishi va qurilmalar soni boshqa ekranda o'zgarishi mumkin —
  // har safar ekranga qaytilganda yangilanadi.
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      telegramLinkStatus()
        .then((s) => setBotLinked(!!s.linked))
        .catch(() => setBotLinked(false));
      fetchSessions()
        .then((list) => setDeviceCount(list.length))
        .catch(() => setDeviceCount(0));
    }, [token]),
  );

  const toggleReminder = (key: ReminderKey) => {
    setReminders((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const closeBot = () => {
    setBotOpen(false);
    telegramLinkStatus()
      .then((s) => setBotLinked(!!s.linked))
      .catch(() => {});
  };

  if (!token && !isEmbedded) return <Redirect href={R.login as Href} />;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <Column>
          <ScreenHeader title="Sozlamalar" fallback={R.profile} />
          <View style={styles.body}>
            <Pressable
              accessibilityRole="link"
              onPress={() => go(R.profileEdit)}
              style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}
            >
              <Image
                source={avatarUri ? { uri: avatarUri } : designImages['93faebd4826b1da6adaee5d0dcda6209']}
                style={styles.avatar}
                accessibilityIgnoresInvertColors
              />
              <View style={styles.profileText}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.profileSub}>Profilni koʻrish · avatarni almashtirish</Text>
              </View>
              <ChevronRightIcon />
            </Pressable>

            <Section label="Eslatmalar">
              <SwitchRow label="Dars eslatmasi" hint="18:30" on={reminders.lesson} onPress={() => toggleReminder('lesson')} divider />
              <SwitchRow label="Jonli darsdan oldin" hint="15 daq" on={reminders.live} onPress={() => toggleReminder('live')} divider />
              <SwitchRow label="Streak eslatmasi" hint="21:00" on={reminders.streak} onPress={() => toggleReminder('streak')} />
            </Section>

            <Section label="Ilova">
              <LinkRow icon={<GlobeIcon />} label="Ilova tili" value={LANG_LABEL[lang] ?? LANG_LABEL.uz} onPress={() => go(R.language)} divider />
              {/* Ovoz effektlari: faqat shu qurilmada saqlanadi (services/sfx.ts). */}
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Ovoz effektlari"
                accessibilityState={{ checked: sfxOn }}
                aria-checked={sfxOn}
                onPress={() => setSfxEnabled(!sfxOn)}
                style={({ pressed }) => [styles.row, styles.divider, pressed && styles.rowPressed]}
              >
                <SpeakerIcon />
                <Text style={styles.rowLabel}>Ovoz effektlari</Text>
                <ToggleKnob on={sfxOn} />
              </Pressable>
              {/* O'zbekcha ovozli maqtov ("Barakalla!", "Qoyil!") — faqat shu qurilmada saqlanadi. */}
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Ovozli maqtov"
                accessibilityState={{ checked: voiceOn }}
                aria-checked={voiceOn}
                onPress={() => setVoicePraiseEnabled(!voiceOn)}
                style={({ pressed }) => [styles.row, styles.divider, pressed && styles.rowPressed]}
              >
                <VoiceIcon />
                <Text style={styles.rowLabel}>
                  Ovozli maqtov <Text style={styles.rowHint}>«Barakalla!»</Text>
                </Text>
                <ToggleKnob on={voiceOn} />
              </Pressable>
              {/* Qorong'u rejim uchun hali saqlash joyi yo'q — dizayndagi kabi o'chiq turadi, bosilsa DarkMain (bosh sahifa) */}
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: false }}
                aria-checked={false}
                onPress={() => go(R.home)}
                style={({ pressed }) => [styles.row, styles.divider, pressed && styles.rowPressed]}
              >
                <MoonIcon />
                <Text style={styles.rowLabel}>Qorongʻu rejim</Text>
                <ToggleKnob on={false} />
              </Pressable>
              {/* Ulangan bo'lsa dizayndagi kabi botning o'zi Telegramda ochiladi; ulanmagan
                  holat dizaynda yo'q — ulash uchun avvalgidek BotConnect oynasi ochiladi. */}
              <Pressable
                accessibilityRole={botLinked ? 'link' : 'button'}
                accessibilityLabel={
                  botLinked
                    ? 'Telegram bot @Domworkuz_bot, ulangan — Telegramda ochish'
                    : 'Telegram bot @Domworkuz_bot'
                }
                onPress={() => (botLinked ? Linking.openURL(BOT_URL).catch(() => {}) : setBotOpen(true))}
                style={({ pressed }) => [styles.row, styles.divider, pressed && styles.rowPressed]}
              >
                <TelegramRowIcon />
                <Text style={styles.rowLabel}>
                  Telegram bot <Text style={styles.rowHint}>@Domworkuz_bot</Text>
                </Text>
                {botLinked ? (
                  <View style={styles.linked}>
                    <Text style={styles.linkedText}>Ulangan</Text>
                    <CheckMarkIcon />
                  </View>
                ) : null}
                {botLinked ? <ExternalLinkIcon /> : <ChevronRightIcon />}
              </Pressable>
              <LinkRow
                icon={<PhoneIcon />}
                label="Faol qurilmalar"
                value={deviceCount === null ? '' : `${deviceCount} ta`}
                onPress={() => go(R.devices)}
              />
            </Section>

            <Section label="Hisob">
              <LinkRow icon={<CardIcon />} label="Toʻlovlar va tarif" onPress={() => go(R.payments)} divider />
              {/* Oflayn yuklash hali yo'q — soni 0 */}
              <LinkRow icon={<DownloadIcon />} label="Oflayn darslar" value="0 ta yuklangan" onPress={() => go(R.offline)} />
            </Section>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Yordam</Text>
              <View style={styles.helpGrid}>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => go(R.faq)}
                  style={({ pressed }) => [styles.helpBtn, pressed && styles.pressed]}
                >
                  <QuestionIcon />
                  <Text style={styles.helpText}>Savol-javoblar</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => go(R.privacy)}
                  style={({ pressed }) => [styles.helpBtn, pressed && styles.pressed]}
                >
                  <ShieldOutlineIcon />
                  <Text style={styles.helpText}>Maxfiylik</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => setLogoutOpen(true)}
              style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
            >
              <LogoutIcon />
              <Text style={styles.logoutText}>Hisobdan chiqish</Text>
            </Pressable>
          </View>
        </Column>
      </ScrollView>

      <BotConnectPopup visible={botOpen} onClose={closeBot} />
      <LogoutConfirmPopup visible={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </View>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

function SwitchRow({ label, hint, on, onPress, divider }: { label: string; hint: string; on: boolean; onPress: () => void; divider?: boolean }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${label} · ${hint}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.rowPressed]}
    >
      <Text style={styles.rowLabel}>
        {label} <Text style={styles.rowHint}>· {hint}</Text>
      </Text>
      <ToggleKnob on={on} />
    </Pressable>
  );
}

function LinkRow({
  icon,
  label,
  value,
  onPress,
  divider,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.rowPressed]}
    >
      {icon}
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      {!!value && <Text style={styles.rowValue}>{value}</Text>}
      <ChevronRightIcon />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  body: { paddingTop: 14, paddingHorizontal: 20, gap: 10 },
  pressed: { opacity: 0.85 },
  profileCard: {
    minHeight: 60,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF1E6', flexShrink: 0 },
  profileText: { flex: 1, minWidth: 0, gap: 1 },
  profileName: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, lineHeight: 20, color: '#0B1220' },
  profileSub: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  section: { gap: 6 },
  sectionLabel: {
    fontFamily: fonts.bodyHeavy,
    fontWeight: 'normal',
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.72,
    textTransform: 'uppercase',
    color: '#4A5468',
    paddingLeft: 4,
  },
  group: { backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden' },
  row: { minHeight: 46, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowPressed: { backgroundColor: '#F7F9FC' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  rowLabel: { flex: 1, minWidth: 0, fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 15, lineHeight: 20, color: '#0B1220' },
  rowHint: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, color: '#4A5468' },
  rowValue: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  linked: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  linkedText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#087A4A' },
  helpGrid: { flexDirection: 'row', gap: 10 },
  helpBtn: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  helpText: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 15, lineHeight: 20, color: '#0B1220' },
  logout: {
    height: 46,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, lineHeight: 20, color: '#B42318' },
});
