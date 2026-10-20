/**
 * Kompyuter: Ustozlarim (dizayn: D_Teacher).
 *
 * Ma'lumot mobil ekran (app/v2/ustozlar.tsx) bilan bir xil: ustozlar —
 * fetchDemoStudentProfile (CRM biriktirgan), videodarslar ustozi —
 * TEACHER_PROFILES 'video-teacher', jonli darslar/baho — fetchDemoGrades +
 * jadval, kunlar/vaqt/guruh havolasi — fetchDemoSchedule, tarif —
 * fetchDemoStudentPayments, videodarslar soni — fetchMobileContent.
 * "Jonli darslar · bu hafta" — joriy haftaning (Du–Sh) jonli dars kunlari,
 * Jadval ekranidagi qoida bilan (courseDay + ustoz baholari sanasi).
 */
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  addMinutes,
  courseDay,
  DAY_SHORT,
  fmtGrade,
  gradeAverage,
  groupFromTopic,
  initialsOf,
  liveAttendance,
  nextLiveDay,
  parseIso,
  patternLabel,
  startOfDay,
  supportUrl,
  tgByPhone,
  type CourseDay,
} from '@/components/v2/profile/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { TEACHER_PROFILES } from '@/data/teacherProfiles';
import { useLang } from '@/i18n/LanguageContext';
import {
  fetchDemoGrades,
  fetchDemoSchedule,
  fetchDemoStudentPayments,
  fetchDemoStudentProfile,
  fetchMobileContent,
  type DemoProfileResponse,
  type DemoScheduleResponse,
  type LiveGradeEntry,
} from '@/services/contentApi';

import { ArrowRightIcon, ClockIcon, go, H, PPage, T, TgIcon, VideoIcon, XCircleIcon } from './ui';

const VIDEO_TEACHER = TEACHER_PROFILES.find((t) => t.id === 'video-teacher')!;
const open = (url: string) => Linking.openURL(url).catch(() => {});

/** Jo'nalish kelishigi: Asilbek → Asilbekka, Ulug'beq → -qa, boshqalar → -ga. */
const dative = (name: string) => {
  const last = name.slice(-1).toLowerCase();
  return name + (last === 'k' ? 'ka' : last === 'q' ? 'qa' : 'ga');
};
const DAY_NAMES = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

/** Joriy hafta (Du–Sh) dagi jonli dars kunlari. */
function weekLiveDays(schedule: DemoScheduleResponse | null, grades: LiveGradeEntry[]): CourseDay[] {
  const start = parseIso(schedule?.courseStartDate);
  if (!schedule || !start) return [];
  const today = startOfDay(new Date());
  const mon = new Date(today);
  mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const dates = new Set(grades.map((g) => g.date));
  const out: CourseDay[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const day = courseDay(d, start, schedule.schedulePattern, dates, today);
    if (day.kind === 'live' && day.lesson !== null) out.push(day);
  }
  return out;
}

const CheckCircle = ({ color = '#087A4A' }: { color?: string }) => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={9} />
    <Path d="M8 12.5l2.8 2.8L16.5 9.5" />
  </Svg>
);

