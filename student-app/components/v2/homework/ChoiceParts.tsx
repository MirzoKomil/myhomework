/**
 * B · Bo'sh joy (dizayn: Exercise + 82 TypeAnswer) va C · Test (dizayn: Test).
 * Tekshirish mantig'i eski FillBlankPart / MultipleChoicePart bilan bir xil:
 * variant tanlanadi → darhol to'g'ri/noto'g'ri ko'rsatiladi → "Davom etish".
 * Yangi dizayndagidek B qismning har 5-savoli (5/10, 10/10) variantsiz —
 * javob kirill klaviaturasida yoziladi (TypeAnswer).
 */
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import type { GrammarBlank, HomeworkPart, MultipleChoiceQ, SpeakingPrompt, VocabWord } from '@/data/lessonContent';
import { getLessonProgress } from '@/services/lessonProgressStore';

import { BulbSimple, ChevronRight, ClockIcon } from './icons';
import { isTeacherGraded, partLetter } from './lib';
import { RetryView } from './PartStates';
import { getLessonScores, getPartScore } from './scoreStore';
import { isTypedQuestion, normalizeRu, TypeAnswerView } from './TypeAnswer';
import { FeedbackSheet, LabelHeader, OptionRow, ResultsCard, Txt } from './ui';
import { usePartRun, type PartRun } from './usePartRun';

const hasCyrillic = (s: string) => /[Ѐ-ӿ]/.test(s);

type Common = { lessonId: string; allParts: HomeworkPart[]; label: string; onClose: () => void };

/**
 * Har savol chizig'ining holati: javob berilgan bo'lsa to'g'ri/noto'g'ri.
 * Eski yozuvlarda (results yo'q) — xatolar ro'yxatidan tiklanadi.
 */
function segStates(run: PartRun, total: number, answeredNow: number, lessonId: string, partId: string, textOf: (i: number) => string) {
  const saved = getPartScore(lessonId, partId);
  return Array.from({ length: total }, (_, i) => {
    if (i >= answeredNow) return undefined;
    if (run.results[i] !== undefined) return run.results[i];
    return !(saved?.mistakes ?? []).includes(textOf(i));
  });
}

/**
 * Savolga oid haqiqiy ma'lumot: javob so'zining rasmi (dars lug'atidagi
 * imageUrl) va to'liq gapning tarjimasi (darsdagi speakingPractice'da aynan
 * shu gap bo'lsa). Topilmasa — bo'sh (o'rnini bosuvchi rasm/matn yo'q).
 */
export function blankExtras(q: GrammarBlank, vocabulary: VocabWord[], phrases: SpeakingPrompt[]) {
  const ans = normalizeRu(q.answer);
  const imageUrl = vocabulary.find((w) => w.imageUrl && normalizeRu(w.english) === ans)?.imageUrl;
  const full = normalizeRu(q.sentence.replace(/_{2,}/, q.answer));
  const translation = phrases.find((p) => normalizeRu(p.sentence) === full)?.translation;
  return { imageUrl, translation };
}

/** "4 / 4 toʻgʻri · +4 coin" — coin faqat haqiqiy (takrorlash emas) urinishda. */
function scoreLine(states: (boolean | undefined)[], replay: boolean) {
  const answered = states.filter((x) => x !== undefined).length;
  const correct = states.filter((x) => x === true).length;
  const allRight = answered > 0 && correct === answered;
  return {
    text: `${correct} / ${answered} toʻgʻri${!replay && correct > 0 ? ` · +${correct} coin` : ''}`,
    color: allRight ? '#075E3A' : '#4A5468',
  };
}

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
                {'      '}
              </Txt>
            ))}
        </Txt>
      ))}
    </Txt>
  );
}

