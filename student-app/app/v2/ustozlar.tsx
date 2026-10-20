/**
 * v2 Ustozlarim (dizayn: Teacher.dc.html).
 *
 * Asosiy/yordamchi ustoz — CRM'da biriktirilgan haqiqiy ustoz
 * (fetchDemoStudentProfile, eski profile/teacher.tsx bilan bir xil).
 * Videodarslar ustozi — eski TEACHER_PROFILES dagi 'video-teacher'.
 * Jonli darslar soni va o'rtacha baho — fetchDemoGrades + jadval
 * (TeacherRatingModal ham shu baholardan ishlaydi). Dars kunlari va
 * vaqti — fetchDemoSchedule. Yozish tugmalari Telegramda ustoz raqami
 * bo'yicha ochiladi; guruh — Telegram guruh havolasi.
 */
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClockIcon, TelegramIcon, TelegramIcon2 } from '@/components/v2/profile/icons';
import {
  addMinutes,
  Column,
  fmtGrade,
  gradeAverage,
  groupFromTopic,
  Header,
  initialsOf,
  liveAttendance,
  nextLiveDay,
  patternLabel,
  supportUrl,
  tgByPhone,
} from '@/components/v2/profile/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
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
import { DTeacher } from '@/components/v2/desktop/profile/DTeacher';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';

const VIDEO_TEACHER = TEACHER_PROFILES.find((t) => t.id === 'video-teacher')!;

const open = (url: string) => Linking.openURL(url).catch(() => {});

/** Jo'nalish kelishigi: Asilbek → Asilbekka, Ulug'beq → -qa, boshqalar → -ga. */
const dative = (name: string) => {
  const last = name.slice(-1).toLowerCase();
  return name + (last === 'k' ? 'ka' : last === 'q' ? 'qa' : 'ga');
};

function Tag({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[st.tag, { backgroundColor: bg }]}>
      <Text style={[st.tagText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function TgCircle({ label, url }: { label: string; url: string }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => open(url)} style={({ pressed }) => [st.tgCircle, pressed && st.pressed]}>
      <TelegramIcon size={19} color="#0B1220" />
    </Pressable>
  );
}

export default function V2Teachers() {
  return useIsDesktop() ? <DTeacher /> : <V2TeachersMobile />;
}

function V2TeachersMobile() {
  const { courseLang } = useLang();
  const insets = useSafeAreaInsets();
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
    // Videodarslar — kursdagi har ikkinchi dars (0, 2, 4 ... indekslar).
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

  const subtitle = [group ? `${group} guruhi` : '', tariff ? `${tariff} tarif` : ''].filter(Boolean).join(' · ');

  return (
    <View style={st.screen}>
      <Header title="Ustozlarim" subtitle={subtitle} subtitleWeight="bold" fallback={R.profile} variant="teacher" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
        <Column style={st.col}>
          {/* Asosiy ustoz */}
          <View style={[st.card, { gap: 14 }]}>
            <View style={st.head}>
              <View style={st.mainAvatarWrap}>
                <View style={[st.avatar, st.avatar64, { backgroundColor: '#2F5BFF' }]}>
                  <Text style={[st.initials, { fontSize: 22, color: '#FFFFFF' }]}>{initialsOf(mainName)}</Text>
                </View>
                <View accessibilityRole="image" accessibilityLabel="Onlayn" style={st.online} />
              </View>
              <View style={st.info}>
                <Tag label="Asosiy ustoz" bg="#E8EEFF" fg="#1E3FD1" />
                <Text style={[st.name, { fontSize: 18 }]}>{mainName}</Text>
                <Text style={st.meta}>{`Jonli darslar${schedule ? ` · ${patternLabel(schedule.schedulePattern)}` : ''}${time ? ` ${time}` : ''}`}</Text>
              </View>
            </View>
            <View style={st.stats}>
              <View style={st.stat}>
                <Text style={st.statNum}>{`${live.attended} / ${live.total}`}</Text>
                <Text style={st.statLabel}>jonli dars</Text>
              </View>
              <View style={st.stat}>
                <Text style={st.statNum}>{fmtGrade(avg)}</Text>
                <Text style={st.statLabel}>oʻrtacha baho</Text>
              </View>
              <View style={st.stat}>
                <Text style={st.statNum}>{time || '—'}</Text>
                <Text style={st.statLabel}>{isToday ? 'bugungi dars' : 'keyingi dars'}</Text>
              </View>
            </View>
          </View>

          {/* Yordamchi ustoz */}
          <View style={[st.card, { gap: 12 }]}>
            <View style={st.head}>
              <View style={[st.avatar, st.avatar56, { backgroundColor: '#6A3CF0' }]}>
                <Text style={[st.initials, { fontSize: 20, color: '#FFFFFF' }]}>{initialsOf(asstName)}</Text>
              </View>
              <View style={st.info}>
                <Tag label="Yordamchi ustoz" bg="#F0EBFF" fg="#5A2FD6" />
                <Text style={st.name}>{asstName}</Text>
                <Text style={[st.meta, { lineHeight: 17.55 }]}>Har jonli darsdan keyin 5–15 daqiqa amaliyot</Text>
              </View>
              <TgCircle label={`${asstName}ga Telegramda yozish`} url={tgByPhone(profile?.assistantTeacherPhone ?? '', support)} />
            </View>
            {!!next && !!practiceAt && (
              <View style={st.practice}>
                <ClockIcon />
                <Text style={st.practiceText}>
                  {`${isToday ? 'Bugun' : patternDay(next.date)} ~${practiceAt}${next.lesson ? ` · ${next.lesson}-dars amaliyoti` : ''}`}
                </Text>
              </View>
            )}
          </View>

          {/* Videodarslar ustozi */}
          <View style={[st.card, st.head]}>
            <View style={[st.avatar, st.avatar56, { backgroundColor: '#FFC93C' }]}>
              <Text style={[st.initials, { fontSize: 20, color: '#0B1220' }]}>{initialsOf(VIDEO_TEACHER.name)}</Text>
            </View>
            <View style={st.info}>
              <Tag label="Video darslar ustozi" bg="#FFF4D1" fg="#7A5300" />
              <Text style={st.name}>{VIDEO_TEACHER.name}</Text>
              <Text style={st.meta}>{`${videoCount} ta grammatika videodarsi`}</Text>
            </View>
            <TgCircle label={`${VIDEO_TEACHER.name}ga Telegramda savol berish`} url={support} />
          </View>

          <View style={st.info2}>
            <Image source={designImages.f639c30e1400761df83230b833ba42b2} style={st.infoImg} resizeMode="contain" />
            <View style={st.infoCol}>
              <Text style={st.infoTitle}>Savollar — Telegram orqali</Text>
              <Text style={st.infoText}>Ustozlar odatda 1–2 soat ichida javob beradi.</Text>
            </View>
          </View>
        </Column>
      </ScrollView>

      {/* Pastki panel: asosiy ustozga savol va guruh (dizayndagi footer) */}
      <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 20) + 14 }]}>
        <Column style={st.btns}>
          <Pressable
            accessibilityRole="link"
            onPress={() => open(tgByPhone(profile?.mainTeacherPhone ?? '', support))}
            style={({ pressed }) => [st.btn, { backgroundColor: '#2F5BFF' }, pressed && st.pressed]}
          >
            <TelegramIcon2 size={18} color="#FFFFFF" />
            <Text style={[st.btnText, { color: '#FFFFFF' }]} numberOfLines={1}>
              {mainFirst ? `${dative(mainFirst)} savol` : 'Ustozga savol'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => open(schedule?.telegramGroupLink || support)}
            style={({ pressed }) => [st.btn, { backgroundColor: '#2AABEE' }, pressed && st.pressed]}
          >
            <TelegramIcon color="#0B1220" />
            <Text style={[st.btnText, { color: '#0B1220' }]} numberOfLines={1}>{group ? `${group} guruhi` : 'Guruh'}</Text>
          </Pressable>
        </Column>
      </View>
    </View>
  );
}

