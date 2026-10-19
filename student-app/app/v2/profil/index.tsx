/**
 * v2 Profil (dizayn: Profile.dc.html).
 *
 * Ma'lumotlar eski profile/index.tsx bilan bir xil manbalardan: ism/ID —
 * fetchDemoStudentProfile, avatar — avatarStore, daraja — lightningStore,
 * jonli darslar va baho — fetchDemoSchedule + fetchDemoGrades, o'tilgan
 * darslar — getCourseOverallProgress, sertifikatlar — examStore, tarif va
 * qarz — fetchDemoStudentPayments, guruh — jonli dars mavzusidan.
 */
import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEFAULT_PRESET, presetSource } from '@/components/v2/profile/avatars';
import {
  BoltIcon,
  CalendarIcon,
  CardIcon,
  ChartIcon,
  BagIcon,
  ChevronIcon,
  GearIcon,
  PencilIcon,
  RibbonIcon,
  TeacherIcon,
} from '@/components/v2/profile/icons';
import {
  certificateStates,
  Column,
  fmtGrade,
  go,
  gradeAverage,
  groupFromTopic,
  levelInfo,
  liveAttendance,
  money,
} from '@/components/v2/profile/shared';
import { TabBar } from '@/components/v2/TabBar';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getCourseOverallProgress } from '@/data/lessonContent';
import { useAvatarUri } from '@/services/avatarStore';
import { useCoins } from '@/services/coinsStore';
import {
  fetchDemoGrades,
  fetchDemoSchedule,
  fetchDemoStudentPayments,
  fetchDemoStudentProfile,
  type DemoPaymentsResponse,
  type DemoScheduleResponse,
  type LiveGradeEntry,
} from '@/services/contentApi';
import { useExamResults } from '@/services/examStore';
import { useLightning } from '@/services/lightningStore';
import { useV2Level } from '@/constants/v2/levels';
import { clearAuth, useAuth } from '@/services/studentAuthStore';

const formatStudentId = (value?: string) => {
  const id = String(value || '').trim();
  if (/^s\d+$/i.test(id)) return id.slice(-6);
  return id;
};

function MenuRow({ icon, label, right, onPress, last }: { icon: React.ReactNode; label: string; right?: React.ReactNode; onPress: () => void; last?: boolean }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [st.row, !last && st.rowBorder, pressed && st.pressed]}>
      {icon}
      <Text style={st.rowLabel} numberOfLines={1}>{label}</Text>
      {right}
      <ChevronIcon />
    </Pressable>
  );
}

