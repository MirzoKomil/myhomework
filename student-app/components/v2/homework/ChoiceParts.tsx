/**
 * B · Bo'sh joy (dizayn: Exercise) va C · Test (dizayn: Test).
 * Tekshirish mantig'i eski FillBlankPart / MultipleChoicePart bilan bir xil:
 * variant tanlanadi → darhol to'g'ri/noto'g'ri ko'rsatiladi → "Davom etish".
 */
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

import { designImages } from '@/constants/v2/designImages';
import type { GrammarBlank, HomeworkPart, MultipleChoiceQ } from '@/data/lessonContent';

import { RetryView } from './PartStates';
import { FeedbackSheet, LabelHeader, OptionRow, Txt } from './ui';
import { usePartRun } from './usePartRun';

type Common = { lessonId: string; allParts: HomeworkPart[]; label: string; onClose: () => void };

/** "Мне, пожалуйста, ___" — bo'sh joy javob berilgach yashil belgi bilan to'ldiriladi. */
function BlankSentence({ sentence, fill }: { sentence: string; fill: string | null }) {
  const pieces = sentence.split(/_{2,}/);
  return (
    <Txt f="bodyHeavy" size={22} lh={29.7} lang="ru" style={{ textAlign: 'center' }}>
      {pieces.map((piece, i) => (
        <Txt key={i} f="bodyHeavy" size={22} lh={29.7}>
          {piece}
          {i < pieces.length - 1 &&
            (fill ? (
              <Txt f="bodyHeavy" size={22} color="#075E3A" style={st.blankFilled}>
                {fill}
              </Txt>
            ) : (
              <Txt f="bodyHeavy" size={22} color="#4A5468" style={st.blankEmpty}>
                {'      '}
              </Txt>
            ))}
        </Txt>
      ))}
    </Txt>
  );
}

export function FillBlankView({ blanks, part, ...c }: Common & { blanks: GrammarBlank[]; part: HomeworkPart }) {
  const run = usePartRun(c.lessonId, part, blanks.length, c.allParts);
  const [selected, setSelected] = useState<string | null>(null);
  if (!run.ready) return null;
  if (run.tooLow !== null) return <RetryView percent={run.tooLow} onRetry={() => { setSelected(null); run.retry(); }} />;
  const q = blanks[run.index];
  const answered = selected !== null;
  const isCorrect = selected === q.answer;

  const pick = (opt: string) => {
    if (answered) return;
    setSelected(opt);
    run.answer(opt === q.answer, q.sentence);
  };

  return (
    <View style={{ flex: 1 }}>
      <LabelHeader label={c.label} current={run.index + (answered ? 1 : 0)} total={blanks.length} color="#2F5BFF" onClose={c.onClose} />
      <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
        <Txt f="bodyBold" size={15} color="#4A5468">
          Gapni toʻldiring
        </Txt>
        <View style={st.card}>
          <View style={st.illustration}>
            <Image source={designImages['81a355f68578bf95c65fc6772f9124c9']} resizeMode="contain" style={{ width: 96, height: 96 }} accessibilityElementsHidden />
          </View>
          <BlankSentence sentence={q.sentence} fill={answered ? q.answer : null} />
        </View>
        <View style={{ gap: 10 }}>
          {q.options.map((opt) => (
            <OptionRow
              key={opt}
              label={opt}
              disabled={answered}
              onPress={() => pick(opt)}
              state={!answered ? 'idle' : opt === q.answer ? 'correct' : opt === selected ? 'wrong' : 'idle'}
            />
          ))}
        </View>
      </ScrollView>
      {answered && (
        <FeedbackSheet
          correct={isCorrect}
          coin={isCorrect && !run.replay}
          detail={isCorrect ? q.sentence.replace(/_{2,}/, q.answer) : `Toʻgʻri javob: «${q.answer}»`}
          buttonLabel={isCorrect ? 'Davom etish' : 'Tushunarli'}
          onPress={() => {
            setSelected(null);
            run.next();
          }}
        />
      )}
    </View>
  );
}

export function MultipleChoiceView({ questions, part, ...c }: Common & { questions: MultipleChoiceQ[]; part: HomeworkPart }) {
  const run = usePartRun(c.lessonId, part, questions.length, c.allParts);
  const [selected, setSelected] = useState<number | null>(null);
  if (!run.ready) return null;
  if (run.tooLow !== null) return <RetryView percent={run.tooLow} onRetry={() => { setSelected(null); run.retry(); }} />;
  const q = questions[run.index];
  const answered = selected !== null;
  const isCorrect = selected === q.correctIndex;

  const pick = (i: number) => {
    if (answered) return;
    setSelected(i);
    run.answer(i === q.correctIndex, q.question);
  };

  return (
    <View style={{ flex: 1 }}>
      <LabelHeader label={c.label} current={run.index + 1} total={questions.length} color="#7C4DFF" onClose={c.onClose} />
      <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
        <Txt f="bodyBold" size={15} color="#4A5468">
          Toʻgʻri javobni tanlang
        </Txt>
        <View style={[st.card, st.cardRow]}>
          <Image source={designImages['c04932e65803a7f5c40ff5868fd21516']} resizeMode="contain" style={{ width: 92, height: 86, flexShrink: 0 }} accessibilityElementsHidden />
          <View style={{ flex: 1, gap: 4 }}>
            <Txt f="bodyHeavy" size={13} color="#4A5468" style={{ textTransform: 'uppercase', letterSpacing: 0.65 }}>
              Savol {run.index + 1}
            </Txt>
            <Txt f="display" size={24} lh={27.6} lang="ru">
              {q.question}
            </Txt>
          </View>
        </View>
        <View style={{ gap: 10 }}>
          {q.options.map((opt, i) => (
            <OptionRow
              key={`${i}-${opt}`}
              label={opt}
              disabled={answered}
              onPress={() => pick(i)}
              state={!answered ? 'idle' : i === q.correctIndex ? 'correct' : i === selected ? 'wrong' : 'idle'}
            />
          ))}
        </View>
      </ScrollView>
      {answered && (
        <FeedbackSheet
          correct={isCorrect}
          coin={isCorrect && !run.replay}
          detail={
            isCorrect ? (
              `«${q.options[q.correctIndex]}»`
            ) : (
              <Txt f="body" size={14} color="#7A1C14" lh={20.3}>
                Toʻgʻri javob:{' '}
                <Txt f="bodyHeavy" size={14} color="#7A1C14" lang="ru">
                  «{q.options[q.correctIndex]}»
                </Txt>
              </Txt>
            )
          }
          buttonLabel={isCorrect ? 'Davom etish' : 'Tushunarli'}
          onPress={() => {
            setSelected(null);
            run.next();
          }}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  body: { paddingTop: 18, paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 18, paddingHorizontal: 16, alignItems: 'center', gap: 12 },
  cardRow: { flexDirection: 'row', padding: 16 },
  illustration: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#FFF1E6', alignItems: 'center', justifyContent: 'center' },
  blankFilled: { backgroundColor: '#E3F7EE', borderRadius: 9, paddingHorizontal: 8, borderBottomWidth: 3, borderBottomColor: '#087A4A' },
  blankEmpty: { backgroundColor: '#EEF1F7', borderRadius: 9, paddingHorizontal: 8, borderBottomWidth: 3, borderBottomColor: '#D5DBE7' },
});
