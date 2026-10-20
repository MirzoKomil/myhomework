/**
 * v2 Bildirishnomalar (dizayn: Notifications.dc.html).
 *
 * Ma'lumot eski `app/(tabs)/notifications` bilan bir xil manbadan:
 * fetchDemoNotifications (CRM qoidalari + tizim voqealari + qo'lda yuborilgan).
 * Server "o'qildi" belgisini saqlamaydi — "Hammasini oʻqilgan qilish"
 * qurilmada eslab qolinadi. Davomat so'rovnomasi va ustozni baholash
 * eski ekrandagi kabi ishlaydi. Jonli dars sarlavhasi LiveNow oynasini ochadi
 * (skrinshot uchun: ?popup=live).
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { DNotifications } from '@/components/v2/desktop/home/DNotifications';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';
import { v2Back } from '@/services/v2Nav';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BackIcon,
  ChatIcon,
  CheckIcon,
  ChevronNarrowIcon,
  DoubleCheckIcon,
  GiftIcon,
  TelegramAltIcon,
  TelegramIcon,
  TrophyIcon,
  VideoIcon,
} from '@/components/v2/home/icons';
import { getReadIds, markAllRead } from '@/components/v2/home/shared';
import { ContactSheetPopup } from '@/components/v2/popups/ContactSheet';
import { LiveNowPopup } from '@/components/v2/popups/LiveNow';
import { Loading } from '@/components/v2/states/Loading';
import { ServerError } from '@/components/v2/states/ServerError';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import {
  fetchDemoNotifications,
  fetchDemoSchedule,
  submitAbsenceReason,
  type DemoNotification,
  markNotificationsReadOnServer,
} from '@/services/contentApi';

const ATTENDANCE_OPTIONS = ['Darsga kirdim', 'Darsga kira olmadim', 'Dars yarmida tugadi'];
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const pad = (n: number) => String(n).padStart(2, '0');

type Kind = 'live' | 'video' | 'done' | 'trophy' | 'gift' | 'rating' | 'grade' | 'telegram';

const ICON: Record<Kind, { bg: string; node: ReactNode }> = {
  live: { bg: '#FDECEC', node: <VideoIcon /> },
  video: { bg: '#FDECEC', node: <VideoIcon /> },
  done: { bg: '#E3F7EE', node: <CheckIcon size={20} color="#087A4A" strokeWidth={2.6} /> },
  trophy: { bg: '#F0EBFF', node: <TrophyIcon /> },
  gift: { bg: '#FFF1E6', node: <GiftIcon /> },
  rating: { bg: '#E8EEFF', node: <ChatIcon color="#1E3FD1" /> },
  // Baho: ball bo'lsa ikonka o'rnida ball matni chiziladi (gradeScore).
  grade: { bg: '#E8EEFF', node: <ChatIcon color="#1E3FD1" /> },
  telegram: { bg: '#E1F3FC', node: <TelegramIcon size={20} color="#1B6FA8" /> },
};

/** Dars bahosi xabari ("30-dars bahosi · 4.8/5") — ustozni baholash taklifi emas. */
const isGrade = (n: DemoNotification) => n.interactive !== 'rate-teacher' && /bahosi|baho:/i.test(n.title);
/** Xabardagi haqiqiy ball ("4.8/5" → "4.8"); bo'lmasa null. */
function gradeScore(n: DemoNotification): string | null {
  const m = `${n.title} ${n.message}`.match(/(\d+(?:[.,]\d+)?)\s*\/\s*5\b/);
  return m ? m[1].replace(',', '.') : null;
}
const isBotLinked = (n: DemoNotification) => /telegram bot/i.test(n.title);

// Server qaysi qoidadan kelganini id orqali beradi (auto-<qoida>-...).
function kindOf(n: DemoNotification): Kind {
  const id = n.id;
  if (isGrade(n)) return 'grade';
  if (id.startsWith('auto-lessonReminder')) return 'live';
  if (id.startsWith('auto-videoLesson')) return 'video';
  if (id.startsWith('auto-homeworkIncomplete') || id.startsWith('auto-absenceSurvey')) return 'done';
  if (id.startsWith('auto-teacherRatingPrompt')) return 'rating';
  if (id.startsWith('auto-bonusLesson')) return 'gift';
  if (id.startsWith('auto-paymentDebt')) return 'gift';
  if (/daraja|reyting|imtihon/i.test(n.title)) return 'trophy';
  return 'telegram';
}