export function FillBlankView({ blanks, part, vocabulary, phrases, ...c }: Common & { blanks: GrammarBlank[]; part: HomeworkPart; vocabulary: VocabWord[]; phrases: SpeakingPrompt[] }) {
  const run = usePartRun(c.lessonId, part, blanks.length, c.allParts);
  const [selected, setSelected] = useState<string | null>(null);
  if (!run.ready) return null;
  if (run.tooLow !== null) return <RetryView percent={run.tooLow} onRetry={() => { setSelected(null); run.retry(); }} />;
  const q = blanks[run.index];

  // Har 5-savol — yozib javob berish (dizayn: TypeAnswer "B 5/10").
  if (isTypedQuestion(run.index)) {
    return (
      <TypeAnswerView
        key={q.id}
        blank={q}
        label={c.label}
        index={run.index}
        total={blanks.length}
        replay={run.replay}
        translation={blankExtras(q, vocabulary, phrases).translation}
        onAnswer={(ok, typed) => run.answer(ok, q.sentence, true, typed)}
        onNext={() => run.next()}
        onClose={c.onClose}
      />
    );
  }

  const answered = selected !== null;
  const isCorrect = selected === q.answer;
  const others = q.options.filter((o) => o !== q.answer);
  const states = segStates(run, blanks.length, run.index + (answered ? 1 : 0), c.lessonId, part.id, (i) => blanks[i]?.sentence ?? '');
  const line = scoreLine(states, run.replay);
  const letter = partLetter(part) ?? '';
  const extras = blankExtras(q, vocabulary, phrases);

  const pick = (opt: string) => {
    if (answered) return;
    setSelected(opt);
    run.answer(opt === q.answer, q.sentence, true, opt);
  };

  return (
    <View style={{ flex: 1 }}>
      <LabelHeader label={c.label} current={run.index + (answered ? 1 : 0)} total={blanks.length} color="#2F5BFF" onClose={c.onClose} />
      <ScrollView contentContainerStyle={[st.body, { paddingTop: 14, gap: 12 }]} showsVerticalScrollIndicator={false}>
        <Txt f="bodyBold" size={15} color="#4A5468">
          Gapni toʻldiring
        </Txt>
        <View style={[st.card, { paddingVertical: 14, gap: 10 }]}>
          {/* Javob so'zining rasmi dars lug'atida bo'lsa — shu; bo'lmasa bo'sh doira. */}
          <View style={st.illustration}>
            {!!extras.imageUrl && <Image source={{ uri: extras.imageUrl }} resizeMode="contain" style={{ width: 76, height: 76 }} accessibilityElementsHidden />}
          </View>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <BlankSentence sentence={q.sentence} fill={answered ? q.answer : null} />
            {!!extras.translation && (
              <Txt f="body" size={14} color="#4A5468" style={{ textAlign: 'center' }}>
                {extras.translation}
              </Txt>
            )}
          </View>
        </View>
        <View style={{ gap: 10 }}>
          {q.options.map((opt) => (
            <OptionRow
              key={opt}
              label={opt}
              minHeight={52}
              disabled={answered}
              onPress={() => pick(opt)}
              state={!answered ? 'idle' : opt === q.answer ? 'correct' : opt === selected ? 'wrong' : 'idle'}
            />
          ))}
          {answered && (
            // Eslatma: to'g'ri shakl va bu gapda ishlatilmaydigan variantlar (dars ma'lumotidan).
            <View style={st.tip}>
              <BulbSimple />
              <Txt f="bodyBold" size={13} color="#7A5300" lh={18.2} style={{ flex: 1 }}>
                <Txt f="bodyHeavy" size={13} color="#7A5300" lang="ru">
                  {q.answer}
                </Txt>
                {others.length > 0 && (
                  <>
                    {' · '}
                    {others.map((o, i) => (
                      <Txt key={o} f="bodyBold" size={13} color="#7A5300">
                        {i > 0 ? (i === others.length - 1 ? ' va ' : ', ') : ''}
                        <Txt f="bodyBold" size={13} color="#7A5300" lang="ru">
                          {o}
                        </Txt>
                      </Txt>
                    ))}
                    {' bu yerda ishlatilmaydi.'}
                  </>
                )}
              </Txt>
            </View>
          )}
        </View>
        <ResultsCard
          label={`${letter ? `${letter} qism` : part.title} natijalari`}
          title={`${letter || part.title} · natijalar`}
          right={line.text}
          rightColor={line.color}
          states={states}
          radius={18}
          pad={{ v: 10, h: 14 }}
          gap={8}
        />
      </ScrollView>
      {answered && (
        <FeedbackSheet
          correct={isCorrect}
          coin={isCorrect && !run.replay}
          padBottom={28}
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
  const states = segStates(run, questions.length, run.index + (answered ? 1 : 0), c.lessonId, part.id, (i) => questions[i]?.question ?? '');
  const line = scoreLine(states, run.replay);
  const letter = partLetter(part) ?? '';

  const pick = (i: number) => {
    if (answered) return;
    setSelected(i);
    run.answer(i === q.correctIndex, q.question, true, q.options[i]);
  };

  // "Natijani ko'rish" — barcha avtomatik qismlar tugagan bo'lsa "Vazifa tekshirildi" oynasi, aks holda vazifa ro'yxati.
  const openResult = () => {
    const progress = getLessonProgress(c.lessonId);
    const scores = getLessonScores(c.lessonId);
    const allDone = c.allParts.filter((p) => !isTeacherGraded(p)).every((p) => progress.homeworkParts[p.id] || scores[p.id]?.finished);
    router.push((allDone ? `${R.homework(c.lessonId)}?yuborildi=1` : R.homework(c.lessonId)) as Href);
  };

  return (
    <View style={{ flex: 1 }}>
      <LabelHeader label={c.label} current={run.index + 1} total={questions.length} color="#7C4DFF" onClose={c.onClose} />
      <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
        <Txt f="bodyBold" size={15} color="#4A5468">
          {/* Dizayndagi matn — savol o'zbekcha, variantlar ruscha bo'lganda; aks holda umumiy ko'rsatma. */}
          {!hasCyrillic(q.question) && q.options.some(hasCyrillic) ? 'Ruschasini tanlang' : 'Toʻgʻri javobni tanlang'}
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
        <ResultsCard
          label="Vazifa holati"
          title={`${c.label} natijalari`}
          right={line.text}
          rightColor={line.color}
          states={states}
          radius={20}
          pad={{ v: 12, h: 14 }}
          gap={9}
        >
          <Pressable accessibilityRole="link" onPress={openResult} style={({ pressed }) => [st.resultLink, pressed && { opacity: 0.85 }]}>
            <ClockIcon />
            <Txt f="bodyBold" size={12} color="#5B6478" style={{ flex: 1 }}>
              {letter ? `${letter} qism` : 'Qism'} tugagach ({questions.length} / {questions.length}):{' '}
              <Txt f="bodyHeavy" size={12} color="#4A5468" style={st.underline}>
                Natijani koʻrish
              </Txt>
            </Txt>
            <ChevronRight size={14} />
          </Pressable>
        </ResultsCard>
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
  illustration: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#FFF1E6', alignItems: 'center', justifyContent: 'center' },
  blankFilled: { backgroundColor: '#E3F7EE', borderRadius: 9, paddingHorizontal: 6, borderBottomWidth: 3, borderBottomColor: '#087A4A' },
  blankEmpty: { backgroundColor: '#EEF1F7', borderRadius: 9, paddingHorizontal: 6, borderBottomWidth: 3, borderBottomColor: '#D5DBE7' },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#FFF4D1' },
  resultLink: {
    minHeight: 44,
    marginBottom: -8,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E4E8F0',
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  underline: { textDecorationLine: 'underline', ...({ textUnderlineOffset: 2 } as object) },
});
