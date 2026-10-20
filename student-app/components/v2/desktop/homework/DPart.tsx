/**
 * Kompyuter: uyga vazifa qismi (dizayn: D_Exercise · D_TypeAnswer · D_Test ·
 * D_Reading · D_Match · D_Build). Tur bo'yicha tarmoqlanish mobil
 * vazifa/[part].tsx bilan aynan bir xil; tekshirish, coin va chaqmoq —
 * o'sha usePartRun / ReadingAuto mantig'i.
 * Gapirish turlari (record/pronunciation/roleplay/creative) uchun kompyuter
 * dizayni yo'q — ular mobil ko'rinishda (markazda) qoladi.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { FocusFrame } from '@/components/v2/desktop/Shell';
import { isTeacherGraded, KIND_SHORT, lessonLabel, loadLessonInfo, partQuestionCount, type LessonInfo } from '@/components/v2/homework/lib';
import { EmptyPartView } from '@/components/v2/homework/PartStates';
import { useHomeworkScores } from '@/components/v2/homework/scoreStore';
import { R } from '@/constants/v2/routes';
import { useLessonProgress } from '@/services/lessonProgressStore';

import { DBuild } from './DBuild';
import { DFillBlank } from './DFillBlank';
import { DMatch } from './DMatch';
import { DReading } from './DReading';
import { DTest } from './DTest';
import { Loading } from './dui';

export function DHomeworkPart({ fallback }: { fallback: ReactNode }) {
  const { lessonId, part: partId } = useLocalSearchParams<{ lessonId: string; part: string }>();
  const id = String(lessonId);
  const [info, setInfo] = useState<LessonInfo | null>(null);
  const [error, setError] = useState(false);
  const progress = useLessonProgress(id);
  const scores = useHomeworkScores();

  useEffect(() => {
    let cancelled = false;
    loadLessonInfo(id)
      .then((r) => !cancelled && setInfo(r))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const closeTo = R.homework(id);
  const parts = info?.content.homeworkParts ?? [];
  const part = parts.find((p) => p.id === partId);

  if (!info || !part) {
    return (
      <FocusFrame closeTo={closeTo} title="Uyga vazifa" subtitle={info ? lessonLabel(info.number, info.name) : undefined}>
        {!info ? (
          <Loading error={error} />
        ) : (
          <View style={{ flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingTop: 24 }}>
            <EmptyPartView onClose={() => undefined} text="Bu vazifa topilmadi." />
          </View>
        )}
      </FocusFrame>
    );
  }

  // Takrorlash rejimi — qism avval topshirilgan (mobil bilan bir xil shart).
  const sc = scores[id]?.[part.id];
  const isReview = !!progress.homeworkParts[part.id] || !!sc?.finished;
  const lessonScores = scores[id] ?? {};
  const auto = parts.filter((p) => !isTeacherGraded(p));
  const lessonTotal = auto.reduce((a, p) => a + partQuestionCount(p), 0);
  const lessonCorrect = auto.reduce((a, p) => a + Math.min(partQuestionCount(p), lessonScores[p.id]?.correct ?? 0), 0);
  const lessonCoins = auto.reduce((a, p) => a + (lessonScores[p.id]?.coins ?? 0), 0);
  const ctx = {
    lessonId: id,
    allParts: parts,
    closeTo,
    number: info.number,
    lessonName: lessonLabel(info.number, info.name),
    review: isReview,
    /** "31-dars vazifasi · takrorlash" */
    overline: `${info.number}-dars vazifasi${isReview ? ' · takrorlash' : ''}`,
    short: KIND_SHORT[part.kind],
    replayScore: `${lessonCorrect} / ${lessonTotal} · ${lessonCoins} coin`,
  };
  const empty = (
    <FocusFrame closeTo={closeTo} title={part.title} subtitle={ctx.lessonName}>
      <View style={{ flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingTop: 24 }}>
        <EmptyPartView onClose={() => undefined} />
      </View>
    </FocusFrame>
  );

  switch (part.kind) {
    case 'fillBlank':
      return part.blanks.length ? <DFillBlank ctx={ctx} part={part} blanks={part.blanks} vocabulary={info.content.vocabulary} phrases={info.content.speakingPractice} /> : empty;
    case 'multipleChoice':
      return part.questions.length ? <DTest ctx={ctx} part={part} questions={part.questions} /> : empty;
    case 'matching':
      return part.pairs.length ? <DMatch ctx={ctx} part={part} pairs={part.pairs} /> : empty;
    case 'sentenceBuild':
      return part.items.length ? <DBuild ctx={ctx} part={part} items={part.items} /> : empty;
    case 'reading':
      return part.paragraph.russianText.trim() || part.sentences.length ? <DReading ctx={ctx} part={part} paragraph={part.paragraph} sentences={part.sentences} /> : empty;
    default:
      // Gapirish turlari — kompyuter dizayni yo'q, mobil ko'rinish.
      return <>{fallback}</>;
  }
}

export type PartCtx = {
  lessonId: string;
  allParts: LessonInfo['content']['homeworkParts'];
  closeTo: string;
  number: number;
  lessonName: string;
  review: boolean;
  overline: string;
  short: string;
  replayScore: string;
};
