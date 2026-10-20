/**
 * Kompyuter: Sertifikatlar (dizayn: D_Certificates.dc.html).
 *
 * Ma'lumot mobil Sertifikatlar ekrani bilan bir xil: holatlar —
 * certificateStates (examStore natijalari + getCourseOverallProgress),
 * o'tish bali va yakuniy imtihon savollari — getResolvedExams.
 * Olingan sertifikat — CertificateView (R.certificate), darslari o'tilgan
 * lekin imtihoni topshirilmagani — Imtihonlar ekrani.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { certificateStates } from '@/components/v2/profile/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { EXAM_PASS_PERCENT, getResolvedExams } from '@/data/exams';
import { getCourseOverallProgress } from '@/data/lessonContent';
import { useExamResults } from '@/services/examStore';

import { DesktopPage } from '../Shell';
import { go, ICheck, IChevron, IClock, ILock, IQr, PageTitle, T } from './ui';

type Cert = ReturnType<typeof certificateStates>[number];
const GAP = 18;

export function DCertificates() {
  const examResults = useExamResults();
  const [lessonsDone, setLessonsDone] = useState(0);
  const [passPercent, setPassPercent] = useState(EXAM_PASS_PERCENT);
  const [finalQuestions, setFinalQuestions] = useState(0);
  const [width, setWidth] = useState(0);

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
  const intervals = certs.filter((c) => c.cert.type !== 'course');
  const final = certs.find((c) => c.cert.type === 'course');
  // 4 ustunli to'r: ustun kengligi o'lchab hisoblanadi (yakuniy karta 2 ustun egallaydi).
  const col = width > 0 ? (width - GAP * 3) / 4 : 0;

  return (
    <DesktopPage title="Sertifikatlar" back={R.profile} titleSlot={<PageTitle title="Sertifikatlar" sub="Oraliq va yakuniy imtihonlar" />} contentStyle={s.content}>
      <View style={s.summary}>
        <Image source={designImages.ed6a96794e0940b7d7a5452cbc4cb422} style={{ width: 116, height: 116 }} resizeMode="contain" />
        <View style={{ width: 360, flexShrink: 0, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
            <T f="display" size={44} lh={44} ls={-0.88}>
              {done} / {certs.length}
            </T>
            <T size={15} color="#7A5300">
              sertifikat olindi
            </T>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {certs.map((c) => (
              <View key={c.cert.id} style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: c.passed ? '#F5B70A' : '#EEF1F7' }} />
            ))}
          </View>
          <T f="bodyBold" size={15} color="#4A5468">
            {certs.length - 1} oraliq + 1 yakuniy sertifikat. Oʻtish bali — {passPercent}%.
          </T>
        </View>
        <View style={s.vline} />
        <View style={s.note}>
          <View style={s.noteIcon}>
            <IQr />
          </View>
          <T f="bodyBold" size={14} color="#1E3FD1" lh={20.3} style={{ flex: 1 }}>
            Har bir sertifikat PDF koʻrinishida yuklanadi. Undagi QR kod orqali ish beruvchi yoki oʻqish joyi haqiqiyligini tekshira oladi.
          </T>
        </View>
      </View>

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={s.grid}>
        {col > 0 &&
          intervals.map((c) => (
            <View key={c.cert.id} style={{ width: col }}>
              <CertCard c={c} title={`${c.index + 1}-oraliq imtihon`} lessonsDone={lessonsDone} next={c === firstLocked} />
            </View>
          ))}
        {col > 0 && final && (
          <View style={{ width: col * 2 + GAP }}>
            <FinalCard c={final} questions={finalQuestions} lessonsDone={lessonsDone} next={final === firstLocked} />
          </View>
        )}
      </View>
    </DesktopPage>
  );
}

/** Sertifikat varag'ining kichik ko'rinishi (dizayndagi 150px "SERTIFIKAT"). */
function Thumb({ passed, style }: { passed: boolean; style?: object }) {
  return (
    <View accessibilityElementsHidden style={[s.thumb, { backgroundColor: passed ? '#FFFCF2' : '#F4F6FA' }, style]}>
      <View style={[s.thumbBlob, { backgroundColor: passed ? '#E8EEFF' : '#EEF1F7' }]} />
      <View style={[s.thumbRing, { borderColor: passed ? '#F5B70A' : '#D5DBE7' }]} />
      <T size={12} ls={2.64} color={passed ? '#7A5300' : '#5B6478'}>
        SERTIFIKAT
      </T>
      <View style={{ width: 120, height: 9, borderRadius: 5, backgroundColor: passed ? '#0B1220' : '#D5DBE7' }} />
      <View style={{ width: 90, height: 6, borderRadius: 3, backgroundColor: passed ? '#E9DDB8' : '#E2E6EE' }} />
      <View style={{ width: 70, height: 6, borderRadius: 3, backgroundColor: passed ? '#E9DDB8' : '#E2E6EE' }} />
    </View>
  );
}

