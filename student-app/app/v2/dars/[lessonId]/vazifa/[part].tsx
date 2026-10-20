/**
 * v2 Uyga vazifa qismi (dizayn: 14 Exercise · 82 TypeAnswer · 15 Test ·
 * 17 Reading · 18 Match · 19 Build). TypeAnswer — B qism (fillBlank)
 * ichidagi har 5-savol (ChoiceParts → TypeAnswer.tsx).
 *
 * Har bir haqiqiy mashq turi o'z dizayniga mos ko'rinishda chiqadi:
 * fillBlank → Exercise, multipleChoice → Test, matching → Match,
 * sentenceBuild → Build, reading → Reading. Speaking kunlarining
 * record/pronunciation/roleplay/creative turlari uchun alohida artboard
 * yo'q — Exercise uslubida (SpeakingParts). Tekshirish, coin, chaqmoq va
 * markHomeworkPartDone mantig'i eski homework/[part].tsx'dan olingan.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { v2Back } from '@/services/v2Nav';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BuildView } from '@/components/v2/homework/BuildView';
import { FillBlankView, MultipleChoiceView } from '@/components/v2/homework/ChoiceParts';
import { isTeacherGraded, loadLessonInfo, partLabel, partLetter, partQuestionCount, type LessonInfo } from '@/components/v2/homework/lib';
import { MatchView } from '@/components/v2/homework/MatchView';
import { EmptyPartView } from '@/components/v2/homework/PartStates';
import { ReadingAuto } from '@/components/v2/homework/ReadingAuto';
import { useHomeworkScores } from '@/components/v2/homework/scoreStore';
import { CreativeView, RecordView, RoleplayView } from '@/components/v2/homework/SpeakingParts';
import { Txt } from '@/components/v2/homework/ui';
import { R } from '@/constants/v2/routes';
import { markHomeworkPartDone, useLessonProgress } from '@/services/lessonProgressStore';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';
import { DHomeworkPart } from '@/components/v2/desktop/homework/DPart';

export default function HomeworkPartScreen() {
  return useIsDesktop() ? <DHomeworkPart fallback={<HomeworkPartScreenMobile />} /> : <HomeworkPartScreenMobile />;
}

function HomeworkPartScreenMobile() {
  const insets = useSafeAreaInsets();
  const { lessonId, part: partId } = useLocalSearchParams<{ lessonId: string; part: string }>();
  const id = String(lessonId);
  const [info, setInfo] = useState<LessonInfo | null>(null);
  const [error, setError] = useState(false);
  const progress = useLessonProgress(id);
  // Natijalar yuklanganda sarlavha/izoh yangilanishi uchun obuna.
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

  const close = () => v2Back(R.homework(id));
  const parts = info?.content.homeworkParts ?? [];
  const part = parts.find((p) => p.id === partId);
  const done = () => markHomeworkPartDone(id, String(partId));

  // Ochiq (oq fonli) dizaynlar: Reading/Match/Build; qolganlari kulrang fonda.
  const white = part && (part.kind === 'reading' || part.kind === 'matching' || part.kind === 'sentenceBuild');

  let content: React.ReactNode;
  if (!info) {
    content = (
      <View style={st.center}>
        {error ? (
          <Txt f="bodyBold" size={15} color="#4A5468">
            Vazifani yuklab boʻlmadi
          </Txt>
        ) : (
          <ActivityIndicator color="#2F5BFF" accessibilityLabel="Yuklanmoqda" />
        )}
      </View>
    );
  } else if (!part) {
    content = <EmptyPartView onClose={close} text="Bu vazifa topilmadi." />;
  } else {
    // Oldingi dars vazifasi ochilgan bo'lsa — "31-dars vazifasi · takrorlash".
    const sc = scores[id]?.[part.id];
    const isReview = !!progress.homeworkParts[part.id] || !!sc?.finished;
    const letter = partLetter(part);
    const overline = `${info.number}-dars vazifasi${isReview ? ' · takrorlash' : ''}${letter ? ` · ${letter} qism` : ''}`;
    const common = { lessonId: id, allParts: parts, onClose: close };
    // Takrorlash rejimidagi "46 / 50 · 46 coin" — butun dars vazifasi (avtomatik qismlar) bo'yicha.
    const lessonScores = scores[id] ?? {};
    const auto = parts.filter((p) => !isTeacherGraded(p));
    const lessonTotal = auto.reduce((a, p) => a + partQuestionCount(p), 0);
    const lessonCorrect = auto.reduce((a, p) => a + Math.min(partQuestionCount(p), lessonScores[p.id]?.correct ?? 0), 0);
    const lessonCoins = auto.reduce((a, p) => a + (lessonScores[p.id]?.coins ?? 0), 0);
    const replayScore = `${lessonCorrect} / ${lessonTotal} · ${lessonCoins} coin`;
    switch (part.kind) {
      case 'fillBlank':
        content = part.blanks.length ? <FillBlankView {...common} part={part} blanks={part.blanks} label={partLabel(part)} vocabulary={info.content.vocabulary} phrases={info.content.speakingPractice} /> : <EmptyPartView onClose={close} />;
        break;
      case 'multipleChoice':
        content = part.questions.length ? <MultipleChoiceView {...common} part={part} questions={part.questions} label={partLabel(part)} /> : <EmptyPartView onClose={close} />;
        break;
      case 'matching':
        content = part.pairs.length ? <MatchView {...common} part={part} pairs={part.pairs} overline={overline} replayScore={replayScore} /> : <EmptyPartView onClose={close} />;
        break;
      case 'sentenceBuild':
        content = part.items.length ? <BuildView {...common} part={part} items={part.items} overline={overline} replayScore={replayScore} /> : <EmptyPartView onClose={close} />;
        break;
      case 'reading':
        content =
          part.paragraph.russianText.trim() || part.sentences.length ? (
            <ReadingAuto
              lessonId={id}
              partId={part.id}
              title={part.title}
              overline={`${info.number}-dars vazifasi${isReview ? ' · takrorlash' : ''}`}
              paragraph={part.paragraph}
              sentences={part.sentences}
              allParts={parts}
              onClose={close}
            />
          ) : (
            <EmptyPartView onClose={close} />
          );
        break;
      case 'record':
      case 'pronunciation':
        content = part.prompts.length ? (
          <RecordView lessonId={id} label={partLabel(part)} prompts={part.prompts} scored={part.kind === 'pronunciation'} onDone={done} onClose={close} />
        ) : (
          <EmptyPartView onClose={close} />
        );
        break;
      case 'roleplay':
        content = <RoleplayView lessonId={id} label={partLabel(part)} scenario={part.scenario} onDone={done} onClose={close} />;
        break;
      case 'creative':
        content = (
          <CreativeView
            lessonId={id}
            label={part.title}
            instruction={part.instruction}
            mediaType={part.mediaType}
            category={info.content.dayType === 'speaking' ? 'speaking' : 'video'}
            onDone={done}
            onClose={close}
          />
        );
        break;
    }
  }

  return (
    <View style={[st.screen, { backgroundColor: white ? '#FFFFFF' : '#F4F6FA' }]}>
      <View style={[st.column, { paddingTop: Math.max(insets.top, 44) + 10 }]}>{content}</View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
