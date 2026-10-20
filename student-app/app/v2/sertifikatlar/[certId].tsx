/**
 * v2 Sertifikat ko'rinishi (dizayn: CertificateView.dc.html, "28 · Sertifikat").
 *
 * Sertifikat faqat imtihondan o'tilgan bo'lsa ko'rsatiladi (examStore —
 * natija %, sana; savollar soni — getResolvedExams). Ism, ID, asosiy
 * ustoz — fetchDemoStudentProfile; guruh — jonli dars mavzusi
 * (fetchDemoSchedule); kurs nomi — fetchMobileContent; keyingi
 * sertifikatgacha qolgan darslar — getCourseOverallProgress.
 * Sertifikat raqami/tekshirish kodi serverda yo'q — guruh, sertifikat
 * tartibi va darslar chegarasidan hosil qilinadi (DW-R14-0224 shakli).
 * "PDF yuklab olish" — eski ekrandagi kabi: webda chop etish (PDF),
 * telefonda ulashish.
 */
import * as Clipboard from 'expo-clipboard';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { BackIcon2, DownloadIcon, NextIcon } from '@/components/v2/profile/icons';
import { certificateStates, Column, dmy, go, goBack, groupFromTopic } from '@/components/v2/profile/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getResolvedExams } from '@/data/exams';
import { getCourseOverallProgress } from '@/data/lessonContent';
import { fetchDemoSchedule, fetchDemoStudentProfile, fetchMobileContent, type DemoProfileResponse } from '@/services/contentApi';
import { loadExamResults, useExamResults } from '@/services/examStore';
import { DCertificateView } from '@/components/v2/desktop/course/DCertificateView';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';

const hidden = { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };
const pad2 = (n: number) => String(n).padStart(2, '0');

// Dizayndagi 21×21 QR naqshi (uchta burchak belgisi + modullar).
const QR_CELLS =
  '0,8;0,9;0,11;1,8;1,9;1,11;1,12;2,8;2,9;2,10;2,12;3,8;3,12;4,9;4,11;4,12;5,8;5,9;5,11;6,9;6,11;6,12;7,8;7,10;7,11;8,0;8,1;8,4;8,9;8,11;8,12;8,14;8,15;8,16;9,0;9,4;9,7;9,9;9,14;9,15;9,17;9,18;9,19;9,20;10,0;10,2;10,3;10,4;10,6;10,7;10,12;10,13;10,14;10,17;10,18;10,19;10,20;11,0;11,2;11,3;11,4;11,5;11,12;11,17;11,18;11,19;12,0;12,1;12,2;12,3;12,4;12,5;12,6;12,7;12,8;12,9;12,10;12,13;12,14;12,15;12,16;12,17;12,20;13,8;13,9;13,10;13,11;13,12;13,14;13,15;13,18;13,20;14,12;14,13;14,14;14,18;14,19;15,13;15,15;15,16;15,17;15,18;15,19;16,9;16,13;16,14;16,15;16,16;16,17;17,8;17,11;17,16;17,17;17,19;18,9;18,10;18,13;18,14;18,15;18,18;19,9;19,11;19,12;19,17;19,20;20,8;20,9;20,10;20,12;20,13;20,14;20,16;20,17;20,20';
const QR_PATH = QR_CELLS.split(';')
  .map((c) => {
    const [x, y] = c.split(',');
    return `M${x} ${y}h1v1h-1z`;
  })
  .join('');

function QrCode() {
  return (
    <Svg width={64} height={64} viewBox="-1 -1 23 23" accessibilityRole="image" accessibilityLabel="QR kod: sertifikatni tekshirish">
      <Path d="M0 0h7v7h-7z M1 1v5h5v-5z M2 2h3v3h-3z" fill="#0B1220" fillRule="evenodd" />
      <Path d="M14 0h7v7h-7z M15 1v5h5v-5z M16 2h3v3h-3z" fill="#0B1220" fillRule="evenodd" />
      <Path d="M0 14h7v7h-7z M1 15v5h5v-5z M2 16h3v3h-3z" fill="#0B1220" fillRule="evenodd" />
      <Path d={QR_PATH} fill="#0B1220" />
    </Svg>
  );
}