/** Holat yorlig'i: Topshirildi / N-darsdan keyin / Yopiq. */
function StatePill({ c, lessonsDone, next }: { c: Cert; lessonsDone: number; next: boolean }) {
  if (c.passed) {
    return (
      <View style={[s.pill, { backgroundColor: '#E3F7EE' }]}>
        <ICheck size={13} color="#087A4A" sw={3} />
        <T size={13} color="#075E3A">
          Topshirildi
        </T>
      </View>
    );
  }
  const ready = lessonsDone >= c.cert.requiredLessons;
  if (next || ready) {
    return (
      <View style={[s.pill, { backgroundColor: '#2F5BFF' }]}>
        <IClock size={14} color="#FFFFFF" sw={2.4} />
        <T size={13} color="#FFFFFF">
          {ready ? 'Imtihonni topshiring' : `${c.cert.requiredLessons}-darsdan keyin`}
        </T>
      </View>
    );
  }
  return (
    <View style={[s.pill, { backgroundColor: '#EEF1F7' }]}>
      <ILock size={13} color="#4A5468" sw={2.4} />
      <T size={13} color="#4A5468">
        Yopiq
      </T>
    </View>
  );
}

function CertCard({ c, title, lessonsDone, next }: { c: Cert; title: string; lessonsDone: number; next: boolean }) {
  const ready = !c.passed && lessonsDone >= c.cert.requiredLessons;
  const onPress = c.passed ? () => go(R.certificate(c.cert.id)) : ready ? () => go(R.exams) : undefined;
  return (
    <Pressable
      accessibilityRole={onPress ? 'link' : undefined}
      accessibilityLabel={c.passed ? `${title} sertifikatni ochish` : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [s.card, next && s.cardNext, pressed && { opacity: 0.9 }]}
    >
      <Thumb passed={c.passed} />
      <View style={{ paddingHorizontal: 8, gap: 3 }}>
        <T size={16}>{title}</T>
        <T f="bodyBold" size={14} color="#4A5468">
          {c.cert.rangeLabel}
          {c.passed ? ` · natija ${c.score}%` : ''}
        </T>
      </View>
      <View style={{ paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <StatePill c={c} lessonsDone={lessonsDone} next={next} />
        {c.passed && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <T size={14} color="#1E3FD1">
              Ochish
            </T>
            <IChevron size={16} color="#1E3FD1" sw={2.4} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

function FinalCard({ c, questions, lessonsDone, next }: { c: Cert; questions: number; lessonsDone: number; next: boolean }) {
  const ready = !c.passed && lessonsDone >= c.cert.requiredLessons;
  const onPress = c.passed ? () => go(R.certificate(c.cert.id)) : ready ? () => go(R.exams) : undefined;
  return (
    <Pressable
      accessibilityRole={onPress ? 'link' : undefined}
      accessibilityLabel={c.passed ? 'Kurs sertifikatini ochish' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [s.final, next && s.cardNext, pressed && { opacity: 0.9 }]}
    >
      <View style={{ width: 260, flexShrink: 0 }}>
        <Thumb passed={c.passed} style={{ height: undefined, flex: 1, minHeight: 150 }} />
      </View>
      <View style={{ flex: 1, justifyContent: 'center', gap: 10, paddingRight: 10 }}>
        <Image source={designImages.ed6a96794e0940b7d7a5452cbc4cb422} style={{ width: 56, height: 56 }} resizeMode="contain" />
        <View style={{ gap: 3 }}>
          <T size={17}>Yakuniy imtihon · kurs sertifikati</T>
          <T f="bodyBold" size={14} color="#4A5468">
            {questions} savol · {c.passed ? `natija ${c.score}%` : `${c.cert.requiredLessons}-darsdan keyin`}
          </T>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <StatePill c={c} lessonsDone={lessonsDone} next={next} />
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: 32, gap: 22 },
  summary: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 26, paddingRight: 28, paddingLeft: 24, flexDirection: 'row', alignItems: 'center', gap: 22 },
  vline: { width: 1, alignSelf: 'stretch', backgroundColor: '#EEF1F7' },
  note: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#E8EEFF', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18 },
  noteIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 24, paddingTop: 10, paddingHorizontal: 10, paddingBottom: 20, gap: 14 },
  // Navbatdagi sertifikat — ichki 2px ko'k chegara (dizayndagi inset box-shadow).
  cardNext: { boxShadow: 'inset 0 0 0 2px #C3D0FF' } as object,
  thumb: { height: 150, borderRadius: 16, position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 7 },
  thumbBlob: { position: 'absolute', left: -26, top: -26, width: 70, height: 70, borderRadius: 35 },
  thumbRing: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: 16, borderWidth: 2 },
  pill: { height: 28, paddingHorizontal: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 5 },
  final: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 24, paddingTop: 10, paddingHorizontal: 10, paddingBottom: 16, flexDirection: 'row', gap: 18, alignItems: 'stretch' },
});
