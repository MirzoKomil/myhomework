/**
 * Kompyuter: Sozlamalar (dizayn: D_Settings).
 *
 * Mantiq mobil ekran (app/v2/sozlamalar/index.tsx) bilan bir xil: eslatma
 * almashtirgichlari shu qurilmada (AsyncStorage, o'sha kalit), til —
 * LanguageContext, Telegram bot — telegramLinkStatus (ulanmagan bo'lsa
 * BotConnect oynasi), qurilmalar — /api/auth/sessions, ovoz effektlari va
 * ovozli maqtov — services/sfx, services/voicePraise. Qarz belgisi —
 * fetchDemoStudentPayments. Oflayn yuklash hali yo'q — 0 ta.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { BotConnectPopup } from '@/components/v2/popups/BotConnect';
import { dm, parseIso } from '@/components/v2/profile/shared';
import { SpeakerIcon, VoiceIcon } from '@/components/v2/settings/icons';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { useLang } from '@/i18n/LanguageContext';
import { useAvatarUri } from '@/services/avatarStore';
import { fetchDemoStudentPayments, type DemoPaymentsResponse } from '@/services/contentApi';
import { setSfxEnabled, useSfxEnabled } from '@/services/sfx';
import { useAuth } from '@/services/studentAuthStore';
import { telegramLinkStatus } from '@/services/telegramLinkApi';
import { setVoicePraiseEnabled, useVoicePraiseEnabled } from '@/services/voicePraise';

import { SettingsLayout, useSettingsInfo } from './settingsNav';
import { BellIcon, CameraIcon, CardIcon, CheckIcon, ChevronIcon, DevicesIcon, DownloadIcon, FlameIcon, GlobeIcon, go, H, MoonIcon, Over, QuestionIcon, ShieldIcon, T, TgIcon, Toggle, VideoIcon } from './ui';

const REMINDERS_KEY = 'mh_v2_reminders';
type ReminderKey = 'lesson' | 'live' | 'streak';
const DEFAULT_REMINDERS: Record<ReminderKey, boolean> = { lesson: true, live: true, streak: true };
const BOT_URL = 'https://t.me/Domworkuz_bot';
const LANG_LABEL = { uz: 'Oʻzbekcha', ru: 'Русский' } as const;

export function DSettings() {
  const { token } = useAuth();
  const { lang } = useLang();
  const avatarUri = useAvatarUri();
  const isEmbedded = Platform.OS === 'web' && typeof window !== 'undefined' && window.self !== window.top;
  const info = useSettingsInfo();
  const [reminders, setReminders] = useState(DEFAULT_REMINDERS);
  const [botLinked, setBotLinked] = useState<boolean | null>(null);
  const [botOpen, setBotOpen] = useState(false);
  const [pay, setPay] = useState<DemoPaymentsResponse | null>(null);
  const sfxOn = useSfxEnabled();
  const voiceOn = useVoicePraiseEnabled();

  useEffect(() => {
    AsyncStorage.getItem(REMINDERS_KEY)
      .then((raw) => {
        if (raw) setReminders({ ...DEFAULT_REMINDERS, ...JSON.parse(raw) });
      })
      .catch(() => {});
    fetchDemoStudentPayments().then(setPay).catch(() => {});
  }, []);

  // Bot ulanishi va qurilmalar soni boshqa ekranda o'zgarishi mumkin.
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      telegramLinkStatus()
        .then((s) => setBotLinked(!!s.linked))
        .catch(() => setBotLinked(false));
      info.refreshDevices();
      // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const openBot = () => (botLinked ? Linking.openURL(BOT_URL).catch(() => {}) : setBotOpen(true));

  if (!token && !isEmbedded) return <Redirect href={R.login as Href} />;

  const debt = pay?.debtAmount ?? 0;
  const due = parseIso(pay?.paymentDueDate);

  return (
    <SettingsLayout active="general" title="Sozlamalar" subtitle="Eslatmalar, ilova va hisob">
      <Pressable accessibilityRole="link" onPress={() => go(R.profileEdit)} style={s.profile}>
        <Image source={avatarUri ? { uri: avatarUri } : designImages['93faebd4826b1da6adaee5d0dcda6209']} style={s.avatar} />
        <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
          <H size={24} lines={1}>
            {info.name}
          </H>
          <T f="bodyBold" size={14} color="#4A5468">
            Profilni koʻrish · avatarni almashtirish
          </T>
        </View>
        <View style={s.avatarChip}>
          <CameraIcon />
          <T size={14} color="#1E3FD1">
            Avatar
          </T>
        </View>
        <ChevronIcon size={20} />
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, minWidth: 0, gap: 20 }}>
          <Section label="Eslatmalar">
            <SwitchRow icon={<BellIcon size={21} />} label="Dars eslatmasi" hint="18:30" tall on={reminders.lesson} onPress={() => toggleReminder('lesson')} divider />
            <SwitchRow icon={<VideoIcon size={21} />} label="Jonli darsdan oldin" hint="15 daq" tall on={reminders.live} onPress={() => toggleReminder('live')} divider />
            <SwitchRow icon={<FlameIcon size={21} />} label="Streak eslatmasi" hint="21:00" on={reminders.streak} onPress={() => toggleReminder('streak')} />
          </Section>
          <Section label="Hisob">
            <LinkRow
              icon={<CardIcon size={21} />}
              label="Toʻlovlar va tarif"
              right={
                debt > 0 ? (
                  <View style={s.debt}>
                    <T size={13} color="#B42318">{`Qarz${due ? ` · ${dm(due)} gacha` : ''}`}</T>
                  </View>
                ) : undefined
              }
              onPress={() => go(R.payments)}
              divider
            />
            {/* Oflayn yuklash hali yo'q — soni 0 (mobil ekrandagidek) */}
            <LinkRow icon={<DownloadIcon size={21} />} label="Oflayn darslar" value="0 ta yuklangan" onPress={() => go(R.offline)} />
          </Section>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 20 }}>
          <Section label="Ilova">
            <LinkRow icon={<GlobeIcon size={21} />} label="Ilova tili" value={LANG_LABEL[lang] ?? LANG_LABEL.uz} onPress={() => go(R.language)} divider />
            {/* Ovoz effektlari va ovozli maqtov — mobil Sozlamalardagi kabi, faqat shu qurilmada saqlanadi. */}
            <SwitchRow icon={<SpeakerIcon size={21} />} label="Ovoz effektlari" on={sfxOn} onPress={() => setSfxEnabled(!sfxOn)} divider />
            <SwitchRow icon={<VoiceIcon size={21} />} label="Ovozli maqtov" hint="«Barakalla!»" bare on={voiceOn} onPress={() => setVoicePraiseEnabled(!voiceOn)} divider />
            {/* Qorong'u rejim uchun saqlash joyi yo'q — o'chiq; bosilsa bosh sahifa (D_DarkMain) */}
            <SwitchRow icon={<MoonIcon size={21} />} label="Qorongʻu rejim" on={false} onPress={() => go(R.home)} divider />
            <Pressable
              accessibilityRole={botLinked ? 'link' : 'button'}
              accessibilityLabel={botLinked ? 'Telegram bot @Domworkuz_bot, ulangan — Telegramda ochish' : 'Telegram bot @Domworkuz_bot'}
              onPress={openBot}
              style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.row, s.divider, hovered && s.hover]}
            >
              <TgIcon size={21} color="#1B8BC9" />
              <View style={{ flex: 1, gap: 1 }}>
                <T f="bodyBold" size={15}>
                  Telegram bot
                </T>
                <T f="body" size={13} color="#4A5468">
                  @Domworkuz_bot
                </T>
              </View>
              {botLinked && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <T size={14} color="#087A4A">
                    Ulangan
                  </T>
                  <CheckIcon />
                </View>
              )}
              <ChevronIcon />
            </Pressable>
            <LinkRow icon={<DevicesIcon size={21} />} label="Faol qurilmalar" value={info.devices === null ? '' : `${info.devices} ta`} onPress={() => go(R.devices)} />
          </Section>
          <Section label="Yordam">
            <LinkRow icon={<QuestionIcon size={21} />} label="Savol-javoblar" sub="Kurs va ilova haqida" onPress={() => go(R.faq)} divider />
            <LinkRow icon={<ShieldIcon size={21} />} label="Maxfiylik" sub="Yangilangan: 01.09.2026" onPress={() => go(R.privacy)} />
          </Section>
        </View>
      </View>

      <View style={s.banner}>
        <Image source={designImages.ea02e684d881c58fa4cba7467756a2c8} style={{ width: 56, height: 56 }} resizeMode="contain" />
        <View style={{ flex: 1, gap: 2 }}>
          <T size={15}>Eslatmalar Telegramga ham keladi</T>
          <T f="body" size={14} color="#34405A">
            {`@Domworkuz_bot${botLinked === false ? '' : ' ulangan'} — ilova yopiq boʻlsa ham darsni oʻtkazib yubormaysiz.`}
          </T>
        </View>
        <Pressable accessibilityRole={botLinked === false ? 'button' : 'link'} onPress={openBot} style={s.bannerBtn}>
          <TgIcon size={17} color="#1E3FD1" />
          <T size={14} color="#1E3FD1">
            Botni ochish
          </T>
        </Pressable>
      </View>
      <BotConnectPopup visible={botOpen} onClose={closeBot} />
    </SettingsLayout>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Over style={{ paddingLeft: 4 }}>{label}</Over>
      <View style={s.group}>{children}</View>
    </View>
  );
}

