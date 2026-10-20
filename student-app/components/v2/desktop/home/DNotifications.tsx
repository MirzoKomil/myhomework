/**
 * Kompyuter: Bildirishnomalar (dizayn: D_Notifications).
 *
 * Ma'lumot mobil ekran (app/v2/bildirishnomalar.tsx) bilan bir xil:
 * fetchDemoNotifications, qurilmadagi "o'qilgan" belgisi (markAllRead) va
 * serverga o'qildi belgisi. Ochilganda ro'yxat o'qilgan bo'ladi — yon menyu
 * va sarlavhadagi qo'ng'iroq nishoni darrov 0 ga tushadi (setShellUnread),
 * nuqtalar esa mobil ekrandagidek shu safar ko'rinib turadi.
 * O'ng ustun: "Ustozga yozish" (ContactSheet), bot holati (telegramLinkStatus).
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View, type TextStyle } from 'react-native';

import { DesktopPage } from '@/components/v2/desktop/Shell';
import { setShellUnread } from '@/components/v2/desktop/shellData';
import { ChatIcon } from '@/components/v2/home/icons';
import { getReadIds, markAllRead } from '@/components/v2/home/shared';
import { BotConnectPopup } from '@/components/v2/popups/BotConnect';
import { ContactSheetPopup } from '@/components/v2/popups/ContactSheet';
import { LiveNowPopup } from '@/components/v2/popups/LiveNow';
import { Loading } from '@/components/v2/states/Loading';
import { ServerError } from '@/components/v2/states/ServerError';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import {
  fetchDemoNotifications,
  fetchDemoSchedule,
  markNotificationsReadOnServer,
  submitAbsenceReason,
  type DemoNotification,
} from '@/services/contentApi';
import { useAuth } from '@/services/studentAuthStore';
import { telegramLinkStatus } from '@/services/telegramLinkApi';

import { CheckIcon, ChevronIcon, DoubleCheckIcon, GiftIcon, TgIcon, TrophyIcon, VideoIcon } from './icons';

const ATTENDANCE_OPTIONS = ['Darsga kirdim', 'Darsga kira olmadim', 'Dars yarmida tugadi'];
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const pad = (n: number) => String(n).padStart(2, '0');

type Kind = 'live' | 'video' | 'done' | 'trophy' | 'gift' | 'rating' | 'grade' | 'telegram';

// Ikonkalar — dizayndan (54px quti, 24–26px belgi).
const ICON: Record<Kind, { bg: string; node: ReactNode }> = {
  live: { bg: '#FDECEC', node: <VideoIcon /> },
  video: { bg: '#FDECEC', node: <VideoIcon /> },
  done: { bg: '#E3F7EE', node: <CheckIcon size={26} color="#087A4A" strokeWidth={2.8} /> },
  trophy: { bg: '#F0EBFF', node: <TrophyIcon /> },
  gift: { bg: '#FFF1E6', node: <GiftIcon /> },
  // Ustozni baholash taklifi dizaynda yo'q — mobil ekrandagi ikonka.
  rating: { bg: '#E8EEFF', node: <ChatIcon size={24} color="#1E3FD1" /> },
  grade: { bg: '#E8EEFF', node: <ChatIcon size={24} color="#1E3FD1" /> },
  telegram: { bg: '#E0F2FC', node: <TgIcon size={24} color="#1B6FA8" /> },
};

// Quyidagi qoidalar mobil ekran bilan aynan bir xil (server id/sarlavhasi bo'yicha).
const isGrade = (n: DemoNotification) => n.interactive !== 'rate-teacher' && /bahosi|baho:/i.test(n.title);
function gradeScore(n: DemoNotification): string | null {
  const m = `${n.title} ${n.message}`.match(/(\d+(?:[.,]\d+)?)\s*\/\s*5\b/);
  return m ? m[1].replace(',', '.') : null;
}
const isBotLinked = (n: DemoNotification) => /telegram bot/i.test(n.title);
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

/** Dizayndagi urg'u: "+46 coin" — to'q sariq qalin, „ruscha ibora“ — qora qalin. Matnning o'zi o'zgarmaydi. */
function Emph({ text }: { text: string }) {
  const parts = text.split(/(\+\d+ coin|„[^“]*“)/);
  return (
    <>
      {parts.map((p, i) =>
        /^\+\d+ coin$/.test(p) ? (
          <Text key={i} style={{ fontFamily: fonts.bodyHeavy, color: '#7A5300' }}>
            {p}
          </Text>
        ) : /^„/.test(p) ? (
          <Text key={i} style={{ fontFamily: fonts.bodyHeavy, color: '#0B1220' }}>
            {p}
          </Text>
        ) : (
          p
        ),
      )}
    </>
  );
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
      .catch(() => {
        setState('idle');
        setSelected(null);
      });
  };
  return (
    <View style={s.options} accessibilityRole="radiogroup">
      {ATTENDANCE_OPTIONS.map((opt) => {
        const on = selected === opt;
        return (
          <Pressable
            key={opt}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: state !== 'idle' }}
            onPress={() => send(opt)}
            style={[s.option, on && { backgroundColor: '#2F5BFF' }]}
          >
            <Text style={[s.optionText, on && { color: '#FFFFFF' }]}>{on && state === 'done' ? `${opt} ✓` : opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DNotifications() {
  const { token } = useAuth();
  const [list, setList] = useState<DemoNotification[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [groupLink, setGroupLink] = useState('');
  const [contactOpen, setContactOpen] = useState(false);
  const [botOpen, setBotOpen] = useState(false);
  const [botLinked, setBotLinked] = useState<boolean | null>(null);
  const { popup } = useLocalSearchParams<{ popup?: string }>();
  const [liveOpen, setLiveOpen] = useState(popup === 'live');
  // Ro'yxat kengligi (1440 da 768). Tor oynada "Telegram guruhga" matn ostiga tushadi.
  const { width: winW } = useWindowDimensions();
  const narrow = winW - 248 - 80 - 344 < 640;

  const loadBot = useCallback(() => {
    if (!token) return;
    telegramLinkStatus()
      .then((st) => setBotLinked(st.linked))
      .catch(() => {});
  }, [token]);

  const load = useCallback(() => {
    setFailed(false);
    setList(null);
    Promise.all([fetchDemoNotifications(), getReadIds()])
      .then(([items, read]) => {
        setReadIds(read);
        setList(items);
        const ids = items.filter((n) => n.unread && !read.has(n.id)).map((n) => n.id);
        void markAllRead(ids);
        void markNotificationsReadOnServer(ids);
        // Ro'yxat ochildi — qo'ng'iroq nishoni darrov yo'qoladi.
        setShellUnread(0);
      })
      .catch(() => setFailed(true));
    fetchDemoSchedule()
      .then((sc) => setGroupLink(sc.telegramGroupLink || ''))
      .catch(() => {});
    loadBot();
  }, [loadBot]);
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
    setShellUnread(0);
  };

  if (failed) return <ServerError onRetry={load} />;
  if (!list) return <Loading withNav={false} />;

  return (
    <>
      <DesktopPage
        title="Bildirishnomalar"
        subtitle={`${unreadCount} ta yangi`}
        back={R.home}
        actions={
          <Pressable accessibilityRole="button" accessibilityLabel="Hammasini oʻqilgan qilish" onPress={readAll} style={s.readAll}>
            <DoubleCheckIcon />
            <Text style={s.readAllText}>Hammasini oʻqilgan qilish</Text>
          </Pressable>
        }
        contentStyle={{ paddingBottom: 32 }}
      >
        <View style={s.row}>
          <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
            {sections.length === 0 && <Text style={s.empty}>Hozircha bildirishnoma yoʻq</Text>}
            {sections.map((sec, si) => (
              <View key={sec.label} style={{ gap: 10 }}>
                <Text style={[s.sectionLabel, si > 0 && { paddingTop: 14 }]}>{sec.label}</Text>
                {sec.items.map((n) => {
                  const kind = kindOf(n);
                  const unread = isUnread(n);
                  const d = new Date(n.date);
                  const target = targetOf(n);
                  const withButton = kind === 'live' && !!groupLink;
                  const withOptions = n.interactive === 'attendance';
                  const tgButton = (
                    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(groupLink).catch(() => {})} style={[s.tgBtn, narrow && { alignSelf: 'flex-start', marginTop: 8 }]}>
                      <TgIcon size={17} />
                      <Text style={s.tgBtnText}>Telegram guruhga</Text>
                    </Pressable>
                  );
                  const content = (
                    <>
                      <View style={[s.icon, { backgroundColor: ICON[kind].bg }]}>
                        {kind === 'grade' && gradeScore(n) ? <Text style={s.score}>{gradeScore(n)}</Text> : ICON[kind].node}
                      </View>
                      <View style={s.body}>
                        {kind === 'live' ? (
                          <Pressable accessibilityRole="link" onPress={() => setLiveOpen(true)} style={s.liveTitle}>
                            <Text style={s.title}>{n.title}</Text>
                            <ChevronIcon size={17} color="#2F5BFF" strokeWidth={2.6} />
                          </Pressable>
                        ) : (
                          <Text style={s.title}>{n.title}</Text>
                        )}
                        <Text style={s.message}>
                          <Emph text={n.message} />
                        </Text>
                        {withOptions && <AttendanceOptions n={n} />}
                        {withButton && narrow && tgButton}
                      </View>
                      {withButton && !narrow && tgButton}
                      <Text style={s.time}>
                        {pad(d.getHours())}:{pad(d.getMinutes())}
                      </Text>
                      {unread ? <View accessibilityRole="image" accessibilityLabel="Oʻqilmagan" style={s.dot} /> : <View style={{ width: 10 }} />}
                    </>
                  );
                  const rowStyle = [s.item, unread ? s.itemUnread : s.itemRead];
                  return target && !withButton && !withOptions ? (
                    <Pressable key={n.id} accessibilityRole="link" onPress={() => router.push(target)} style={rowStyle}>
                      {content}
                    </Pressable>
                  ) : (
                    <View key={n.id} style={rowStyle}>
                      {content}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={s.aside}>
            <View style={s.ask}>
              <Image source={designImages['2770f303e2a36a9ec52c3a0b44e9b032']} style={s.askImg} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />
              <Text style={s.askTitle}>Savolingiz bormi?</Text>
              <Text style={s.askText}>Ustoz, yordamchi ustoz yoki support bilan Telegramda bogʻlaning.</Text>
              <Pressable accessibilityRole="button" onPress={() => setContactOpen(true)} style={s.askBtn}>
                <TgIcon size={19} color="#1E3FD1" />
                <Text style={s.askBtnText}>Ustozga yozish</Text>
              </Pressable>
            </View>
            {/* Bot holati — haqiqiy (telegramLinkStatus). Ulanmagan bo'lsa ulash oynasi ochiladi. */}
            <Pressable
              accessibilityRole={botLinked === false ? 'button' : 'link'}
              onPress={() => (botLinked === false ? setBotOpen(true) : router.push(R.settings as Href))}
              style={s.bot}
            >
              <View style={s.botIcon}>
                <TgIcon size={22} color="#1B6FA8" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.botName}>@Domworkuz_bot</Text>
                {botLinked !== null && (
                  <View style={s.botStatus}>
                    <View style={[s.botDot, botLinked === false && { backgroundColor: '#FF7A1A' }]} />
                    <Text style={[s.botStatusText, botLinked === false && { color: '#B34700' }]}>
                      {botLinked ? 'Ulangan · eslatmalar keladi' : 'Ulanmagan · ulash'}
                    </Text>
                  </View>
                )}
              </View>
              <ChevronIcon size={18} />
            </Pressable>
            <View style={s.tip}>
              <Image source={designImages.ea02e684d881c58fa4cba7467756a2c8} style={{ width: 120, height: 120 }} resizeMode="contain" />
              <Text style={s.tipText}>Muhim xabarlar Telegramga ham keladi — ilovani ochmasangiz ham hech narsani oʻtkazib yubormaysiz.</Text>
            </View>
          </View>
        </View>
      </DesktopPage>
      <ContactSheetPopup visible={contactOpen} onClose={() => setContactOpen(false)} />
      <LiveNowPopup visible={liveOpen} onClose={() => setLiveOpen(false)} />
      <BotConnectPopup
        visible={botOpen}
        onClose={() => {
          setBotOpen(false);
          loadBot();
        }}
      />
    </>
  );
}

const T = (f: string, size: number, extra?: TextStyle): TextStyle => ({ fontFamily: f, fontWeight: 'normal', fontSize: size, ...extra });

const s = StyleSheet.create({
  readAll: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 6,
  },
  readAllText: T(fonts.bodyHeavy, 14, { color: '#1E3FD1' }),
  row: { flex: 1, flexDirection: 'row', gap: 24, alignItems: 'stretch' },
  empty: T(fonts.body, 15, { color: '#4A5468', paddingHorizontal: 4 }),
  sectionLabel: T(fonts.bodyHeavy, 12, { letterSpacing: 0.96, textTransform: 'uppercase', color: '#4A5468', paddingVertical: 2, paddingHorizontal: 4 }),
  item: { borderRadius: 22, paddingVertical: 22, paddingRight: 22, paddingLeft: 18, flexDirection: 'row', alignItems: 'center', gap: 16 },
  itemUnread: { backgroundColor: '#FFFFFF' },
  itemRead: { backgroundColor: 'transparent', boxShadow: 'inset 0 0 0 1px #E4E8F0' },
  icon: { width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  score: T(fonts.bodyHeavy, 17, { color: '#1E3FD1' }),
  body: { flex: 1, minWidth: 0, gap: 3 },
  liveTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  title: T(fonts.bodyHeavy, 16, { color: '#0B1220' }),
  message: T(fonts.bodyBold, 14, { color: '#4A5468' }),
  tgBtn: { height: 44, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  tgBtnText: T(fonts.bodyHeavy, 14, { color: '#0B1220' }),
  time: T(fonts.bodyBold, 14, { color: '#4A5468', width: 48, textAlign: 'right' }),
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2F5BFF', flexShrink: 0 },
  options: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: { minHeight: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#F4F6FA', justifyContent: 'center' },
  optionText: T(fonts.bodyHeavy, 14, { color: '#0B1220' }),

  aside: { width: 320, flexShrink: 0, alignSelf: 'flex-start', gap: 14 },
  ask: { backgroundColor: '#2F5BFF', borderRadius: 26, padding: 22, gap: 12, overflow: 'hidden' },
  askImg: { position: 'absolute', right: -10, top: -4, width: 120, height: 120 },
  askTitle: T(fonts.display, 24, { lineHeight: 27.6, letterSpacing: -0.48, color: '#FFFFFF', maxWidth: 170 }),
  askText: T(fonts.bodyBold, 14, { lineHeight: 20.3, color: '#FFFFFF', maxWidth: 240 }),
  askBtn: {
    marginTop: 4,
    height: 52,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    boxShadow: '0 5px 0 #1E3FD1',
  },
  askBtnText: T(fonts.bodyHeavy, 15, { color: '#1E3FD1' }),
  bot: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  botIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#E0F2FC', alignItems: 'center', justifyContent: 'center' },
  botName: T(fonts.bodyHeavy, 15, { color: '#0B1220' }),
  botStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  botDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#12A26A' },
  botStatusText: T(fonts.bodyHeavy, 13, { color: '#087A4A' }),
  tip: { height: 359, backgroundColor: '#FFF4D1', borderRadius: 24, paddingVertical: 20, paddingHorizontal: 22, justifyContent: 'center', gap: 12 },
  tipText: T(fonts.bodyBold, 15, { lineHeight: 22.5, color: '#7A5300' }),
});
