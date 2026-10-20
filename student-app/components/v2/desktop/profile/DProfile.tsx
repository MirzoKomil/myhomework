/**
 * Kompyuter: Profil (dizayn: D_Profile).
 *
 * Ma'lumot mobil Profil (app/v2/profil/index.tsx) bilan bir xil manbalardan:
 * ism/ID/telefon — fetchDemoStudentProfile, login — auth, jadval/guruh —
 * fetchDemoSchedule, baholar — fetchDemoGrades, tarif/qarz/kurs boshlanishi —
 * fetchDemoStudentPayments, kurs nomi — fetchMobileContent, o'tilgan darslar —
 * getCourseOverallProgress, sertifikatlar — examStore, daraja — useV2Level +
 * lightningStore, coin — coinsStore. Qo'shimcha (faqat kompyuter dizaynida):
 * haftalik chaqmoq — haftalik reyting (fetchLeaderboard weekly), bugungi
 * maqsad — kunlik reyting (DMain'dagidek), seriya — shell (fetchMyProgress),
 * faol qurilmalar — /api/auth/sessions.
 */
import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, type ReactNode } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { fmtNum } from '@/components/v2/desktop/Shell';
import { useShellInfo } from '@/components/v2/desktop/shellData';
import { DEFAULT_PRESET, presetSource } from '@/components/v2/profile/avatars';
import {
  certificateStates,
  courseEnd,
  dm,
  dmy,
  fmtGrade,
  gradeAverage,
  groupFromTopic,
  levelInfo,
  liveAttendance,
  money,
  parseIso,
  supportUrl,
  tgByPhone,
} from '@/components/v2/profile/shared';
import { TIERS } from '@/components/v2/rewards/parts';
import { fetchSessions } from '@/components/v2/settings/sessions';
import { designImages } from '@/constants/v2/designImages';
import { useV2Level } from '@/constants/v2/levels';
import { R } from '@/constants/v2/routes';
import { COURSE_TOTAL_LESSONS } from '@/data/certificates';
import { getCourseOverallProgress } from '@/data/lessonContent';
import { useLang } from '@/i18n/LanguageContext';
import { useAvatarUri } from '@/services/avatarStore';
import { useCoins } from '@/services/coinsStore';
import {
  fetchDemoGrades,
  fetchDemoSchedule,
  fetchDemoStudentPayments,
  fetchDemoStudentProfile,
  fetchLeaderboard,
  fetchMobileContent,
  type DemoPaymentsResponse,
  type DemoProfileResponse,
  type DemoScheduleResponse,
  type LiveGradeEntry,
} from '@/services/contentApi';
import { useExamResults } from '@/services/examStore';
import { useLightning } from '@/services/lightningStore';
import { clearAuth, useAuth } from '@/services/studentAuthStore';
import { useCachedState } from '@/services/v2Cache';

import {
  BagIcon,
  BoltIcon,
  CalendarIcon,
  CameraIcon,
  CardIcon,
  ChartIcon,
  ChevronIcon,
  CoinIcon,
  DevicesIcon,
  FlameIcon,
  GearIcon,
  go,
  H,
  LockIcon,
  Over,
  PencilIcon,
  PPage,
  RibbonIcon,
  StarIcon,
  T,
  TeacherIcon,
  TgIcon,
  VideoIcon,
} from './ui';

const DAILY_GOAL = 50;

const formatStudentId = (value?: string) => {
  const id = String(value || '').trim();
  if (/^s\d+$/i.test(id)) return id.slice(-6);
  return id;
};