// tall — Eslatmalar: dizaynda tugma (76) chegarali div ichida, jami 77.
function SwitchRow({ icon, label, hint, on, onPress, divider, bare, tall }: { icon: ReactNode; label: string; hint?: string; on: boolean; onPress: () => void; divider?: boolean; bare?: boolean; tall?: boolean }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      aria-checked={on}
      accessibilityLabel={hint ? `${label} · ${hint}` : label}
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.row, divider && s.divider, divider && tall && { minHeight: 77 }, hovered && s.hover]}
    >
      {icon}
      <T f="bodyBold" size={15}>
        {label}
      </T>
      {!!hint && (
        <T f="body" size={14} color="#4A5468">
          {bare ? hint : `· ${hint}`}
        </T>
      )}
      <View style={{ flex: 1 }} />
      <Toggle on={on} />
    </Pressable>
  );
}

function LinkRow({
  icon,
  label,
  sub,
  value,
  right,
  onPress,
  divider,
}: {
  icon: ReactNode;
  label: string;
  sub?: string;
  value?: string;
  right?: ReactNode;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.row, divider && s.divider, hovered && s.hover]}>
      {icon}
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <T f="bodyBold" size={15}>
          {label}
        </T>
        {!!sub && (
          <T f="body" size={13} color="#4A5468">
            {sub}
          </T>
        )}
      </View>
      {right}
      {!!value && (
        <T size={14} color="#4A5468" lines={1}>
          {value}
        </T>
      )}
      <ChevronIcon />
    </Pressable>
  );
}

const s = StyleSheet.create({
  profile: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 18, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 18 },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#FFF1E6' },
  avatarChip: { height: 40, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#E8EEFF', flexDirection: 'row', alignItems: 'center', gap: 7 },
  group: { backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden' },
  row: { minHeight: 76, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  hover: { backgroundColor: '#FBFCFE' },
  debt: { height: 26, paddingHorizontal: 9, borderRadius: 13, backgroundColor: '#FDECEC', justifyContent: 'center' },
  banner: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#E8EEFF', borderRadius: 22, paddingVertical: 14, paddingRight: 16, paddingLeft: 20 },
  bannerBtn: { height: 46, paddingHorizontal: 16, borderRadius: 15, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
});