function targetOf(n: DemoNotification): Href | null {
  const id = n.id;
  if (n.interactive === 'rate-teacher') return R.teachers as Href;
  if (isGrade(n)) return R.schedule as Href;
  if (isBotLinked(n)) return R.settings as Href;
  if (id.startsWith('auto-videoLesson') || id.startsWith('auto-homeworkIncomplete')) return R.path as Href;
  if (id.startsWith('auto-bonusLesson')) return R.bonus as Href;
  if (id.startsWith('auto-paymentDebt')) return R.payments as Href;
  if (/daraja/i.test(n.title)) return R.levels as Href;
  if (/reyting/i.test(n.title)) return R.league as Href;
  if (/imtihon/i.test(n.title)) return R.exams as Href;
  // Qolganlari (jonli dars, qo'lda/tizim xabarlari) — v2 da alohida sahifa yo'q,
  // eski ilova sahifasiga o'tkazilmaydi: matn shu yerning o'zida to'liq ko'rinadi.
  return null;
}

function dayLabel(d: Date, now: Date) {
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (diff === 0) return `Bugun · ${date}`;
  if (diff === 1) return `Kecha · ${date}`;
  return date;
}

function AttendanceOptions({ n }: { n: DemoNotification }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const send = (opt: string) => {
    if (state !== 'idle' || !n.lessonDate) return;
    setSelected(opt);
    setState('sending');
    submitAbsenceReason(n.lessonDate, opt)
      .then(() => setState('done'))
      .catch(() => { setState('idle'); setSelected(null); });
  };
  return (
    <View style={styles.options} accessibilityRole="radiogroup">
      {ATTENDANCE_OPTIONS.map((opt) => {
        const on = selected === opt;
        return (
          <Pressable
            key={opt}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: state !== 'idle' }}
            onPress={() => send(opt)}
            style={[styles.option, on && styles.optionOn]}
          >
            <Text style={[styles.optionText, on && { color: '#FFFFFF' }]}>{on && state === 'done' ? `${opt} ✓` : opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function V2Notifications() {
  return useIsDesktop() ? <DNotifications /> : <V2NotificationsMobile />;
}

function V2NotificationsMobile() {
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<DemoNotification[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [groupLink, setGroupLink] = useState('');
  const [contactOpen, setContactOpen] = useState(false);
  const { popup } = useLocalSearchParams<{ popup?: string }>();
  const [liveOpen, setLiveOpen] = useState(popup === 'live');

  const load = useCallback(() => {
    setFailed(false);
    setList(null);
    Promise.all([fetchDemoNotifications(), getReadIds()])
      .then(([items, read]) => {
        setReadIds(read);
        setList(items);
        // Ro'yxat ochildi — ko'rsatilganlar o'qilgan bo'ladi (nuqtalar shu
        // safar ko'rinib turadi, keyingi kirishda son 0 bo'ladi).
        const ids = items.filter((n) => n.unread && !read.has(n.id)).map((n) => n.id);
        void markAllRead(ids);
        void markNotificationsReadOnServer(ids);
      })
      .catch(() => setFailed(true));
    fetchDemoSchedule().then((s) => setGroupLink(s.telegramGroupLink || '')).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const isUnread = useCallback((n: DemoNotification) => n.unread && !readIds.has(n.id), [readIds]);
  const unreadCount = (list ?? []).filter(isUnread).length;

  const sections = useMemo(() => {
    const now = new Date();
    const out: { label: string; items: DemoNotification[] }[] = [];
    for (const n of list ?? []) {
      const label = dayLabel(new Date(n.date), now);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(n);
      else out.push({ label, items: [n] });
    }
    return out;
  }, [list]);

  const readAll = async () => {
    const ids = (list ?? []).map((n) => n.id);
    await markAllRead(ids);
    void markNotificationsReadOnServer(ids);
    setReadIds(new Set([...readIds, ...ids]));
  };

  const back = () => v2Back(R.home);

  if (failed) return <ServerError onRetry={load} />;
  if (!list) return <Loading withNav={false} />;

  return (
    <View style={styles.screen}>
      <View style={[styles.column, { flex: 1 }]}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Orqaga" onPress={back} style={styles.headBtn}>
            <BackIcon />
          </Pressable>
          <View style={styles.headText}>
            <Text style={styles.h1} accessibilityRole="header">Bildirishnomalar</Text>
            <Text style={styles.count}>{unreadCount} ta yangi</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Hammasini oʻqilgan qilish" onPress={readAll} style={styles.headBtn}>
            <DoubleCheckIcon />
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {sections.length === 0 && <Text style={styles.empty}>Hozircha bildirishnoma yoʻq</Text>}
          {sections.map((s, si) => (
            <View key={s.label} style={styles.section}>
              <Text style={[styles.sectionLabel, si > 0 && { paddingTop: 6 }]}>{s.label}</Text>
              {s.items.map((n) => {
                const kind = kindOf(n);
                const unread = isUnread(n);
                const d = new Date(n.date);
                const target = targetOf(n);
                const withButton = kind === 'live' && !!groupLink;
                const withOptions = n.interactive === 'attendance';
                const content = (
                  <>
                    <View style={[styles.icon, { backgroundColor: ICON[kind].bg }]}>
                      {kind === 'grade' && gradeScore(n) ? <Text style={styles.score}>{gradeScore(n)}</Text> : ICON[kind].node}
                    </View>
                    <View style={styles.body}>
                      <View style={[styles.titleRow, kind === 'live' && { alignItems: 'center' }]}>
                        {kind === 'live' ? (
                          <Pressable accessibilityRole="link" onPress={() => setLiveOpen(true)} style={styles.liveTitle}>
                            <Text style={[styles.title, styles.liveTitleText]} numberOfLines={1}>{n.title}</Text>
                            <ChevronNarrowIcon />
                          </Pressable>
                        ) : (
                          <Text style={styles.title}>{n.title}</Text>
                        )}
                        <Text style={styles.time}>{pad(d.getHours())}:{pad(d.getMinutes())}</Text>
                        {unread && <View accessibilityRole="image" accessibilityLabel="Oʻqilmagan" style={styles.dot} />}
                      </View>
                      <Text style={styles.message}>{n.message}</Text>
                      {withButton && (
                        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(groupLink)} style={styles.tgBtn}>
                          <TelegramIcon size={17} />
                          <Text style={styles.tgBtnText}>Telegram guruhga</Text>
                        </Pressable>
                      )}
                      {withOptions && <AttendanceOptions n={n} />}
                    </View>
                  </>
                );
                const rowStyle = [styles.row, unread && styles.rowUnread, (withButton || withOptions) ? styles.article : styles.link];
                return target && !withButton && !withOptions ? (
                  <Pressable key={n.id} accessibilityRole="link" onPress={() => router.push(target)} style={rowStyle}>
                    {content}
                  </Pressable>
                ) : (
                  <View key={n.id} style={rowStyle}>{content}</View>
                );
              })}
            </View>
          ))}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(34, insets.bottom + 14) }]}>
          <LinearGradient
            colors={['rgba(244,246,250,0)', '#F4F6FA']}
            locations={[0, 0.3]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setContactOpen(true)}
            style={({ pressed }) => [styles.cta, pressed && { backgroundColor: '#1E3FD1' }]}
          >
            <TelegramAltIcon color="#FFFFFF" />
            <Text style={styles.ctaText}>Ustozga yozish</Text>
          </Pressable>
        </View>
      </View>
      <ContactSheetPopup visible={contactOpen} onClose={() => setContactOpen(false)} />
      <LiveNowPopup visible={liveOpen} onClose={() => setLiveOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headBtn: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, minWidth: 0 },
  h1: { fontFamily: fonts.display, fontSize: 24, lineHeight: 26.4, letterSpacing: -0.48, color: '#0B1220', fontWeight: 'normal' },
  count: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
  list: { paddingTop: 14, paddingHorizontal: 20, paddingBottom: 12, gap: 6 },
  section: { gap: 6 },
  sectionLabel: {
    fontFamily: fonts.bodyHeavy,
    fontSize: 12,
    letterSpacing: 0.72,
    textTransform: 'uppercase',
    color: '#4A5468',
    paddingHorizontal: 4,
    fontWeight: 'normal',
  },
  empty: { fontFamily: fonts.body, fontSize: 14, color: '#4A5468', paddingHorizontal: 4, fontWeight: 'normal' },
  row: { borderRadius: 20, paddingHorizontal: 14, flexDirection: 'row', gap: 12 },
  rowUnread: { backgroundColor: '#FFFFFF' },
  article: { paddingVertical: 12 },
  link: { paddingVertical: 11, alignItems: 'center' },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  title: { flex: 1, minWidth: 0, fontFamily: fonts.bodyHeavy, fontSize: 15, lineHeight: 19.5, color: '#0B1220', fontWeight: 'normal' },
  // Dizayn: min-height 44, margin -11px 0 — bosish maydoni kattaroq, qator balandligi o'zgarmaydi.
  score: { fontFamily: fonts.display, fontSize: 15, color: '#1E3FD1', fontWeight: 'normal' },
  liveTitle: { flex: 1, minWidth: 0, minHeight: 44, marginVertical: -11, flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveTitleText: { flexGrow: 0, flexShrink: 1, flexBasis: 'auto' },
  time: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#5B6478', fontWeight: 'normal' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2F5BFF', alignSelf: 'center' },
  message: { fontFamily: fonts.body, fontSize: 14, lineHeight: 18.9, color: '#4A5468', fontWeight: 'normal' },
  tgBtn: { alignSelf: 'flex-start', marginTop: 8, height: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', gap: 7 },
  tgBtnText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#0B1220', fontWeight: 'normal' },
  options: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: { minHeight: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#F4F6FA', justifyContent: 'center' },
  optionOn: { backgroundColor: '#2F5BFF' },
  optionText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#0B1220', fontWeight: 'normal' },
  footer: { paddingTop: 12, paddingHorizontal: 20 },
  cta: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ctaText: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: '#FFFFFF', fontWeight: 'normal' },
});
