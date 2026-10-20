/**
 * Kompyuter: Natijalar (dizayn: D_Progress.dc.html).
 *
 * Ma'lumot mobil Natijalar ekrani bilan bir xil: kurs progressi —
 * getCourseOverallProgress, qolgan kunlar — kurs boshlangan sana + 3 oy,
 * jonli darslar va baho — fetchDemoSchedule + fetchDemoGrades, chaqmoq /
 * coin — lightningStore / coinsStore, ko'nikmalar — getSkillsProgress,
 * imtihonga tayyorgarlik — getExamPrep. Seriya — yon menyudagi bilan bir
 * xil manba (useShellInfo → fetchMyProgress).
 * Kunlik chaqmoq tarixi va seriya himoyasi kunlari hech qayerda saqlanmaydi —
 * "Oxirgi 7 kun" ustunlari 0 (bo'sh), himoya izohi ko'rsatilmaydi.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { getExamPrep, type ExamPrep } from '@/components/v2/profile/examPrep';
import { courseEnd, DAY_SHORT, daysBetween, dmy, fmtGrade, gradeAverage, liveAttendance, parseIso } from '@/components/v2/profile/shared';
import { R } from '@/constants/v2/routes';
import { getCourseOverallProgress, getSkillsProgress, type SkillsProgress } from '@/data/lessonContent';
import { useCoins } from '@/services/coinsStore';
import { fetchDemoGrades, fetchDemoSchedule, fetchDemoStudentPayments, fetchMobileContent, type DemoScheduleResponse, type LiveGradeEntry } from '@/services/contentApi';
import { useExamResults } from '@/services/examStore';
import { useLightning } from '@/services/lightningStore';

import { DesktopPage, fmtNum } from '../Shell';
import { useShellInfo } from '../shellData';
import { go, IBolt, IChevron, IClipboard, ICoin, IFlame, PageTitle, T } from './ui';

const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;
// Dizayn: 107 chaqmoq → 171px ustun.
const BAR_MAX = 171;
const MONTH = 24;

export function DProgress() {
  const lightning = useLightning();
  const coins = useCoins();
  const shell = useShellInfo();
  const examResults = useExamResults();
  const [prep, setPrep] = useState<ExamPrep | null>(null);
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
    fetchMobileContent()
      .then((mc) => setCourseName(mc.courses[0]?.name ?? ''))
      .catch(() => {});
    fetchDemoStudentPayments()
      .then((p) => setStartIso(p?.courseStartDate ?? null))
      .catch(() => {});
    fetchDemoSchedule().then(setSchedule).catch(() => {});
    fetchDemoGrades()
      .then((g) => setGrades(g.grades))
      .catch(() => {});
  }, []);
  useEffect(() => {
    getExamPrep(examResults, course.done).then(setPrep).catch(() => {});
  }, [examResults, course.done]);

  const start = parseIso(startIso ?? schedule?.courseStartDate);
  const end = start ? courseEnd(start) : null;
  const left = end ? Math.max(0, daysBetween(new Date(), end)) : 0;
  const live = liveAttendance(schedule, grades);
  const avg = gradeAverage(grades);
  const pct = course.percent;

  // Oxirgi 7 kun (bugun oxirida). Kunlik chaqmoq tarixi saqlanmaydi — 0 (mobildagi kabi).
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { label: i === 6 ? 'Bugun' : DAY_SHORT[d.getDay()], value: 0 };
  });
  const weekTotal = week.reduce((a, d) => a + d.value, 0);
  const max = Math.max(1, ...week.map((d) => d.value));

  const skillRows = [
    { label: 'Lugʻat', value: skills?.vocabulary ?? 0, color: '#7C4DFF' },
    { label: 'Grammatika', value: skills?.grammar ?? 0, color: '#2F5BFF' },
    { label: 'Tinglash', value: skills?.listening ?? 0, color: '#12A26A' },
    { label: 'Yozish', value: skills?.writing ?? 0, color: '#FF7A1A' },
  ];
  const months = Array.from({ length: Math.ceil(course.total / MONTH) }, (_, m) => m);

  return (
    <DesktopPage title="Natijalar" back={R.profile} titleSlot={<PageTitle title="Natijalar" sub={courseName} />} contentStyle={s.content}>
      <View style={{ flexDirection: 'row', gap: 20 }}>
        <View accessibilityLabel="Kurs natijasi" style={s.hero}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 26 }}>
            <View style={{ width: 132, height: 132 }}>
              <Svg width={132} height={132} viewBox="0 0 132 132" accessibilityElementsHidden>
                <Circle cx={66} cy={66} r={RING_R} fill="none" stroke="#263048" strokeWidth={14} />
                {pct > 0 && (
                  <Circle
                    cx={66}
                    cy={66}
                    r={RING_R}
                    fill="none"
                    stroke="#3DDC97"
                    strokeWidth={14}
                    strokeLinecap="round"
                    strokeDasharray={`${(RING_C * pct) / 100} ${RING_C}`}
                    transform="rotate(-90 66 66)"
                  />
                )}
              </Svg>
              <View style={s.ringCenter}>
                <T f="display" size={30} ls={-0.6} color="#FFFFFF">
                  {pct}%
                </T>
              </View>
            </View>
            <View style={{ gap: 6, flex: 1, minWidth: 0 }}>
              <T f="display" size={38} lh={39.9} ls={-0.76} color="#FFFFFF">
                {course.done} / {course.total} dars
              </T>
              {!!end && (
                <T f="bodyBold" size={16} color="#C9D0DE">
                  {left} kun qoldi · {dmy(end)} gacha
                </T>
              )}
              <T f="bodyBold" size={16} color="#C9D0DE">
                Jonli darslar {live.attended} / {live.total} · baho {fmtGrade(avg)}
              </T>
            </View>
          </View>
          <View
            accessibilityLabel={`${course.total} darsdan ${course.done} tasi oʻtildi${course.done < course.total ? `, ${course.done + 1}-dars bugun` : ''}`}
            style={{ flexDirection: 'row', gap: 14 }}
          >
            {months.map((m) => {
              const from = m * MONTH;
              const to = Math.min(course.total, from + MONTH);
              return (
                <View key={m} style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {Array.from({ length: to - from }, (_, k) => {
                      const i = from + k;
                      const c = i < course.done ? '#3DDC97' : i === course.done ? '#2F5BFF' : '#263048';
                      return <View key={k} style={{ flex: 1, height: 12, borderRadius: 3, backgroundColor: c }} />;
                    })}
                  </View>
                  <T f="bodyBold" size={12} color="#B8C1D6">
                    {m + 1}-oy · {from + 1}–{to}-darslar
                  </T>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ width: 300, flexShrink: 0, gap: 14 }}>
          <Stat bg="#FFF1E6" icon={<IFlame size={24} />} value={`${shell.streak} kun`} label="streak" />
          <Stat bg="#F0EBFF" icon={<IBolt size={24} />} value={fmtNum(lightning)} label="chaqmoq" />
          <Stat bg="#FFF4D1" icon={<ICoin size={24} />} value={fmtNum(coins)} label="coin" />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 20 }}>
        <View accessibilityLabel="Oxirgi 7 kun" style={s.week}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <T size={19} accessibilityRole="header">
              Oxirgi 7 kun
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <IBolt size={16} />
              <T size={16} color="#6A3CF0">
                {fmtNum(weekTotal)} chaqmoq
              </T>
            </View>
          </View>
          <View style={s.bars}>
            {week.map((d, i) => (
              <View key={i} style={s.barCol}>
                <T size={14} color="#4A5468">
                  {d.value}
                </T>
                {d.value > 0 && <View style={{ width: 52, height: Math.round((d.value / max) * BAR_MAX), borderRadius: 12, backgroundColor: i === 6 ? '#C9B8FF' : '#7C4DFF' }} />}
                <T size={14} color={i === 6 ? '#0B1220' : '#4A5468'}>
                  {d.label}
                </T>
              </View>
            ))}
          </View>
        </View>

        <View accessibilityLabel="Koʻnikmalar" style={s.skills}>
          <T size={19} accessibilityRole="header">
            Koʻnikmalar
          </T>
          <View style={{ flex: 1, justifyContent: 'center', gap: 20 }}>
            {skillRows.map((r) => (
              <View key={r.label} style={{ gap: 9 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T size={16}>{r.label}</T>
                  <T size={16} color="#4A5468">
                    {r.value}%
                  </T>
                </View>
                <View style={s.track}>
                  <View style={{ width: `${r.value}%`, height: 12, borderRadius: 6, backgroundColor: r.color }} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {!!prep && (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Imtihonga tayyorgarlik: ${prep.index + 1}-oraliq, ${prep.from}–${prep.to}-darslar, ${prep.words} ta soʻz, ${prep.percent}% tayyor`}
          onPress={() => go(R.exams)}
          style={({ pressed }) => [s.prep, pressed && { opacity: 0.9 }]}
        >
          <View style={s.prepIcon}>
            <IClipboard />
          </View>
          <View style={{ width: 320, gap: 2 }}>
            <T size={17}>Imtihonga tayyorgarlik</T>
            <T f="bodyBold" size={14} color="#4A5468">
              {prep.index + 1}-oraliq ({prep.from}–{prep.to}) · {prep.words} ta soʻz
            </T>
          </View>
          <View style={s.prepTrack}>
            <View style={{ width: `${prep.percent}%`, height: 12, borderRadius: 6, backgroundColor: '#7C4DFF' }} />
          </View>
          <View style={{ width: 120, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 6 }}>
            <T size={24} color="#5B2FD6">
              {prep.percent}%
            </T>
            <T size={14} color="#5B2FD6">
              tayyor
            </T>
          </View>
          <IChevron size={20} color="#5B2FD6" sw={2.4} />
        </Pressable>
      )}
    </DesktopPage>
  );
}

function Stat({ bg, icon, value, label }: { bg: string; icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={s.stat}>
      <View style={[s.statIcon, { backgroundColor: bg }]}>{icon}</View>
      <View>
        <T size={24} lh={27.6}>
          {value}
        </T>
        <T f="bodyBold" size={14} color="#4A5468">
          {label}
        </T>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: 32, gap: 20 },
  hero: { flex: 1, minWidth: 0, backgroundColor: '#0B1220', borderRadius: 28, paddingTop: 32, paddingHorizontal: 30, paddingBottom: 28, gap: 28 },
  ringCenter: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  stat: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  statIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  week: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 24, paddingTop: 22, paddingHorizontal: 26, paddingBottom: 20, gap: 14 },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 8, minHeight: 250, borderBottomWidth: 1, borderBottomColor: '#EEF1F7', paddingBottom: 12 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  skills: { width: 400, flexShrink: 0, backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 22, paddingHorizontal: 26, gap: 20 },
  track: { height: 12, borderRadius: 6, backgroundColor: '#EEF1F7', overflow: 'hidden' },
  prep: { backgroundColor: '#F0EBFF', borderRadius: 24, paddingVertical: 20, paddingRight: 24, paddingLeft: 20, flexDirection: 'row', alignItems: 'center', gap: 18 },
  prepIcon: { width: 56, height: 56, borderRadius: 17, backgroundColor: '#7C4DFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  prepTrack: { flex: 1, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF', overflow: 'hidden' },
});
