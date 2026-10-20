/**
 * Kompyuter: Sertifikat ko'rinishi (dizayn: D_CertificateView.dc.html).
 *
 * Ma'lumot mobil CertificateView bilan bir xil: natija va sana — examStore,
 * savollar soni va o'tish bali — getResolvedExams, ism / ID / asosiy ustoz —
 * fetchDemoStudentProfile, guruh — fetchDemoSchedule (topic), kurs nomi —
 * fetchMobileContent, keyingi sertifikatgacha qolgan darslar —
 * getCourseOverallProgress. Sertifikat raqami serverda yo'q — mobildagi
 * kabi guruh + tartib + darslar chegarasidan hosil qilinadi.
 * "PDF yuklab olish" — webda chop etish (PDF sifatida saqlash).
 */
import * as Clipboard from 'expo-clipboard';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { certificateStates, dmy, groupFromTopic } from '@/components/v2/profile/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { getResolvedExams } from '@/data/exams';
import { getCourseOverallProgress } from '@/data/lessonContent';
import { fetchDemoSchedule, fetchDemoStudentProfile, fetchMobileContent, type DemoProfileResponse } from '@/services/contentApi';
import { loadExamResults, useExamResults } from '@/services/examStore';

import { DesktopPage } from '../Shell';
import { QR_PATH } from './qr';
import { go, IChevron, ICopy, IDownload, IQr, IShare, IShield, Over, PageTitle, T } from './ui';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "Asilbek Asqarov" → "A. Asqarov" (imzo ko'rinishi). */
const signature = (full: string) => {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
};

const formatStudentId = (value?: string) => {
  const id = String(value || '').trim();
  return /^s\d+$/i.test(id) ? id.slice(-6) : id;
};

/** "13–24-darslar" → "13–24". */
const rangeNums = (label: string) => label.replace(/-darslar$/, '');

export function DCertificateView() {
  const { certId } = useLocalSearchParams<{ certId: string }>();
  const examResults = useExamResults();
  const [ready, setReady] = useState(false);
  const [lessonsDone, setLessonsDone] = useState(0);
  const [questions, setQuestions] = useState<Record<string, number>>({});
  const [passPercent, setPassPercent] = useState<Record<string, number>>({});
  const [profile, setProfile] = useState<DemoProfileResponse | null>(null);
  const [group, setGroup] = useState('');
  const [courseName, setCourseName] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadExamResults()
      .then(() => setReady(true))
      .catch(() => setReady(true));
    getResolvedExams()
      .then((list) => {
        setQuestions(Object.fromEntries(list.map((e) => [e.exam.id, e.exam.questions.length])));
        setPassPercent(Object.fromEntries(list.map((e) => [e.exam.id, e.passPercent])));
      })
      .catch(() => {});
    fetchDemoStudentProfile().then(setProfile).catch(() => {});
    fetchDemoSchedule()
      .then((sc) => setGroup(groupFromTopic(sc?.topic)))
      .catch(() => {});
    fetchMobileContent()
      .then((mc) => setCourseName(mc.courses[0]?.name ?? ''))
      .catch(() => {});
  }, []);
  useFocusEffect(
    useCallback(() => {
      getCourseOverallProgress()
        .then((p) => setLessonsDone(p.done))
        .catch(() => {});
    }, []),
  );

  const certs = certificateStates(examResults, Number.MAX_SAFE_INTEGER);
  const c = certs.find((x) => x.cert.id === certId);
  const res = c ? examResults[c.examId] : undefined;
  if (ready && (!c || !res?.passed)) return <Redirect href={R.certificates} />;
  if (!c || !res) return <DesktopPage title="" back={R.certificates} titleSlot={<View />}>{null}</DesktopPage>;

  const isFinal = c.cert.type === 'course';
  const range = isFinal ? `1–${c.cert.requiredLessons}-darslar` : c.cert.rangeLabel;
  const title = isFinal ? 'Kurs sertifikati' : `${c.index + 1}-oraliq sertifikat`;
  const examWord = isFinal ? 'yakuniy imtihonini' : `${c.index + 1}-oraliq imtihonini`;
  const total = questions[c.examId] ?? 0;
  const correct = Math.round((res.scorePercent * total) / 100);
  const date = dmy(new Date(res.attemptedAt));
  const studentId = formatStudentId(profile?.studentId);
  const code = `DW-${(group || studentId).replace(/[^A-Za-z0-9]/g, '').toUpperCase()}-${pad2(c.index + 1)}${pad2(c.cert.requiredLessons)}`;
  const teacher = profile?.mainTeacherName ?? '';

  const nextIdx = certs.findIndex((x) => x.index > c.index && !x.passed);
  const next = nextIdx >= 0 ? certs[nextIdx] : null;
  const nextTitle = next
    ? next.cert.type === 'course'
      ? `Yakuniy imtihon · 1–${next.cert.requiredLessons}`
      : `${next.index + 1}-oraliq imtihon · ${rangeNums(next.cert.rangeLabel)}`
    : '';
  const nextLeft = next ? Math.max(0, next.cert.requiredLessons - lessonsDone) : 0;
  // O'ng ustundagi "Sertifikatlar · 2 / 7" ro'yxati — olingan sertifikatlar.
  const passedList = certificateStates(examResults, lessonsDone);
  const owned = passedList.filter((x) => x.passed);

  const text = `${title}\n${profile?.name ?? ''}\n${range} · Natija ${res.scorePercent}%\n№ ${code}`;
  const share = async () => {
    try {
      if (Platform.OS === 'web') {
        const nav = navigator as Navigator & { share?: (d: { title: string; text: string }) => Promise<void> };
        if (nav.share) await nav.share({ title, text });
        else await navigator.clipboard?.writeText(text);
      } else {
        await Share.share({ message: text });
      }
    } catch {
      // Foydalanuvchi bekor qildi.
    }
  };
  const downloadPdf = () => {
    if (Platform.OS === 'web') window.print();
    else void Share.share({ message: text });
  };
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Nusxalab bo'lmadi.
    }
  };

  const rows: [string, string, string?][] = [
    ['Natija', `${res.scorePercent}%`, '#087A4A'],
    ['Toʻgʻri javoblar', `${correct} / ${total} savol`],
    ['Oʻtish bali', `${passPercent[c.examId] ?? 60}%`],
    ['Sana', date],
    ['Darslar', rangeNums(range)],
  ];

  return (
    <DesktopPage title={title} back={R.certificates} titleSlot={<PageTitle title={title} sub={`${range} · ${res.scorePercent}%`} />} contentStyle={s.content}>
      <View style={s.main}>
        <View accessibilityLabel="Sertifikat" style={s.cert}>
          <View style={s.paper}>
            <View accessibilityElementsHidden style={[s.blob, { left: -90, top: -90, width: 240, height: 240, borderRadius: 120, backgroundColor: '#E8EEFF' }]} />
            <View accessibilityElementsHidden style={[s.blob, { right: -70, bottom: -80, width: 230, height: 230, borderRadius: 115, backgroundColor: '#FFF4D1' }]} />
            <View accessibilityElementsHidden style={s.dashed} />
            <View accessibilityElementsHidden style={s.ring} />

            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={s.mark}>
                  <T f="display" size={24} ls={-0.48} color="#FFFFFF">
                    D
                  </T>
                </View>
                <T f="display" size={28} ls={-0.56}>
                  Domwork
                </T>
              </View>
              <T size={15} ls={4.8} color="#7A5300">
                SERTIFIKAT
              </T>
            </View>

            <View style={{ alignItems: 'center', gap: 6 }}>
              <T f="bodyBold" size={15} color="#4A5468">
                Ushbu sertifikat egasi
              </T>
              <T f="display" size={52} lh={58.24} ls={-1.04} style={{ textAlign: 'center' }}>
                {profile?.name ?? ''}
              </T>
              <T f="body" size={16} color="#4A5468" lh={24.8} style={{ marginTop: 6, textAlign: 'center' }}>
                {courseName ? `«${courseName}» ` : ''}kursining <T size={16}>{examWord}</T> ({range.replace(/-darslar$/, '')}-darslar){'\n'}muvaffaqiyatli topshirdi
              </T>
              <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
                <View style={[s.chip, { backgroundColor: '#E3F7EE' }]}>
                  <T size={16} color="#075E3A">
                    Natija {res.scorePercent}%
                  </T>
                </View>
                <View style={[s.chip, { backgroundColor: '#EEF1F7' }]}>
                  <T size={16} color="#34405A">
                    {correct} / {total} savol
                  </T>
                </View>
              </View>
            </View>

            <View style={s.foot}>
              <View style={{ flex: 1, gap: 5 }}>
                <T f="bodyBold" size={14} color="#4A5468">
                  Sana: <T size={14}>{date}</T>
                </T>
                <T f="bodyBold" size={14} color="#4A5468">
                  {group ? (
                    <>
                      Guruh: <T size={14}>{group}</T> ·{' '}
                    </>
                  ) : null}
                  ID {studentId}
                </T>
                <T f="bodyBold" size={14} color="#4A5468">
                  № <T size={14}>{code}</T>
                </T>
              </View>
              <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <T size={26} color="#1E3FD1" style={{ fontStyle: 'italic' }}>
                  {signature(teacher)}
                </T>
                <View style={{ width: 170, height: 1, backgroundColor: '#C9BC8F' }} />
                <T f="bodyBold" size={14} color="#4A5468">
                  Asosiy ustoz
                </T>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
                <View style={s.qrBox}>
                  <Svg width={96} height={96} viewBox="-1 -1 31 31" accessibilityRole="image" accessibilityLabel="Sertifikatni tekshirish QR kodi">
                    <Rect x={-1} y={-1} width={31} height={31} fill="#FFFFFF" />
                    <Path d={QR_PATH} fill="#0B1220" />
                  </Svg>
                </View>
                <T size={13} color="#4A5468" style={{ width: 106, textAlign: 'center' }}>
                  Tekshirish
                </T>
              </View>
            </View>
          </View>
        </View>

        <View style={s.aside}>
          <View style={s.info}>
            <View style={s.infoIcon}>
              <IShield size={22} color="#1E3FD1" sw={2.2} check />
            </View>
            <T size={15} color="#1E3FD1" lh={21.75} style={{ flex: 1 }}>
              QR kod myhomework.uz saytida sertifikat haqiqiyligini koʻrsatadi
            </T>
          </View>

          <View style={s.result}>
            <Over style={{ marginBottom: 4 }}>Imtihon natijasi</Over>
            {rows.map(([k, v, color], i) => (
              <View key={k} style={[s.resRow, i > 0 && s.resLine]}>
                <T f="bodyBold" size={15} color="#4A5468">
                  {k}
                </T>
                <T size={15} color={color ?? '#0B1220'}>
                  {v}
                </T>
              </View>
            ))}
          </View>

          {!!next && (
            <Pressable accessibilityRole="link" onPress={() => go(R.exams)} style={({ pressed }) => [s.next, pressed && { opacity: 0.9 }]}>
              <Image source={designImages.d9b3ac63886f3fdd8214701a31f0956a} style={{ width: 60, height: 60, borderRadius: 18 }} resizeMode="cover" />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Over>Keyingi sertifikat</Over>
                <T size={16} lines={1}>
                  {nextTitle}
                </T>
                <T f="bodyBold" size={13} color="#4A5468" lines={1}>
                  {next.cert.requiredLessons}-darsdan keyin · {nextLeft} dars qoldi
                </T>
              </View>
              <IChevron size={18} color="#5B6478" sw={2.4} />
            </Pressable>
          )}

          <Pressable accessibilityRole="link" onPress={() => go(R.certificates)} style={({ pressed }) => [s.all, pressed && { opacity: 0.9 }]}>
            <Image source={designImages.ed6a96794e0940b7d7a5452cbc4cb422} style={s.allImg} resizeMode="contain" />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <T size={17}>
                Sertifikatlar · {owned.length} / {passedList.length}
              </T>
              <T f="bodyBold" size={14} color="#7A5300" lh={19.6}>
                {owned.map((x) => `${x.cert.type === 'course' ? 'Yakuniy' : `${x.index + 1}-oraliq`} ${x.score}%`).join('\n')}
              </T>
            </View>
            <IChevron size={18} color="#7A5300" sw={2.4} />
          </Pressable>
        </View>
      </View>

      <View style={s.bar}>
        <IQr size={26} color="#2F5BFF" sw={2} />
        <View style={{ gap: 1 }}>
          <T f="bodyBold" size={13} color="#4A5468">
            Tekshirish kodi · QR
          </T>
          <T size={20} ls={0.8} lines={1}>
            {code}
          </T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Tekshirish kodini nusxalash" onPress={copy} style={({ pressed }) => [s.copy, pressed && { opacity: 0.85 }]}>
          <ICopy />
          <T size={14} color="#1E3FD1">
            {copied ? 'Nusxalandi' : 'Nusxalash'}
          </T>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Sertifikatni ulashish" onPress={share} style={({ pressed }) => [s.shareBtn, pressed && { opacity: 0.85 }]}>
          <IShare />
          <T size={15}>Ulashish</T>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="PDF yuklab olish" onPress={downloadPdf} style={({ pressed }) => [s.pdfBtn, pressed && { opacity: 0.85 }]}>
          <IDownload />
          <T size={15} color="#FFFFFF">
            PDF yuklab olish
          </T>
        </Pressable>
      </View>
    </DesktopPage>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: 32, gap: 16 },
  main: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 24 },
  cert: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, boxShadow: '0 14px 40px rgba(11,18,32,0.08)' } as object,
  paper: {
    flex: 1,
    position: 'relative',
    borderRadius: 18,
    backgroundColor: '#FFFCF2',
    overflow: 'hidden',
    paddingTop: 30,
    paddingHorizontal: 44,
    paddingBottom: 26,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blob: { position: 'absolute' },
  dashed: { position: 'absolute', left: 12, top: 12, right: 12, bottom: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E9D69B' },
  ring: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: 18, borderWidth: 3, borderColor: '#F5B70A' },
  mark: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center' },
  foot: { width: '100%', borderTopWidth: 2, borderStyle: 'dashed', borderTopColor: '#E9D69B', paddingTop: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 24 },
  qrBox: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 5 },
  aside: { width: 340, flexShrink: 0, gap: 14 },
  info: { backgroundColor: '#E8EEFF', borderRadius: 24, padding: 18, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  infoIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  result: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 8 },
  resRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  resLine: { borderTopWidth: 1, borderTopColor: '#EEF1F7' },
  next: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 14, paddingRight: 16, paddingLeft: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  all: { flex: 1, minHeight: 0, backgroundColor: '#FFF4D1', borderRadius: 24, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  allImg: { width: 120, height: 120, flexShrink: 0, marginTop: -10, marginRight: -4, marginBottom: -10, marginLeft: -8 },
  bar: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 14, paddingRight: 16, paddingLeft: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  copy: { height: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#E8EEFF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  shareBtn: { height: 52, paddingHorizontal: 22, borderRadius: 17, backgroundColor: '#FFFFFF', boxShadow: 'inset 0 0 0 1.5px #E2E6EE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 } as object,
  pdfBtn: { height: 52, paddingHorizontal: 22, borderRadius: 17, backgroundColor: '#2F5BFF', boxShadow: '0 5px 0 #1E3FD1', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 } as object,
});
