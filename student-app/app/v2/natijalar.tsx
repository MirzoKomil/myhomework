/**
 * v2 Natijalar (dizayn: Progress.dc.html).
 *
 * Kurs progressi — getCourseOverallProgress (eski profile/results.tsx),
 * qolgan kunlar — kurs boshlangan sana (fetchDemoStudentPayments) + 3 oy,
 * jonli darslar va baho — fetchDemoSchedule + fetchDemoGrades (eski
 * grades.tsx hisobi), chaqmoq/coin — lightningStore/coinsStore,
 * ko'nikmalar — getSkillsProgress. Streak va kunlik chaqmoq tarixi hali
 * hech qayerda saqlanmaydi — shu sabab ular 0 / bo'sh holatda.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { BoltIcon, CoinIcon, FlameIcon } from '@/components/v2/profile/icons';
import {
  Column,
  courseEnd,
  DAY_SHORT,
  daysBetween,
  dmy,
  fmtGrade,
  gradeAverage,
  Header,
  liveAttendance,
  parseIso,
} from '@/components/v2/profile/shared';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getCourseOverallProgress, getSkillsProgress, type SkillsProgress } from '@/data/lessonContent';
import { useCoins } from '@/services/coinsStore';
import {
  fetchDemoGrades,
  fetchDemoSchedule,
  fetchDemoStudentPayments,
  fetchMobileContent,
  type DemoScheduleResponse,
  type LiveGradeEntry,
} from '@/services/contentApi';
import { useLightning } from '@/services/lightningStore';

const R_ = 35;
const C = 2 * Math.PI * R_;
const BAR_H = 92;

export default function V2Progress() {
  const insets = useSafeAreaInsets();
  const lightning = useLightning();
  const coins = useCoins();
  const [course, setCourse] = useState({ done: 0, total: 72, percent: 0 });
  const [courseName, setCourseName] = useState('');
  const [startIso, setStartIso] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<DemoScheduleResponse | null>(null);
  const [grades, setGrades] = useState<LiveGradeEntry[]>([]);
  const [skills, setSkills] = useState<SkillsProgress | null>(null);

  useFocusEffect(
    useCallback(() => {
      getCourseOverallProgress().then(setCourse).catch(() => {});
      getSkillsProgress().then(setSkills).catch(() => {});
    }, []),
  );
  useEffect(() => {
    fetchMobileContent().then((mc) => setCourseName(mc.courses[0]?.name ?? '')).catch(() => {});
    fetchDemoStudentPayments().then((p) => setStartIso(p?.courseStartDate ?? null)).catch(() => {});
    fetchDemoSchedule().then(setSchedule).catch(() => {});
    fetchDemoGrades().then((g) => setGrades(g.grades)).catch(() => {});
  }, []);

  const start = parseIso(startIso ?? schedule?.courseStartDate);
  const end = start ? courseEnd(start) : null;
  const left = end ? Math.max(0, daysBetween(new Date(), end)) : 0;
  const live = liveAttendance(schedule, grades);
  const avg = gradeAverage(grades);
  const pct = course.percent;

  // Oxirgi 7 kun (bugun oxirida). Kunlik chaqmoq tarixi saqlanmaydi — 0.
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { label: i === 6 ? 'Bugun' : DAY_SHORT[d.getDay()], value: 0 };
  });
  const weekTotal = week.reduce((s, d) => s + d.value, 0);
  const max = Math.max(1, ...week.map((d) => d.value));

  const skillRows = [
    { label: 'Lugʻat', value: skills?.vocabulary ?? 0, color: '#7C4DFF' },
    { label: 'Grammatika', value: skills?.grammar ?? 0, color: '#2F5BFF' },
    { label: 'Tinglash', value: skills?.listening ?? 0, color: '#0FA968' },
    { label: 'Yozish', value: skills?.writing ?? 0, color: '#FF7A1A' },
  ];

  return (
    <View style={st.screen}>
      <Header title="Natijalar" subtitle={courseName} subtitleWeight="bold" fallback={R.profile} variant="b" />
      <ScrollView contentContainerStyle={[st.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <Column style={st.col}>
          <View style={st.hero}>
            <View style={st.ring}>
              <Svg width={84} height={84} viewBox="0 0 84 84" accessibilityRole="image" accessibilityLabel={`Kurs ${pct}% bajarildi`}>
                <Circle cx="42" cy="42" r={R_} fill="none" stroke="#26304A" strokeWidth={9} />
                {pct > 0 && (
                  <Circle
                    cx="42" cy="42" r={R_} fill="none" stroke="#3DDC97" strokeWidth={9} strokeLinecap="round"
                    strokeDasharray={`${(C * pct) / 100} ${C}`} transform="rotate(-90 42 42)"
                  />
                )}
              </Svg>
              <View style={StyleSheet.absoluteFill}><View style={st.ringCenter}><Text style={st.ringText}>{`${pct}%`}</Text></View></View>
            </View>
            <View style={st.heroText}>
              <Text style={st.heroTitle}>{`${course.done} / ${course.total} dars`}</Text>
              <Text style={st.heroSub}>{end ? `${left} kun qoldi · ${dmy(end)} gacha` : ''}</Text>
              <Text style={st.heroSub}>{`Jonli darslar ${live.attended} / ${live.total} · baho ${fmtGrade(avg)}`}</Text>
            </View>
          </View>

          <View style={st.stats}>
            <View style={st.stat}><FlameIcon /><Text style={st.statNum}>0 kun</Text><Text style={st.statLabel}>streak</Text></View>
            <View style={st.stat}><BoltIcon size={20} color="#7C4DFF" /><Text style={st.statNum}>{lightning}</Text><Text style={st.statLabel}>chaqmoq</Text></View>
            <View style={st.stat}><CoinIcon /><Text style={st.statNum}>{coins}</Text><Text style={st.statLabel}>coin</Text></View>
          </View>

          <View accessibilityLabel="Oxirgi 7 kun" style={st.card7}>
            <View style={st.cardHead}>
              <Text style={st.cardTitle}>Oxirgi 7 kun</Text>
              <Text style={st.weekTotal}>{`${weekTotal} chaqmoq`}</Text>
            </View>
            <View style={st.bars}>
              {week.map((d, i) => (
                <View key={i} style={st.barCol}>
                  <Text style={st.barVal}>{d.value}</Text>
                  <View style={st.barBox}>
                    {d.value > 0 && (
                      <View style={[st.bar, { height: Math.round((d.value / max) * 89), backgroundColor: i === 6 ? '#C9B8FF' : '#7C4DFF' }]} />
                    )}
                  </View>
                  <Text style={[st.barDay, i === 6 && st.barToday]}>{d.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View accessibilityLabel="Koʻnikmalar" style={st.skills}>
            <Text style={st.cardTitle}>Koʻnikmalar</Text>
            {skillRows.map((s) => (
              <View key={s.label} style={{ gap: 5 }}>
                <View style={st.skillHead}>
                  <Text style={st.skillLabel}>{s.label}</Text>
                  <Text style={[st.skillLabel, { color: '#4A5468' }]}>{`${s.value}%`}</Text>
                </View>
                <View style={st.skillTrack}><View style={[st.skillFill, { width: `${s.value}%`, backgroundColor: s.color }]} /></View>
              </View>
            ))}
          </View>
        </Column>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { paddingHorizontal: 20, paddingTop: 14 },
  col: { gap: 12 },
  hero: { backgroundColor: '#0B1220', borderRadius: 24, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 16 },
  ring: { width: 84, height: 84, flexShrink: 0 },
  ringCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ringText: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 22, color: '#FFFFFF' },
  heroText: { flex: 1, gap: 3 },
  heroTitle: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 24, lineHeight: 33, color: '#FFFFFF' },
  heroSub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#B8C1D6' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 12, gap: 2 },
  statNum: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 20, lineHeight: 27, color: '#0B1220' },
  statLabel: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468' },
  card7: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, lineHeight: 22, color: '#0B1220' },
  weekTotal: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, color: '#5A2FD6' },
  bars: { flexDirection: 'row', gap: 4 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barVal: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 11, lineHeight: 15, color: '#4A5468' },
  barBox: { height: BAR_H, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 26, borderRadius: 8 },
  barDay: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468' },
  barToday: { fontFamily: fonts.bodyHeavy, color: '#0B1220' },
  skills: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  skillHead: { flexDirection: 'row', justifyContent: 'space-between' },
  skillLabel: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 14, lineHeight: 19, color: '#0B1220' },
  skillTrack: { height: 8, borderRadius: 4, backgroundColor: '#EEF1F7', overflow: 'hidden' },
  skillFill: { height: 8, borderRadius: 4 },
});
