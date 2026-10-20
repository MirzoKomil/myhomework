/**
 * Kompyuter: "Test" qismi (dizayn: D_Test). Mantiq mobil MultipleChoiceView
 * bilan aynan bir xil: variant tanlanadi → darhol to'g'ri/xato → "Davom
 * etish"/"Tushunarli"; coin/chaqmoq/yakunlash — usePartRun.
 */
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { FocusFrame } from '@/components/v2/desktop/Shell';
import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { isTeacherGraded } from '@/components/v2/homework/lib';
import { RetryView } from '@/components/v2/homework/PartStates';
import { getLessonScores } from '@/components/v2/homework/scoreStore';
import { usePartRun } from '@/components/v2/homework/usePartRun';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import type { HomeworkPart, MultipleChoiceQ } from '@/data/lessonContent';
import { getLessonProgress } from '@/services/lessonProgressStore';

import { questionStates, QuestionProgress } from './DFillBlank';
import type { PartCtx } from './DPart';
import { caps, DOption, FeedbackBar, FocusBody, IChevron, IClock, KeysHint, Loading, Txt, webShadow } from './dui';

const hasCyrillic = (s: string) => /[Ѐ-ӿ]/.test(s);

export function DTest({ ctx, part, questions }: { ctx: PartCtx; part: HomeworkPart; questions: MultipleChoiceQ[] }) {
  const run = usePartRun(ctx.lessonId, part, questions.length, ctx.allParts);
  const [selected, setSelected] = useState<number | null>(null);
  const q = questions[Math.min(run.index, questions.length - 1)];
  const answered = selected !== null;

  const pick = (i: number) => {
    if (answered || !run.ready || run.tooLow !== null) return;
    setSelected(i);
    run.answer(i === q.correctIndex, q.question, true, q.options[i]);
  };
  useDesktopKeys(Object.fromEntries(q.options.map((_, i) => [String(i + 1), () => pick(i)])), !answered);

  const frame = { closeTo: ctx.closeTo, title: part.title, subtitle: `${ctx.number}-dars · Uyga vazifa` };
  if (!run.ready)
    return (
      <FocusFrame {...frame}>
        <Loading />
      </FocusFrame>
    );
  if (run.tooLow !== null)
    return (
      <FocusFrame {...frame}>
        <View style={{ flex: 1, width: 480, maxWidth: '100%', alignSelf: 'center' }}>
          <RetryView
            percent={run.tooLow}
            onRetry={() => {
              setSelected(null);
              run.retry();
            }}
          />
        </View>
      </FocusFrame>
    );

  const isCorrect = selected === q.correctIndex;
  const states = questionStates(run, questions.length, run.index + (answered ? 1 : 0), ctx.lessonId, part.id, (i) => questions[i]?.question ?? '');
  const nAnswered = states.filter((x) => x !== undefined).length;
  const nCorrect = states.filter((x) => x === true).length;

  // "Natijani ko'rish" — mobil bilan bir xil: hammasi tugagan bo'lsa "Vazifa tekshirildi", aks holda ro'yxat.
  const openResult = () => {
    const progress = getLessonProgress(ctx.lessonId);
    const scores = getLessonScores(ctx.lessonId);
    const allDone = ctx.allParts.filter((p) => !isTeacherGraded(p)).every((p) => progress.homeworkParts[p.id] || scores[p.id]?.finished);
    router.push((allDone ? `${R.homework(ctx.lessonId)}?yuborildi=1` : R.homework(ctx.lessonId)) as Href);
  };

  return (
    <FocusFrame {...frame} center={<QuestionProgress index={run.index} states={states} label={`${part.title}: ${questions.length} savoldan ${run.index + 1}-si`} />} scroll={false}>
      <FocusBody
        bottom={
          answered ? (
            <FeedbackBar
              correct={isCorrect}
              coin={isCorrect && !run.replay}
              width={1000}
              detail={
                isCorrect ? (
                  `«${q.options[q.correctIndex]}»`
                ) : (
                  <Txt f="bodyBold" size={16} color="#B42318" lh={22.4}>
                    Toʻgʻri javob:{' '}
                    <Txt f="bodyHeavy" size={16} color="#B42318" lang="ru">
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
          ) : (
            <View style={{ height: 132 }} />
          )
        }
      >
        <View style={{ width: 1000, maxWidth: '100%', gap: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
            <View style={{ gap: 4, flexShrink: 1 }}>
              <Txt f="bodyHeavy" size={12} color="#1E3FD1" style={caps(12)}>
                {part.title}
              </Txt>
              <Txt f="display" size={28} style={{ letterSpacing: -0.56 }} accessibilityRole="header">
                {/* Savol o'zbekcha, variantlar ruscha bo'lganda — "Ruschasini tanlang" (mobil kabi). */}
                {!hasCyrillic(q.question) && q.options.some(hasCyrillic) ? 'Ruschasini tanlang' : 'Toʻgʻri javobni tanlang'}
              </Txt>
            </View>
            <KeysHint keys={q.options.map((_, i) => String(i + 1))} label="tanlash" />
          </View>
          <View style={st.card}>
            <View style={st.illu}>
              <Image source={designImages['c04932e65803a7f5c40ff5868fd21516']} resizeMode="contain" style={{ width: 162, height: 150 }} accessibilityElementsHidden />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
              <Txt f="bodyHeavy" size={12} color="#4A5468" style={caps(12)}>
                Savol {run.index + 1}
              </Txt>
              <Txt f="display" size={50} lh={52.5} lang={hasCyrillic(q.question) ? 'ru' : undefined} style={{ letterSpacing: -1 }}>
                {q.question}
              </Txt>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {q.options.map((opt, i) => (
              <DOption
                key={`${i}-${opt}`}
                test
                n={i + 1}
                label={opt}
                disabled={answered}
                onPress={() => pick(i)}
                state={!answered ? 'idle' : i === q.correctIndex ? 'correct' : i === selected ? 'wrong' : 'idle'}
              />
            ))}
          </View>
          <View accessibilityLabel={`${part.title} natijalari`} style={st.results}>
            <View style={{ width: 420, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Txt f="bodyHeavy" size={14}>
                  {part.title} natijalari
                </Txt>
                <Txt f="bodyHeavy" size={14} color={!nAnswered ? '#4A5468' : nCorrect === nAnswered ? '#075E3A' : '#B42318'}>
                  {nCorrect} / {nAnswered} toʻgʻri
                </Txt>
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {states.map((r, i) => {
                  const cur = i === run.index;
                  const c = r === true ? { bg: '#E3F7EE', fg: '#075E3A', ring: '#087A4A' } : r === false ? { bg: '#FDECEC', fg: '#B42318', ring: '#D92D20' } : { bg: '#F4F6FA', fg: '#4A5468', ring: '#2F5BFF' };
                  return (
                    <View key={i} style={[st.cell, { backgroundColor: c.bg }, cur && webShadow(`inset 0 0 0 2px ${c.ring}`)]}>
                      <Txt f="bodyHeavy" size={12} color={c.fg}>
                        {i + 1}
                      </Txt>
                    </View>
                  );
                })}
              </View>
            </View>
            <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: '#EEF1F7' }} />
            <Pressable accessibilityRole="link" onPress={openResult} style={({ pressed }) => [st.link, pressed && { opacity: 0.85 }]}>
              <IClock />
              <Txt f="bodyBold" size={14} color="#34405A" style={{ flex: 1 }}>
                Qism tugagach ({questions.length} / {questions.length}):{' '}
                <Txt f="bodyHeavy" size={14} color="#1E3FD1" style={{ textDecorationLine: 'underline' }}>
                  Natijani koʻrish
                </Txt>
              </Txt>
              <IChevron size={17} color="#1E3FD1" />
            </Pressable>
          </View>
        </View>
      </FocusBody>
    </FocusFrame>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 28, paddingVertical: 30, paddingHorizontal: 40, flexDirection: 'row', alignItems: 'center', gap: 34 },
  illu: { width: 176, height: 176, borderRadius: 88, backgroundColor: '#FFF4D1', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  results: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 22 },
  cell: { flex: 1, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  link: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
});