export function DTeacher() {
  const { courseLang } = useLang();
  const support = supportUrl(courseLang);
  const [profile, setProfile] = useState<DemoProfileResponse | null>(null);
  const [schedule, setSchedule] = useState<DemoScheduleResponse | null>(null);
  const [grades, setGrades] = useState<LiveGradeEntry[]>([]);
  const [tariff, setTariff] = useState('');
  const [duration, setDuration] = useState(0);
  const [videoCount, setVideoCount] = useState(0);

  useEffect(() => {
    fetchDemoStudentProfile().then(setProfile).catch(() => {});
    fetchDemoSchedule().then(setSchedule).catch(() => {});
    fetchDemoGrades().then((g) => setGrades(g.grades)).catch(() => {});
    fetchDemoStudentPayments()
      .then((p) => {
        if (!p) return;
        setTariff(p.tariffLabel);
        setDuration(p.lessonDuration);
      })
      .catch(() => {});
    // Videodarslar — kursdagi har ikkinchi dars (mobil ekrandagidek).
    fetchMobileContent()
      .then((mc) => {
        const c = mc.courses[0];
        const n = c ? mc.lessons.filter((l) => l.courseId === c.id).length : 0;
        setVideoCount(Math.ceil(n / 2));
      })
      .catch(() => {});
  }, []);

  const group = groupFromTopic(schedule?.topic);
  const live = liveAttendance(schedule, grades);
  const avg = gradeAverage(grades);
  const time = schedule?.lessonTime ?? '';
  const next = nextLiveDay(schedule);
  const isToday = !!next?.isToday;
  const mainName = profile?.mainTeacherName ?? '';
  const asstName = profile?.assistantTeacherName ?? '';
  const mainFirst = mainName.trim().split(/\s+/)[0] ?? '';
  const practiceAt = time ? addMinutes(time, (duration || 30) + 5) : '';
  const week = weekLiveDays(schedule, grades);
  const subtitle = [group ? `${group} guruhi` : '', tariff ? `${tariff} tarif` : ''].filter(Boolean).join(' · ');

  return (
    <PPage title="Ustozlarim" subtitle={subtitle} back={R.profile}>
      <View style={{ flex: 1, gap: 20 }}>
        {/* Asosiy ustoz */}
        <View style={s.main}>
          <View style={s.mainAvatar}>
            <T size={38} color="#FFFFFF">
              {initialsOf(mainName)}
            </T>
            <View accessibilityRole="image" accessibilityLabel="Onlayn" style={s.online} />
          </View>
          <View style={{ width: 270, gap: 7 }}>
            <Tag label="Asosiy ustoz" bg="#E8EEFF" fg="#1E3FD1" />
            <H size={32} lines={1}>
              {mainName}
            </H>
            <T f="bodyBold" size={15} color="#4A5468">
              {`Jonli darslar${schedule ? ` · ${patternLabel(schedule.schedulePattern)}` : ''}${time ? ` ${time}` : ''}`}
            </T>
          </View>
          <View style={{ flex: 1, flexDirection: 'row', gap: 12 }}>
            <MainStat num={`${live.attended} / ${live.total}`} label="jonli dars" />
            <MainStat num={fmtGrade(avg)} label="oʻrtacha baho" />
            <MainStat num={time || '—'} label={isToday ? 'bugungi dars' : 'keyingi dars'} />
          </View>
          <View style={{ width: 200, gap: 12 }}>
            <Pressable accessibilityRole="link" onPress={() => open(tgByPhone(profile?.mainTeacherPhone ?? '', support))} style={[s.btn, s.btnBlue]}>
              <TgIcon size={18} color="#FFFFFF" />
              <T size={15} color="#FFFFFF" lines={1}>
                {mainFirst ? `${dative(mainFirst)} savol` : 'Ustozga savol'}
              </T>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => open(schedule?.telegramGroupLink || support)} style={[s.btn, { backgroundColor: '#2AABEE' }]}>
              <TgIcon size={18} />
              <T size={15} lines={1}>
                {group ? `${group} guruhi` : 'Guruh'}
              </T>
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 20 }}>
          {/* Yordamchi ustoz */}
          <View style={s.small}>
            <View style={s.smallHead}>
              <View style={[s.avatar64, { backgroundColor: '#7C4DFF' }]}>
                <T size={22} color="#FFFFFF">
                  {initialsOf(asstName)}
                </T>
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <Tag label="Yordamchi ustoz" bg="#F0EBFF" fg="#5B2FD6" />
                <T size={19}>{asstName}</T>
                <T f="body" size={14} color="#4A5468" lh={19.6}>
                  Har jonli darsdan keyin 5–15 daqiqa amaliyot
                </T>
              </View>
              <TgCircle label={`${asstName}ga Telegramda yozish`} url={tgByPhone(profile?.assistantTeacherPhone ?? '', support)} />
            </View>
            {!!next && !!practiceAt && (
              <View style={[s.strip, { backgroundColor: '#F0EBFF' }]}>
                <ClockIcon size={17} color="#5B2FD6" />
                <T size={14} color="#5B2FD6">
                  {`${isToday ? 'Bugun' : DAY_NAMES[next.date.getDay()]} ~${practiceAt}${next.lesson ? ` · ${next.lesson}-dars amaliyoti` : ''}`}
                </T>
              </View>
            )}
          </View>
          {/* Videodarslar ustozi */}
          <View style={s.small}>
            <View style={s.smallHead}>
              <View style={[s.avatar64, { backgroundColor: '#F5B70A' }]}>
                <T size={22}>{initialsOf(VIDEO_TEACHER.name)}</T>
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <Tag label="Video darslar ustozi" bg="#FFF4D1" fg="#7A5300" />
                <T size={19}>{VIDEO_TEACHER.name}</T>
                <T f="body" size={14} color="#4A5468" lh={19.6}>{`${videoCount} ta grammatika videodarsi`}</T>
              </View>
              <TgCircle label={`${VIDEO_TEACHER.name}ga Telegramda savol berish`} url={support} />
            </View>
            <Pressable accessibilityRole="link" onPress={() => go(R.grammarList)} style={[s.strip, { backgroundColor: '#FFF4D1' }]}>
              <VideoIcon size={17} color="#7A5300" sw={2.2} />
              <T size={14} color="#7A5300" style={{ flex: 1 }}>
                Grammatika videodarslari
              </T>
              <ArrowRightIcon color="#7A5300" />
            </Pressable>
          </View>
        </View>

        <View style={{ flex: 1, flexDirection: 'row', gap: 20 }}>
          <View style={s.week}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <T size={18} lh={22.5} accessibilityRole="header">
                Jonli darslar · bu hafta
              </T>
              <Pressable accessibilityRole="link" onPress={() => go(R.schedule)} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <T size={14} color="#2F5BFF">
                  Dars jadvali
                </T>
                <ArrowRightIcon color="#2F5BFF" />
              </Pressable>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', gap: 12 }}>
              {week.map((d) => (
                <DayCard key={d.date.toISOString()} d={d} time={time} duration={duration} />
              ))}
            </View>
          </View>
          <View style={s.info}>
            <Image source={designImages.f639c30e1400761df83230b833ba42b2} style={{ width: 132, height: 132 }} resizeMode="contain" />
            <View style={{ gap: 4 }}>
              <H size={24} lh={1.15}>
                Savollar — Telegram orqali
              </H>
              <T f="body" size={14} color="#34405A" lh={21}>
                Ustozlar odatda 1–2 soat ichida javob beradi.
              </T>
            </View>
          </View>
        </View>
      </View>
    </PPage>
  );
}

