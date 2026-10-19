/**
 * v2 Xatolar ustida ishlash (dizayn: 83 · MistakeReview).
 *
 * Shu dars uyga vazifasida xato qilingan savollar (scoreStore: results /
 * eski yozuvlarda mistakes) qayta yechiladi. Savol va variantlar — dars
 * kontenti (loadLessonInfo). Variantli turlar (test, bo'sh joy) qayta
 * yechiladi; avvalgi noto'g'ri javob — scoreStore picks. Bu mashq — coin
 * va natija o'zgarmaydi. HomeworkSent, Complete va Lug'atdan ochiladi.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CloseIcon } from '@/components/v2/homework/icons';
import { isTeacherGraded, loadLessonInfo, partLabel, type LessonInfo } from '@/components/v2/homework/lib';
import { useHomeworkScores, type PartScore } from '@/components/v2/homework/scoreStore';
import { FeedbackSheet, LabelHeader, OptionRow, Txt, webShadow } from '@/components/v2/homework/ui';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import type { HomeworkPart } from '@/data/lessonContent';

type Item = { key: string; part: HomeworkPart; n: number; prompt: string; options: string[]; correct: string; prev?: string; fill: boolean };

const hasCyrillic = (s: string) => /[Ѐ-ӿ]/.test(s);

/** Qismdagi xato savollar (tartib bo'yicha). */
function mistakesOf(p: HomeworkPart, sc: PartScore | undefined): Item[] {
  if (!sc) return [];
  const wrong = (i: number, text: string) => (sc.results?.[i] !== undefined ? sc.results[i] === false : sc.mistakes.includes(text));
  const prev = (i: number) => sc.picks?.[i] || undefined;
  if (p.kind === 'multipleChoice') {
    return p.questions
      .map((q, i) => ({ q, i }))
      .filter(({ q, i }) => wrong(i, q.question))
      .map(({ q, i }) => ({ key: `${p.id}-${q.id}`, part: p, n: i + 1, prompt: q.question, options: q.options, correct: q.options[q.correctIndex] ?? '', prev: prev(i), fill: false }));
  }
  if (p.kind === 'fillBlank') {
    return p.blanks
      .map((b, i) => ({ b, i }))
      .filter(({ b, i }) => wrong(i, b.sentence))
      .map(({ b, i }) => ({ key: `${p.id}-${b.id}`, part: p, n: i + 1, prompt: b.sentence, options: b.options, correct: b.answer, prev: prev(i), fill: true }));
  }
  return [];
}