function ShieldIcon18() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" {...hidden}>
      <Path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" fill="none" stroke="#1E3FD1" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 12l2 2 4-4" fill="none" stroke="#1E3FD1" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function QrOutlineIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" {...hidden}>
      <Path
        d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"
        fill="none" stroke="#1E3FD1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

function CopyIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" {...hidden}>
      <Rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="#1E3FD1" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 15V5a1 1 0 0 1 1-1h10" fill="none" stroke="#1E3FD1" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ShareNodesIcon() {
  const p = { fill: 'none', stroke: '#0B1220', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" {...hidden}>
      <Circle cx="18" cy="5" r="3" {...p} />
      <Circle cx="6" cy="12" r="3" {...p} />
      <Circle cx="18" cy="19" r="3" {...p} />
      <Path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" {...p} />
    </Svg>
  );
}

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

// Kompyuterda (keng web oyna) — CertificateView kompyuter dizayni; telefonda mobil ekran o'zgarmagan.
export default function V2CertificateView() {
  return useIsDesktop() ? <DCertificateView /> : <V2CertificateViewMobile />;
}

function V2CertificateViewMobile() {
  const insets = useSafeAreaInsets();
  const { certId } = useLocalSearchParams<{ certId: string }>();
  const examResults = useExamResults();
  const [ready, setReady] = useState(false);
  const [lessonsDone, setLessonsDone] = useState(0);
  const [questions, setQuestions] = useState<Record<string, number>>({});
  const [profile, setProfile] = useState<DemoProfileResponse | null>(null);
  const [group, setGroup] = useState('');
  const [courseName, setCourseName] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadExamResults().then(() => setReady(true)).catch(() => setReady(true));
    getResolvedExams()
      .then((list) => setQuestions(Object.fromEntries(list.map((e) => [e.exam.id, e.exam.questions.length]))))
      .catch(() => {});
    fetchDemoStudentProfile().then(setProfile).catch(() => {});
    fetchDemoSchedule().then((s) => setGroup(groupFromTopic(s?.topic))).catch(() => {});
    fetchMobileContent().then((mc) => setCourseName(mc.courses[0]?.name ?? '')).catch(() => {});
  }, []);
  useFocusEffect(
    useCallback(() => {
      getCourseOverallProgress().then((p) => setLessonsDone(p.done)).catch(() => {});
    }, []),
  );

  // Imtihondan o'tilganmi — sertifikat shu natijaga asoslanadi (imtihon darslardan keyin ochiladi).
  const certs = certificateStates(examResults, Number.MAX_SAFE_INTEGER);
  const c = certs.find((x) => x.cert.id === certId);
  const res = c ? examResults[c.examId] : undefined;
  if (ready && (!c || !res?.passed)) return <Redirect href={R.certificates} />;
  if (!c || !res) return <View style={st.screen} />;

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
  const nextFinal = next?.cert.type === 'course';
  const nextTitle = next
    ? nextFinal
      ? `Yakuniy imtihon · 1–${next.cert.requiredLessons}`
      : `${next.index + 1}-oraliq imtihon · ${rangeNums(next.cert.rangeLabel)}`
    : '';
  const nextLeft = next ? Math.max(0, next.cert.requiredLessons - lessonsDone) : 0;

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
  // Eski sertifikat ekranidagi kabi: webda chop etish (PDF sifatida saqlash), telefonda ulashish.
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

  return (
    <View style={st.screen}>
      <View style={[st.header, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
        <Column style={st.headerRow}>
          <Pressable accessibilityRole="link" accessibilityLabel="Sertifikatlarga qaytish" onPress={() => goBack(R.certificates)} style={st.back}>
            <BackIcon2 />
          </Pressable>
          <View style={st.headText}>
            <Text accessibilityRole="header" style={st.h1} numberOfLines={1}>{title}</Text>
            <Text style={st.hSub} numberOfLines={1}>{`${range} · ${res.scorePercent}%`}</Text>
          </View>
        </Column>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
        <Column style={st.col}>
          <View accessibilityLabel="Sertifikat" style={st.cert}>
            <View style={st.certInner}>
              <View style={[st.blob, { left: -60, top: -60, backgroundColor: '#E8EEFF' }]} />
              <View style={[st.blob, { right: -50, bottom: -70, backgroundColor: '#FFF4D1' }]} />
              <View style={st.brand}>
                <View style={st.brandMark}><Text style={st.brandMarkText}>D</Text></View>
                <Text style={st.brandName}>Domwork</Text>
              </View>
              <Text style={st.kicker}>Sertifikat</Text>
              <Text style={st.owner}>Ushbu sertifikat egasi</Text>
              <Text style={st.name}>{profile?.name ?? ''}</Text>
              <Text style={st.desc}>
                {`${courseName ? `«${courseName}» ` : ''}kursining `}
                {/* Dizayndagi white-space: nowrap — bo'linmas bo'shliq va chiziqcha bilan */}
                <Text style={st.descBold}>{examWord.replace(/ /g, '\u00A0')}</Text>
                {` (${range.replace(/–/g, '–\u2060')}) muvaffaqiyatli topshirdi`}
              </Text>
              <View style={st.chips}>
                <View style={[st.chip, { backgroundColor: '#E3F7EE' }]}>
                  <Text style={[st.chipText, { fontFamily: fonts.bodyHeavy, color: '#075E3A' }]}>{`Natija ${res.scorePercent}%`}</Text>
                </View>
                <View style={[st.chip, { backgroundColor: '#F4F6FA' }]}>
                  <Text style={[st.chipText, { fontFamily: fonts.bodyBold, color: '#4A5468' }]}>{`${correct} / ${total} savol`}</Text>
                </View>
              </View>
              <View style={st.certFoot}>
                <View style={st.meta}>
                  <Text style={st.metaText}>Sana: <Text style={st.metaBold}>{date}</Text></Text>
                  <Text style={st.metaText}>
                    {group ? <>Guruh: <Text style={st.metaBold}>{group}</Text> · </> : null}
                    {`ID ${studentId}`}
                  </Text>
                  <Text style={st.metaText}>№ <Text style={st.metaBold}>{code}</Text></Text>
                  {!!teacher && <Text style={st.sign}>{signature(teacher)}</Text>}
                  <Text style={st.metaText}>Asosiy ustoz</Text>
                </View>
                <View style={st.qr}>
                  <QrCode />
                  <Text style={st.qrText}>Tekshirish</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={st.info}>
            <ShieldIcon18 />
            <Text style={st.infoText}>QR kod myhomework.uz saytida sertifikat haqiqiyligini koʻrsatadi</Text>
          </View>

          <View style={st.codeRow}>
            <QrOutlineIcon />
            <View style={st.codeCol}>
              <Text style={st.codeLabel}>Tekshirish kodi · QR</Text>
              <Text style={st.code}>{code}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Tekshirish kodini nusxalash" onPress={copy} style={({ pressed }) => [st.copy, pressed && st.pressed]}>
              <CopyIcon />
              <Text style={st.copyText}>{copied ? 'Nusxalandi' : 'Nusxalash'}</Text>
            </Pressable>
          </View>

          {!!next && (
            <Pressable accessibilityRole="link" onPress={() => go(R.exams)} style={({ pressed }) => [st.next, pressed && st.pressed]}>
              <View style={st.nextImgWrap}>
                <Image source={designImages.d9b3ac63886f3fdd8214701a31f0956a} style={st.nextImg} resizeMode="contain" />
              </View>
              <View style={st.nextCol}>
                <Text style={st.nextKicker}>Keyingi sertifikat</Text>
                <Text style={st.nextTitle} numberOfLines={1}>{nextTitle}</Text>
                <Text style={st.nextSub} numberOfLines={1}>{`${next.cert.requiredLessons}-darsdan keyin · ${nextLeft} dars qoldi`}</Text>
              </View>
              <NextIcon color="#5B6478" />
            </Pressable>
          )}
        </Column>
      </ScrollView>

      <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 20) + 14 }]}>
        <Column style={st.btns}>
          <Pressable accessibilityRole="button" accessibilityLabel="Sertifikatni ulashish" onPress={share} style={({ pressed }) => [st.shareBtn, pressed && st.pressed]}>
            <ShareNodesIcon />
            <Text style={[st.btnText, { color: '#0B1220' }]}>Ulashish</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="PDF yuklab olish" onPress={downloadPdf} style={({ pressed }) => [st.pdfBtn, pressed && st.pressed]}>
            <DownloadIcon size={18} strokeWidth={2.4} />
            <Text style={[st.btnText, { color: '#FFFFFF' }]}>PDF yuklab olish</Text>
          </Pressable>
        </Column>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  pressed: { opacity: 0.85 },
  header: { paddingHorizontal: 20, flexShrink: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headText: { flex: 1, minWidth: 0, gap: 1 },
  h1: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 24, lineHeight: 26.4, letterSpacing: -0.48, color: '#0B1220' },
  hSub: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  content: { paddingTop: 16, paddingHorizontal: 20 },
  col: { gap: 12 },
  cert: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 8, boxShadow: '0 12px 30px rgba(11,18,32,0.08)' },
  certInner: {
    borderWidth: 2, borderColor: '#F5B70A', borderRadius: 16, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 16,
    alignItems: 'center', gap: 8, overflow: 'hidden', backgroundColor: '#FFFDF6',
  },
  blob: { position: 'absolute', width: 150, height: 150, borderRadius: 75 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 18, lineHeight: 22, color: '#FFFFFF' },
  brandName: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 20, lineHeight: 26, letterSpacing: -0.4, color: '#0B1220' },
  kicker: { marginTop: 4, fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16, letterSpacing: 2.64, textTransform: 'uppercase', color: '#7A5300' },
  owner: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  name: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 28, lineHeight: 29.4, letterSpacing: -0.56, color: '#0B1220', textAlign: 'center' },
  desc: { maxWidth: 280, fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18.85, color: '#4A5468', textAlign: 'center' },
  descBold: { fontFamily: fonts.bodyHeavy, color: '#0B1220' },
  chips: { flexDirection: 'row', gap: 8, marginTop: 2 },
  chip: { borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  chipText: { fontWeight: 'normal', fontSize: 14, lineHeight: 19 },
  certFoot: {
    width: '100%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 8, paddingTop: 12,
    borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: '#E2D3A0',
  },
  meta: { flexShrink: 1, gap: 2 },
  metaText: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 16.2, color: '#4A5468' },
  metaBold: { fontFamily: fonts.bodyHeavy, color: '#0B1220' },
  sign: { marginTop: 2, fontFamily: fonts.display700, fontWeight: 'normal', fontStyle: 'italic', fontSize: 16, lineHeight: 21.6, color: '#1E3FD1' },
  qr: { alignItems: 'center', gap: 3, flexShrink: 0 },
  qrText: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468' },
  info: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#E8EEFF', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  infoText: { flex: 1, minWidth: 0, fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 17.55, color: '#1E3FD1' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 8, paddingRight: 8, paddingLeft: 14 },
  codeCol: { flex: 1, minWidth: 0, gap: 1 },
  codeLabel: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468' },
  code: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, lineHeight: 22, letterSpacing: 0.32, fontVariant: ['tabular-nums'], color: '#0B1220' },
  copy: { height: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#E8EEFF', flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  copyText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, color: '#1E3FD1' },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 10, paddingRight: 12, paddingLeft: 10 },
  nextImgWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#FFF4D1', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nextImg: { width: 48, height: 48 },
  nextCol: { flex: 1, minWidth: 0, gap: 1 },
  nextKicker: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase', color: '#4A5468' },
  nextTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, lineHeight: 20, color: '#0B1220' },
  nextSub: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  bottom: { paddingTop: 12, paddingHorizontal: 20, flexShrink: 0 },
  btns: { flexDirection: 'row', gap: 10 },
  shareBtn: { flex: 1, height: 56, borderRadius: 18, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pdfBtn: {
    flex: 1.4, height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 6px 0 #1E3FD1',
  },
  btnText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16 },
});