const DAY_NAMES = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const patternDay = (d: Date) => DAY_NAMES[d.getDay()];

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
  col: { gap: 14 },
  pressed: { opacity: 0.85 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  mainAvatarWrap: { width: 64, height: 64, flexShrink: 0 },
  avatar: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatar64: { width: 64, height: 64, borderRadius: 32 },
  avatar56: { width: 56, height: 56, borderRadius: 28 },
  initials: { fontFamily: fonts.display, fontWeight: 'normal' },
  online: { position: 'absolute', right: 1, bottom: 1, width: 15, height: 15, borderRadius: 8, backgroundColor: '#12B76A', borderWidth: 3, borderColor: '#FFFFFF' },
  info: { flex: 1, minWidth: 0, gap: 2 },
  tag: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 },
  tagText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 11, lineHeight: 15, letterSpacing: 0.55, textTransform: 'uppercase' },
  name: { marginTop: 2, fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 17, lineHeight: 23, color: '#0B1220' },
  meta: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, minWidth: 0, backgroundColor: '#F4F6FA', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 4, gap: 1, alignItems: 'center' },
  statNum: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 18, lineHeight: 24, color: '#0B1220' },
  statLabel: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468' },
  btns: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, height: 48, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15 },
  tgCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2AABEE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  practice: { backgroundColor: '#F0EBFF', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  practiceText: { flex: 1, fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#3B2A73' },
  info2: { backgroundColor: '#E8EEFF', borderRadius: 24, paddingVertical: 12, paddingRight: 16, paddingLeft: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoImg: { width: 84, height: 78, flexShrink: 0 },
  infoCol: { flex: 1, minWidth: 0, gap: 4 },
  infoTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, lineHeight: 20, color: '#0B1220' },
  infoText: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18.2, color: '#34405A' },
  footer: {
    flexShrink: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 14, paddingHorizontal: 20,
    boxShadow: '0 -6px 20px rgba(11,18,32,0.06)',
  },
});
