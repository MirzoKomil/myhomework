/**
 * v2 Sertifikatlar (dizayn: Certificates.dc.html).
 *
 * Eski profile/certificates.tsx qoidasi: sertifikat — darslar o'tilgan VA
 * mos imtihondan o'tilgan bo'lsa ochiladi (examStore natijalari +
 * getCourseOverallProgress). O'tish bali va savollar soni — CRM'da
 * tahrirlangan imtihondan (getResolvedExams). Dizaynda 7 ta: 6 oraliq +
 * 1 yakuniy (bonus sertifikati dizaynda yo'q). Olingan sertifikat
 * tugmasi uni CertificateView'da ochadi (R.certificate).
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DownloadIcon, LockIcon2, QrIcon, RibbonIcon } from '@/components/v2/profile/icons';
import { certificateStates, Column, go, Header } from '@/components/v2/profile/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { EXAM_PASS_PERCENT, getResolvedExams } from '@/data/exams';
import { getCourseOverallProgress } from '@/data/lessonContent';
import { useExamResults } from '@/services/examStore';
import { DCertificates } from '@/components/v2/desktop/course/DCertificates';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';

// Kompyuterda (keng web oyna) — Certificates kompyuter dizayni; telefonda mobil ekran o'zgarmagan.
export default function V2Certificates() {
  return useIsDesktop() ? <DCertificates /> : <V2CertificatesMobile />;
}

function V2CertificatesMobile() {
  const insets = useSafeAreaInsets();
  const examResults = useExamResults();
  const [lessonsDone, setLessonsDone] = useState(0);
  const [passPercent, setPassPercent] = useState(EXAM_PASS_PERCENT);
  const [finalQuestions, setFinalQuestions] = useState(0);

  useFocusEffect(
    useCallback(() => {
      getCourseOverallProgress().then((p) => setLessonsDone(p.done)).catch(() => {});
    }, []),
  );
  useEffect(() => {
    getResolvedExams()
      .then((list) => {
        const interval = list.find((e) => e.exam.id === 'interval-1');
        if (interval) setPassPercent(interval.passPercent);
        const fin = list.find((e) => e.exam.id === 'final');
        if (fin) setFinalQuestions(fin.exam.questions.length);
      })
      .catch(() => {});
  }, []);

  const certs = certificateStates(examResults, lessonsDone);
  const done = certs.filter((c) => c.passed).length;
  const firstLocked = certs.find((c) => !c.passed);

  return (
    <View style={st.screen}>
      <Header title="Sertifikatlar" fallback={R.profile} variant="b" />
      <ScrollView contentContainerStyle={[st.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <Column style={st.col}>
          <View style={st.hero}>
            <Image source={designImages.ed6a96794e0940b7d7a5452cbc4cb422} style={st.mascot} resizeMode="contain" />
            <View style={st.heroText}>
              <Text style={st.heroNum}>{`${done} / ${certs.length}`}</Text>
              <Text style={st.heroSub}>{`${certs.length - 1} oraliq + 1 yakuniy sertifikat. Oʻtish bali — ${passPercent}%.`}</Text>
              <View style={st.track}><View style={[st.fill, { width: `${Math.round((done / Math.max(1, certs.length)) * 100)}%` }]} /></View>
            </View>
          </View>

          {certs.map((c) => {
            const isFinal = c.cert.type === 'course';
            const title = isFinal ? 'Yakuniy imtihon · kurs sertifikati' : `${c.index + 1}-oraliq imtihon`;
            const range = c.cert.rangeLabel;
            if (c.passed) {
              return (
                <View key={c.cert.id} style={st.done}>
                  <View style={st.doneIcon}><RibbonIcon color="#087A4A" /></View>
                  <View style={st.info}>
                    <Text style={st.doneTitle}>{title}</Text>
                    <Text style={st.doneSub}>{`${isFinal ? `${finalQuestions} savol` : range} · natija ${c.score}%`}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={isFinal ? 'Kurs sertifikatini ochish' : `${c.index + 1}-oraliq sertifikatni ochish`}
                    onPress={() => go(R.certificate(c.cert.id))}
                    style={({ pressed }) => [st.dl, pressed && st.pressed]}
                  >
                    <DownloadIcon size={18} color="#2F5BFF" strokeWidth={2.4} />
                  </Pressable>
                </View>
              );
            }
            const lessonsReady = lessonsDone >= c.cert.requiredLessons;
            const when = lessonsReady ? ' · imtihonni topshiring' : c === firstLocked ? ` · ${c.cert.requiredLessons}-darsdan keyin` : '';
            const sub = isFinal ? `${finalQuestions} savol · ${c.cert.requiredLessons}-darsdan keyin` : `${range}${when}`;
            return (
              <Pressable
                key={c.cert.id}
                accessibilityRole={lessonsReady ? 'button' : undefined}
                disabled={!lessonsReady}
                onPress={() => go(R.exams)}
                style={st.locked}
              >
                <View style={st.lockIcon}><LockIcon2 /></View>
                <View style={st.info}>
                  <Text style={st.lockTitle}>{title}</Text>
                  <Text style={st.lockSub}>{sub}</Text>
                </View>
              </Pressable>
            );
          })}

          <View style={st.note}>
            <View style={{ marginTop: 1 }}><QrIcon /></View>
            <Text style={st.noteText}>
              Har bir sertifikat PDF koʻrinishida yuklanadi. Undagi QR kod orqali ish beruvchi yoki oʻqish joyi haqiqiyligini tekshira oladi.
            </Text>
          </View>
        </Column>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { paddingHorizontal: 20, paddingTop: 14 },
  col: { gap: 8 },
  pressed: { opacity: 0.85 },
  hero: { backgroundColor: '#FFF4D1', borderRadius: 24, paddingVertical: 14, paddingRight: 16, paddingLeft: 10, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  mascot: { width: 92, height: 96, flexShrink: 0 },
  heroText: { flex: 1, gap: 5 },
  heroNum: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 28, color: '#0B1220' },
  heroSub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 14, lineHeight: 18.9, color: '#5C4300' },
  track: { height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: '#F5B70A' },
  done: {
    backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 12, paddingRight: 12, paddingLeft: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
    borderLeftWidth: 5, borderLeftColor: '#0FA968',
  },
  doneIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#E3F7EE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, minWidth: 0, gap: 1 },
  doneTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, lineHeight: 20, color: '#0B1220' },
  doneSub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  dl: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  locked: { backgroundColor: '#EEF1F7', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  lockIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  lockTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, lineHeight: 19, color: '#4A5468' },
  note: { marginTop: 6, flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#E8EEFF' },
  noteText: { flex: 1, minWidth: 0, fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 18.2, color: '#1E3FD1' },
  lockSub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468' },
});