export default function MistakeReviewScreen() {
  const insets = useSafeAreaInsets();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const id = String(lessonId);
  const [info, setInfo] = useState<LessonInfo | null>(null);
  const [error, setError] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
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

  // Ro'yxat bir marta tuziladi — yechish davomida o'zgarib ketmasin.
  const lessonScores = scores[id];
  useEffect(() => {
    if (!info || items) return;
    // Dizayndagidek avval test (C), keyin bo'sh joy (B) xatolari.
    const order = (p: HomeworkPart) => (p.kind === 'multipleChoice' ? 0 : 1);
    const parts = info.content.homeworkParts.filter((p) => !isTeacherGraded(p)).sort((a, b) => order(a) - order(b));
    setItems(parts.flatMap((p) => mistakesOf(p, lessonScores?.[p.id])));
  }, [info, items, lessonScores]);

  const close = () => (router.canGoBack() ? router.back() : router.replace(`${R.homework(id)}?yuborildi=1` as Href));
  const list = items ?? [];
  const total = list.length;
  const item = list[step];
  const answered = picked !== null;
  const ok = !!item && picked === item.correct;
  const next = list[step + 1];
  const nextCount = next ? list.filter((x) => x.part.id === next.part.id).length : 0;
  const isLast = step + 1 >= total;

  const goNext = () => {
    if (isLast) {
      router.replace(R.complete(id) as Href);
      return;
    }
    setPicked(null);
    setStep(step + 1);
  };

  return (
    <View style={st.screen}>
      <View style={[st.column, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
        <LabelHeader
          label="Bugungi xatolar"
          current={total ? step + 1 : 0}
          barValue={step + (answered ? 1 : 0)}
          total={total}
          color="#FF7A1A"
          progressLabel={`Xatolar: ${total ? step + 1 : 0} / ${total}`}
          onClose={close}
        />
        {!info || !items ? (
          <View style={st.center}>
            {error ? (
              <Txt f="bodyBold" size={15} color="#4A5468">
                Vazifani yuklab boʻlmadi
              </Txt>
            ) : (
              <ActivityIndicator color="#2F5BFF" accessibilityLabel="Yuklanmoqda" />
            )}
          </View>
        ) : (
          <>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 4 }}>
                <Txt f="display" size={26} lh={28.6} style={{ letterSpacing: -0.52 }} accessibilityRole="header">
                  Xatolar ustida ishlash · {total} ta
                </Txt>
                <Txt f="body" size={14} color="#4A5468">
                  Bugungi uyga vazifadagi xatolarni yana bir bor yeching
                </Txt>
              </View>

              {item && (
                <>
                  <View style={st.card}>
                    <Image source={designImages['c04932e65803a7f5c40ff5868fd21516']} resizeMode="contain" style={{ width: 84, height: 80, flexShrink: 0 }} accessibilityElementsHidden />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Txt f="bodyHeavy" size={12} color="#4A5468" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        {partLabel(item.part)} · {item.n}-savol
                      </Txt>
                      <Txt f="display" size={22} lh={25.3} lang={hasCyrillic(item.prompt) ? 'ru' : undefined}>
                        {item.fill && answered ? item.prompt.replace(/_{2,}/, item.correct) : item.prompt}
                      </Txt>
                      <Txt f="body" size={13} color="#4A5468">
                        {item.fill ? 'Gapni toʻldiring' : !hasCyrillic(item.prompt) && item.options.some(hasCyrillic) ? 'Ruschasini tanlang' : 'Toʻgʻri javobni tanlang'}
                      </Txt>
                    </View>
                  </View>

                  <View accessibilityRole="radiogroup" accessibilityLabel="Javob variantlari" style={{ gap: 10 }}>
                    {item.options.map((o, i) => (
                      <OptionRow
                        key={`${i}-${o}`}
                        radio
                        label={o}
                        disabled={answered}
                        onPress={() => !answered && setPicked(o)}
                        state={!answered ? 'idle' : o === item.correct ? 'correct' : o === picked ? 'wrong' : 'idle'}
                      />
                    ))}
                  </View>

                  {!!item.prev && (
                    <View style={st.prevRow}>
                      <CloseIcon size={16} color="#B42318" />
                      <Txt f="bodyBold" size={13} color="#4A5468" style={{ flex: 1 }}>
                        {'Avval: '}
                        <Txt f="bodyBold" size={13} color="#B42318" lang="ru" style={{ textDecorationLine: 'line-through' }}>
                          «{item.prev}»
                        </Txt>
                        {' — notoʻgʻri edi'}
                      </Txt>
                    </View>
                  )}

                  {next && (
                    <View accessibilityLabel="Navbatdagi xato" style={st.nextCard}>
                      <View style={st.nextNum}>
                        <Txt f="bodyHeavy" size={14} color="#B34700">
                          {step + 2}
                        </Txt>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                        <Txt f="bodyHeavy" size={12} color="#4A5468" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                          Navbatda
                        </Txt>
                        <Txt f="bodyBold" size={14}>
                          {partLabel(next.part)} · {nextCount} ta xato
                        </Txt>
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {item && answered ? (
              <FeedbackSheet
                correct={ok}
                coin={false}
                title={ok ? 'Toʻgʻri! Bu safar topdingiz' : undefined}
                btnGap={10}
                alignTop
                checkSize={20}
                checkStroke={3}
                detail={
                  <Txt f="body" size={14} color={ok ? '#0B4D31' : '#7A1C14'} lh={20.3}>
                    {ok ? '' : 'Toʻgʻri javob: '}
                    <Txt f="bodyHeavy" size={14} color={ok ? '#0B4D31' : '#7A1C14'} lang="ru">
                      «{item.correct}»
                    </Txt>
                  </Txt>
                }
                buttonLabel={isLast ? 'Darsni yakunlash' : `Keyingi · ${step + 2} / ${total}`}
                onPress={goNext}
              />
            ) : (
              !item && (
                <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: Math.max(34, insets.bottom + 14) }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.replace(R.complete(id) as Href)}
                    style={({ pressed }) => [st.primary, webShadow('0 5px 0 #1E3FD1'), pressed && { opacity: 0.85 }]}
                  >
                    <Txt f="bodyHeavy" size={17} color="#FFFFFF">
                      Darsni yakunlash
                    </Txt>
                  </Pressable>
                </View>
              )
            )}
          </>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingTop: 18, paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  prevRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  nextCard: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF1E6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  primary: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
});