export function DProfile() {
  const { token, student } = useAuth();
  const isEmbedded = Platform.OS === 'web' && typeof window !== 'undefined' && window.self !== window.top;
  const { courseLang } = useLang();
  const avatarUri = useAvatarUri();
  const lightning = useLightning();
  const v2Level = useV2Level();
  const examResults = useExamResults();
  const coins = useCoins();
  const shell = useShellInfo();

  const [profile, setProfile] = useCachedState<DemoProfileResponse | null>('dprofil.profile', null);
  const [schedule, setSchedule] = useCachedState<DemoScheduleResponse | null>('profil.schedule', null);
  const [grades, setGrades] = useCachedState<LiveGradeEntry[]>('profil.grades', []);
  const [payments, setPayments] = useCachedState<DemoPaymentsResponse | null>('profil.payments', null);
  const [lessonsDone, setLessonsDone] = useCachedState('profil.lessonsDone', 0);
  const [courseName, setCourseName] = useCachedState('dprofil.course', '');
  const [weekLightning, setWeekLightning] = useCachedState('dprofil.week', 0);
  const [todayLightning, setTodayLightning] = useCachedState('home.todayLightning', 0);
  const [devices, setDevices] = useCachedState<number | null>('dset.devices', null);

  useEffect(() => {
    if (!token && !isEmbedded) return;
    fetchDemoStudentProfile()
      .then((p) => {
        if (p?.name) setProfile(p);
        if (!p?.name && token) void clearAuth();
      })
      .catch(() => {});
    fetchDemoSchedule().then(setSchedule).catch(() => {});
    fetchDemoGrades().then((g) => setGrades(g.grades)).catch(() => {});
    fetchDemoStudentPayments().then(setPayments).catch(() => {});
    fetchMobileContent().then((mc) => setCourseName(mc.courses[0]?.name ?? '')).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isEmbedded]);

  useFocusEffect(
    useCallback(() => {
      if (!token && !isEmbedded) return;
      getCourseOverallProgress().then((p) => setLessonsDone(p.done)).catch(() => {});
      fetchLeaderboard('country', 'weekly')
        .then((l) => setWeekLightning(l.find((e) => e.isMe)?.lightning ?? 0))
        .catch(() => {});
      fetchLeaderboard('country', 'daily')
        .then((l) => setTodayLightning(l.find((e) => e.isMe)?.lightning ?? 0))
        .catch(() => {});
      if (token) fetchSessions().then((l) => setDevices(l.length)).catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, isEmbedded]),
  );

  if (!token && !isEmbedded) return <Redirect href="/v2/login" />;

  const name = profile?.name || student?.name || '';
  const studentId = formatStudentId(profile?.studentId || student?.studentId || student?.id);
  const lvl = levelInfo(v2Level);
  const live = liveAttendance(schedule, grades);
  const avg = gradeAverage(grades);
  const certs = certificateStates(examResults, lessonsDone);
  const certsDone = certs.filter((c) => c.passed).length;
  const group = groupFromTopic(schedule?.topic);
  const debt = payments?.debtAmount ?? 0;
  const due = parseIso(payments?.paymentDueDate);
  const start = parseIso(payments?.courseStartDate);
  const end = start ? courseEnd(start) : null;
  const avatarSrc = avatarUri ? { uri: avatarUri } : presetSource(DEFAULT_PRESET.id);
  const managerUrl = tgByPhone(profile?.salesManagerPhone ?? '', supportUrl(courseLang));
  const pct = Math.round((lessonsDone / COURSE_TOTAL_LESSONS) * 100);
  // Haftalik liga pog'onasi serverda yo'q — Liga ekranidagidek hamma Bronza.
  const tier = TIERS[0];

  const idLine = [studentId ? `ID ${studentId}` : '', group ? `${group} guruh` : '', courseName ? `«${courseName}»` : ''].filter(Boolean).join(' · ');
  const facts: { k: string; v: string }[] = [
    { k: 'Telefon', v: profile?.phone ?? '' },
    { k: 'Login', v: student?.login || profile?.studentId || '' },
    { k: 'Parol', v: '••••••••' },
    { k: 'Kurs muddati', v: start && end ? `${dm(start)} – ${dmy(end)}` : '' },
    { k: 'Tarif', v: payments ? `${payments.tariffLabel} · ${payments.lessonDuration} daq` : '' },
    { k: 'Guruh', v: group },
  ];

  return (
    <PPage
      title="Profil"
      subtitle="Shaxsiy maʼlumotlar va natijalar"
      actions={
        <Pressable accessibilityRole="link" onPress={() => go(R.settings)} style={s.settingsBtn}>
          <GearIcon size={19} color="#0B1220" />
          <T size={14}>Sozlamalar</T>
        </Pressable>
      }
    >
      <View style={{ gap: 20 }}>
        <View style={s.row}>
          {/* Shaxsiy karta (grid-column: span 7) */}
          <View style={[s.card, { flex: 616.33 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <Pressable accessibilityRole="link" accessibilityLabel="Avatarni almashtirish" onPress={() => go(R.profileEdit)} style={s.avatarWrap}>
                <Image source={avatarSrc} accessibilityLabel="Avatar" style={s.avatar} />
                <View style={s.editBadge}>
                  <PencilIcon />
                </View>
              </Pressable>
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <H size={30} lines={1} style={{ flexShrink: 1 }}>
                    {name}
                  </H>
                  {!!payments?.tariffLabel && (
                    <View style={s.tariff}>
                      <T size={13} color="#1E3FD1">
                        {payments.tariffLabel}
                      </T>
                    </View>
                  )}
                </View>
                <T f="body" size={14} color="#4A5468" lines={1}>
                  {idLine}
                </T>
                <Pressable accessibilityRole="link" onPress={() => go(R.profileEdit)} style={s.avatarBtn}>
                  <CameraIcon />
                  <T size={14} color="#1E3FD1">
                    Avatarni almashtirish
                  </T>
                </Pressable>
              </View>
            </View>
            <View style={s.facts}>
              {[facts.slice(0, 3), facts.slice(3)].map((row, ri) => (
                <View key={ri} style={{ flexDirection: 'row', gap: 20 }}>
                  {row.map((f) => (
                    <View key={f.k} style={s.fact}>
                      <T f="bodyBold" size={12} color="#4A5468">
                        {f.k}
                      </T>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <T size={15} lines={1} style={{ flexShrink: 1 }}>
                          {f.v}
                        </T>
                        <LockIcon />
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <LockIcon size={16} color="#4A5468" />
              <T f="body" size={14} color="#4A5468" style={{ flex: 1 }}>
                Maʼlumotlarni oʻzgartirish uchun menejerga yozing
              </T>
              <Pressable accessibilityRole="link" onPress={() => Linking.openURL(managerUrl).catch(() => {})} style={s.tgBtn}>
                <TgIcon />
                <T size={14}>Menejerga yozish</T>
              </Pressable>
            </View>
          </View>

          {/* Daraja kartasi (span 5) */}
          <Pressable accessibilityRole="link" onPress={() => go(R.levels)} style={[s.level, { flex: 427.67 }]}>
            <View style={s.levelBlob} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Image source={designImages[lvl.ui.img]} accessibilityLabel={`${lvl.index + 1}-daraja nishoni`} style={{ width: 84, height: 92 }} resizeMode="contain" />
              <View style={{ flex: 1, gap: 2 }}>
                <Over color="#E4DBFF">{`Daraja ${lvl.index + 1}`}</Over>
                <H size={34} lh={1.05} color="#FFFFFF">
                  {lvl.ui.name}
                </H>
              </View>
              <ChevronIcon size={22} color="#FFFFFF" sw={2.4} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <BoltIcon />
                <T f="display" size={40} color="#FFFFFF" lh={48}>
                  {money(lightning)}
                </T>
              </View>
              <T f="bodyBold" size={15} color="#E4DBFF">
                chaqmoq · jami
              </T>
            </View>
            <View style={{ gap: 8 }}>
              <View style={s.levelTrack}>
                <View style={[s.levelFill, { width: `${lvl.progressPercent}%` }]} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T f="bodyBold" size={14} color="#FFFFFF">
                  {lvl.nextUi ? `Keyingi: ${lvl.index + 2} · ${lvl.nextUi.name}` : 'Eng yuqori daraja'}
                </T>
                {!!lvl.nextUi && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <T f="bodyBold" size={14} color="#FFFFFF">{`yana ${money(lvl.remaining)}`}</T>
                    <BoltIcon size={13} />
                  </View>
                )}
              </View>
            </View>
            <View style={{ marginTop: 'auto', flexDirection: 'row', gap: 10 }}>
              <View style={s.levelTile}>
                <T size={18} color="#FFFFFF">
                  {fmtNum(weekLightning)}
                </T>
                <T f="bodyBold" size={12} color="#E4DBFF">{`shu hafta · ${tier.name} liga`}</T>
              </View>
              <View style={s.levelTile}>
                <T size={18} color="#FFFFFF">{`${Math.min(todayLightning, DAILY_GOAL)} / ${DAILY_GOAL}`}</T>
                <T f="bodyBold" size={12} color="#E4DBFF">
                  bugungi maqsad
                </T>
              </View>
            </View>
          </Pressable>
        </View>

        {/* 4 ta ko'rsatkich (span 3) */}
        <View style={s.row}>
          <Stat bg="#E8EEFF" icon={<ChartIcon size={22} color="#1E3FD1" sw={2.2} />} num={`${lessonsDone} / ${COURSE_TOTAL_LESSONS}`} label={`dars oʻtildi · ${pct}%`} />
          <Stat bg="#FDECEC" icon={<VideoIcon size={22} color="#B42318" sw={2.2} />} num={`${live.attended} / ${live.total}`} label="jonli darsga kelish" />
          <Stat bg="#FFF4D1" icon={<StarIcon size={22} color="#7A5300" sw={2.2} />} num={fmtGrade(avg)} label="oʻrtacha baho (5 dan)" />
          <Stat bg="#FFF1E6" icon={<FlameIcon />} num={`${shell.streak} kun`} label={`seriya · bugun ${shell.streak + 1} boʻladi`} />
        </View>

        <View style={s.row}>
          <Group title="Oʻqish">
            <MenuRow icon={<ChartIcon />} label="Natijalarim" onPress={() => go(R.progress)} />
            <MenuRow icon={<CalendarIcon />} label="Dars jadvali va davomat" right={<Val>{`${live.attended} / ${live.total}`}</Val>} onPress={() => go(R.schedule)} />
            <MenuRow icon={<RibbonIcon />} label="Sertifikatlarim" right={<Val>{`${certsDone} / ${certs.length}`}</Val>} onPress={() => go(R.certificates)} />
            <MenuRow icon={<TeacherIcon />} label="Ustozlarim" onPress={() => go(R.teachers)} last />
          </Group>
          <Group title="Hisob">
            <MenuRow
              icon={<CardIcon />}
              label="Toʻlovlar va tarif"
              right={
                debt > 0 ? (
                  <View style={s.debt}>
                    <T size={13} color="#B42318">{`Qarz ${money(debt)}${due ? ` · ${dm(due)} gacha` : ''}`}</T>
                  </View>
                ) : undefined
              }
              onPress={() => go(R.payments)}
            />
            <MenuRow
              icon={<BagIcon />}
              label="Doʻkon va buyurtmalarim"
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <CoinIcon />
                  <Val>{fmtNum(coins)}</Val>
                </View>
              }
              onPress={() => go(R.shop)}
            />
            <MenuRow icon={<DevicesIcon />} label="Faol qurilmalar" right={devices === null ? undefined : <Val>{`${devices} ta`}</Val>} onPress={() => go(R.devices)} />
            <MenuRow icon={<GearIcon />} label="Sozlamalar" onPress={() => go(R.settings)} last />
          </Group>
        </View>
      </View>
    </PPage>
  );
}

function Stat({ bg, icon, num, label }: { bg: string; icon: ReactNode; num: string; label: string }) {
  return (
    <View style={s.stat}>
      <View style={[s.statIcon, { backgroundColor: bg }]}>{icon}</View>
      <View style={{ gap: 1, flexShrink: 1 }}>
        <H size={26} ls={-0.01}>
          {num}
        </H>
        <T f="bodyBold" size={13} color="#4A5468" lines={1}>
          {label}
        </T>
      </View>
    </View>
  );
}

function Val({ children }: { children: ReactNode }) {
  return (
    <T size={14} color="#4A5468">
      {children}
    </T>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
      <Over style={{ paddingLeft: 4 }}>{title}</Over>
      <View style={s.group}>{children}</View>
    </View>
  );
}

function MenuRow({ icon, label, right, onPress, last }: { icon: ReactNode; label: string; right?: ReactNode; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.menuRow, !last && s.menuBorder, hovered && { backgroundColor: '#FBFCFE' }]}
    >
      {icon}
      <T f="bodyBold" size={15} lines={1} style={{ flex: 1, minWidth: 0 }}>
        {label}
      </T>
      {right}
      <ChevronIcon />
    </Pressable>
  );
}

const s = StyleSheet.create({
  settingsBtn: {
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
  row: { flexDirection: 'row', gap: 20 },
  card: { minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, gap: 20 },
  avatarWrap: { width: 104, height: 104, flexShrink: 0 },
  avatar: { width: 104, height: 104, borderRadius: 52, backgroundColor: '#FFF1E6' },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2F5BFF',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tariff: { height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: '#E8EEFF', justifyContent: 'center' },
  avatarBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: '#E8EEFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  facts: { backgroundColor: '#F4F6FA', borderRadius: 20, paddingVertical: 16, paddingHorizontal: 18, gap: 16 },
  fact: { flex: 1, minWidth: 0, gap: 3 },
  tgBtn: { height: 40, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', gap: 7 },
  level: { minWidth: 0, backgroundColor: '#6A3CF0', borderRadius: 28, padding: 24, gap: 14, overflow: 'hidden' },
  levelBlob: { position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: '#7A52F5' },
  levelTrack: { height: 10, borderRadius: 5, backgroundColor: '#5A2FD6', overflow: 'hidden' },
  levelFill: { height: 10, borderRadius: 5, backgroundColor: '#FFC93C' },
  levelTile: { flex: 1, minWidth: 0, backgroundColor: '#5A2FD6', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, gap: 1 },
  stat: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  statIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  group: { backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden' },
  menuRow: { minHeight: 56, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  debt: { height: 26, paddingHorizontal: 9, borderRadius: 13, backgroundColor: '#FDECEC', justifyContent: 'center' },
});