function DayCard({ d, time, duration }: { d: CourseDay; time: string; duration: number }) {
  const today = d.isToday;
  const label = `${DAY_SHORT[d.date.getDay()]} ${d.date.getDate()}`;
  // Holat: o'tgan (qatnashdi / qatnashmadi), bugun, keyingi — Jadval ekranidagi qoida.
  const status = today
    ? { text: `Bugun${time ? ` · ${time}` : ''}`, color: '#1E3FD1' }
    : d.isPast
      ? d.attended
        ? { text: 'Qatnashdingiz', color: '#087A4A' }
        : { text: 'Qatnashmadingiz', color: '#B42318' }
      : { text: time, color: '#4A5468' };
  return (
    <Pressable accessibilityRole="link" onPress={() => go(R.schedule)} style={[s.day, today && s.dayToday]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T size={13} color={today ? '#1E3FD1' : '#4A5468'}>
          {label}
        </T>
        {today ? (
          <ClockIcon size={17} color="#1E3FD1" />
        ) : d.isPast ? (
          d.attended ? (
            <CheckCircle />
          ) : (
            <XCircleIcon size={17} />
          )
        ) : (
          <ClockIcon size={17} color="#4A5468" />
        )}
      </View>
      <View style={[s.dayIcon, { backgroundColor: today ? '#2F5BFF' : '#FFFFFF' }]}>
        <VideoIcon size={26} color={today ? '#FFFFFF' : '#B42318'} />
      </View>
      <View style={{ gap: 2 }}>
        <H size={24} ls={-0.01} lh={1.36}>{`${d.lesson}-dars`}</H>
        <T f="bodyBold" size={13} color="#34405A">{`Jonli dars${duration ? ` · ${duration} daq` : ''}`}</T>
      </View>
      <T size={14} color={status.color}>
        {status.text}
      </T>
    </Pressable>
  );
}

function MainStat({ num, label }: { num: string; label: string }) {
  return (
    <View style={s.mainStat}>
      <H size={26} ls={-0.01}>
        {num}
      </H>
      <T f="bodyBold" size={13} color="#4A5468" lines={1}>
        {label}
      </T>
    </View>
  );
}

function Tag({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[s.tag, { backgroundColor: bg }]}>
      <T size={12} color={fg} ls={0.72} style={{ textTransform: 'uppercase' }}>
        {label}
      </T>
    </View>
  );
}

function TgCircle({ label, url }: { label: string; url: string }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => open(url)} style={s.tgCircle}>
      <TgIcon size={20} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  main: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 28, flexDirection: 'row', alignItems: 'center', gap: 28 },
  mainAvatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  // Dizaynda 22px + 3px chegara (content-box) — jami 28px.
  online: { position: 'absolute', right: 4, bottom: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: '#12B76A', borderWidth: 3, borderColor: '#FFFFFF' },
  tag: { alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: 9, justifyContent: 'center' },
  mainStat: { flex: 1, minWidth: 0, backgroundColor: '#F4F6FA', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 14, gap: 2 },
  btn: { height: 52, paddingHorizontal: 22, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  btnBlue: { backgroundColor: '#2F5BFF', boxShadow: '0 5px 0 #1E3FD1' },
  small: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, gap: 14 },
  smallHead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar64: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tgCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2AABEE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  strip: { height: 44, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  week: { flex: 589, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, gap: 14 },
  day: { flex: 1, minWidth: 0, borderRadius: 18, backgroundColor: '#F4F6FA', padding: 16, justifyContent: 'space-between', gap: 10 },
  dayToday: { borderWidth: 2, borderColor: '#2F5BFF', backgroundColor: '#F3F6FF' },
  dayIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 407, minWidth: 0, backgroundColor: '#E8EEFF', borderRadius: 28, padding: 24, alignItems: 'flex-start', justifyContent: 'center', gap: 14 },
});