export default function V2Profile() {
  const insets = useSafeAreaInsets();
  const { token, student } = useAuth();
  const isEmbedded = Platform.OS === 'web' && typeof window !== 'undefined' && window.self !== window.top;
  const avatarUri = useAvatarUri();
  const lightning = useLightning();
  // Daraja — v2 oraliqlari, hech qachon pasaymaydi (constants/v2/levels).
  const v2Level = useV2Level();
  const examResults = useExamResults();
  const coins = useCoins();

  const [name, setName] = useState(student?.name ?? '');
  const [studentId, setStudentId] = useState(formatStudentId(student?.studentId || student?.id));
  const [schedule, setSchedule] = useState<DemoScheduleResponse | null>(null);
  const [grades, setGrades] = useState<LiveGradeEntry[]>([]);
  const [payments, setPayments] = useState<DemoPaymentsResponse | null>(null);
  const [lessonsDone, setLessonsDone] = useState(0);

  useEffect(() => {
    if (!token && !isEmbedded) return;
    fetchDemoStudentProfile()
      .then((p) => {
        if (p?.name) setName(p.name);
        if (p?.studentId) setStudentId(formatStudentId(p.studentId));
        if (!p?.name && token) void clearAuth();
      })
      .catch(() => {});
    fetchDemoSchedule().then(setSchedule).catch(() => {});
    fetchDemoGrades().then((g) => setGrades(g.grades)).catch(() => {});
    fetchDemoStudentPayments().then(setPayments).catch(() => {});
  }, [token, isEmbedded]);

  useFocusEffect(
    useCallback(() => {
      if (!token && !isEmbedded) return;
      getCourseOverallProgress().then((p) => setLessonsDone(p.done)).catch(() => {});
    }, [token, isEmbedded]),
  );

  if (!token && !isEmbedded) return <Redirect href="/v2/login" />;

  const lvl = levelInfo(v2Level);
  const live = liveAttendance(schedule, grades);
  const avg = gradeAverage(grades);
  const certs = certificateStates(examResults, lessonsDone);
  const certsDone = certs.filter((c) => c.passed).length;
  const group = groupFromTopic(schedule?.topic);
  const firstName = name.split(' ')[0] || ' ';
  const debt = payments?.debtAmount ?? 0;
  const avatarSrc = avatarUri ? { uri: avatarUri } : presetSource(DEFAULT_PRESET.id);

  return (
    <View style={st.screen}>
      <ScrollView contentContainerStyle={[st.content, { paddingTop: Math.max(insets.top, 44) + 12 }]} showsVerticalScrollIndicator={false}>
        <Column style={st.col}>
          <View style={st.header}>
            <Pressable accessibilityRole="link" accessibilityLabel="Profil va avatarni tahrirlash" onPress={() => go(R.profileEdit)} style={st.avatarWrap}>
              <Image source={avatarSrc} style={st.avatar} />
              <View style={st.editBadge}><PencilIcon /></View>
            </Pressable>
            <View style={st.who}>
              <View style={st.nameRow}>
                <Text style={st.name} numberOfLines={1}>{firstName}</Text>
                {!!payments?.tariffLabel && <View style={st.tariff}><Text style={st.tariffText}>{payments.tariffLabel}</Text></View>}
              </View>
              <Text style={st.idText} numberOfLines={1}>
                {`ID ${studentId}`}{group ? ` · ${group} guruh` : ''}
              </Text>
            </View>
            <Pressable accessibilityRole="link" accessibilityLabel="Sozlamalar" onPress={() => go(R.settings)} style={st.gear}>
              <GearIcon />
            </Pressable>
          </View>

          <Pressable accessibilityRole="link" onPress={() => go(R.levels)} style={({ pressed }) => [st.level, pressed && st.pressed]}>
            <View style={st.levelTop}>
              <View style={st.levelLeft}>
                <Image source={designImages[lvl.ui.img]} accessibilityLabel={`${lvl.index + 1}-daraja nishoni`} style={st.badge} resizeMode="contain" />
                <View style={{ gap: 2 }}>
                  <Text style={st.levelOver}>{`DARAJA ${lvl.index + 1}`}</Text>
                  <Text style={st.levelName}>{lvl.ui.name}</Text>
                </View>
              </View>
              <View style={st.boltRow}>
                <BoltIcon />
                <Text style={st.boltNum}>{money(lightning)}</Text>
              </View>
            </View>
            <View style={st.levelTrack}><View style={[st.levelFill, { width: `${lvl.progressPercent}%` }]} /></View>
            <View style={st.levelFoot}>
              <Text style={st.levelFootText} numberOfLines={1}>
                {lvl.nextUi ? `Keyingi: ${lvl.index + 2} · ${lvl.nextUi.name}` : 'Eng yuqori daraja'}
              </Text>
              {!!lvl.nextUi && (
                <View style={st.levelRemain} accessible accessibilityLabel={`yana ${money(lvl.remaining)} chaqmoq`}>
                  <Text style={st.levelRemainText}>{`yana ${money(lvl.remaining)}`}</Text>
                  <BoltIcon size={12} color="#FFC21A" />
                </View>
              )}
              <ChevronIcon size={16} color="#FFFFFF" />
            </View>
          </Pressable>

          <View style={st.stats}>
            <View style={st.stat}>
              <Text style={st.statNum}>{`${live.attended} / ${live.total}`}</Text>
              <Text style={st.statLabel}>Jonli darsga kelish</Text>
            </View>
            <View style={st.stat}>
              <Text style={st.statNum}>{lessonsDone}</Text>
              <Text style={st.statLabel}>Dars oʻtildi</Text>
            </View>
            <View style={st.stat}>
              <Text style={st.statNum}>{fmtGrade(avg)}</Text>
              <Text style={st.statLabel}>{'Oʻrtacha baho (5 dan)'}</Text>
            </View>
          </View>

          <View style={st.section}>
            <Text style={st.sectionTitle}>Oʻqish</Text>
            <View style={st.group}>
              <MenuRow icon={<ChartIcon />} label="Natijalarim" onPress={() => go(R.progress)} />
              <MenuRow icon={<CalendarIcon />} label="Dars jadvali va davomat" onPress={() => go(R.schedule)} />
              <MenuRow icon={<RibbonIcon />} label="Sertifikatlarim" right={<Text style={st.rowValue}>{`${certsDone} / ${certs.length}`}</Text>} onPress={() => go(R.certificates)} />
              <MenuRow icon={<TeacherIcon />} label="Ustozlarim" onPress={() => go(R.teachers)} last />
            </View>
          </View>

          <View style={st.section}>
            <Text style={st.sectionTitle}>Hisob</Text>
            <View style={st.group}>
              <MenuRow
                icon={<CardIcon />}
                label="Toʻlovlar va tarif"
                right={debt > 0 ? <View style={st.debt}><Text style={st.debtText}>{`Qarz ${money(debt)}`}</Text></View> : undefined}
                onPress={() => go(R.payments)}
              />
              <MenuRow
                icon={<BagIcon />}
                label="Doʻkon va buyurtmalarim"
                right={
                  <View style={st.coinRow}>
                    <View style={st.coinDot} />
                    <Text style={st.rowValue}>{coins}</Text>
                  </View>
                }
                onPress={() => go(R.shop)}
                last
              />
            </View>
          </View>
        </Column>
      </ScrollView>
      <TabBar active="profile" />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  col: { gap: 14 },
  pressed: { opacity: 0.85 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarWrap: { width: 64, height: 64, flexShrink: 0 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF1E6' },
  editBadge: {
    position: 'absolute', right: -3, bottom: -3, width: 26, height: 26, borderRadius: 13, backgroundColor: '#2F5BFF',
    borderWidth: 3, borderColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center',
  },
  who: { flex: 1, minWidth: 0, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontFamily: fonts.display, fontWeight: 'normal', fontSize: 24, lineHeight: 33, letterSpacing: -0.24, color: '#0B1220' },
  tariff: { height: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: '#E8EEFF', justifyContent: 'center' },
  tariffText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#1E3FD1' },
  idText: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  gear: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  level: { backgroundColor: '#6A3CF0', borderRadius: 24, paddingVertical: 16, paddingHorizontal: 18, gap: 10 },
  levelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 52, height: 52, marginVertical: -6 },
  levelOver: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16, letterSpacing: 0.72, color: '#FFFFFF' },
  levelName: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 24, lineHeight: 30, color: '#FFFFFF' },
  boltRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  boltNum: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 22, lineHeight: 28, color: '#FFFFFF' },
  levelTrack: { height: 8, borderRadius: 4, backgroundColor: '#5A2FD6', overflow: 'hidden' },
  levelFill: { height: 8, borderRadius: 4, backgroundColor: '#FFC93C' },
  levelFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Dizayn: "yana N ⚡" o'ngga suriladi (margin-left: auto; padding-left: 8px)
  levelRemain: { marginLeft: 'auto', paddingLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  levelRemainText: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#FFFFFF' },
  levelFootText: { flexShrink: 1, fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#FFFFFF' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 12, gap: 2 },
  statNum: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 22, lineHeight: 28, color: '#0B1220' },
  statLabel: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 15.6, color: '#4A5468' },
  section: { gap: 6 },
  sectionTitle: {
    fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16, letterSpacing: 0.72, color: '#4A5468',
    textTransform: 'uppercase', paddingLeft: 4,
  },
  group: { backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden' },
  row: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  rowLabel: { flex: 1, minWidth: 0, fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 15, color: '#0B1220' },
  rowValue: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, color: '#4A5468' },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  // Coin: 14px sariq doira + ichki 2.5px och-sariq halqa (box-shadow inset)
  coinDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#F5B70A', borderWidth: 2.5, borderColor: '#FFD75E' },
  debt: { height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#FDECEC', justifyContent: 'center' },
  debtText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#B42318' },
});
