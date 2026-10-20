/**
 * Kompyuter: Xatolar ustida ishlash (dizayn: D_MistakeReview). Mantiq mobil
 * xatolar.tsx bilan aynan bir xil: shu dars vazifasidagi xato savollar
 * (scoreStore results / mistakes) qayta yechiladi; coin va natija
 * o'zgarmaydi; oxirida "Darsni yakunlash" → Dars tugadi.
 * "Namuna" belgisi o'quvchiga ko'rsatilmaydi (egasi qarori).
 * Klaviatura: 1/2/3 — variant, Enter — keyingi.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { FocusFrame } from '@/components/v2/desktop/Shell';
import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { isTeacherGraded, loadLessonInfo, partLabel, type LessonInfo } from '@/components/v2/homework/lib';
import { useHomeworkScores, type PartScore } from '@/components/v2/homework/scoreStore';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import type { HomeworkPart } from '@/data/lessonContent';
import { resetPraiseRun, stopVoice } from '@/services/voicePraise';

import { BigButton, caps, DOption, FeedbackBar, FocusBody, IClose, Loading, Txt } from './dui';

type Item = { key: string; part: HomeworkPart; n: number; prompt: string; options: string[]; correct: string; prev?: string; fill: boolean };

const hasCyrillic = (s: string) => /[Ѐ-ӿ]/.test(s);

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

export function DMistakeReview() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const id = String(lessonId);
  const [info, setInfo] = useState<LessonInfo | null>(null);
  const [error, setError] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    resetPraiseRun();
    return () => stopVoice();
  }, []);
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

  // Ro'yxat bir marta tuziladi; avval test, keyin bo'sh joy xatolari (mobil kabi).
  const lessonScores = scores[id];
  useEffect(() => {
    if (!info || items) return;
    const order = (p: HomeworkPart) => (p.kind === 'multipleChoice' ? 0 : 1);
    const parts = info.content.homeworkParts.filter((p) => !isTeacherGraded(p)).sort((a, b) => order(a) - order(b));
    setItems(parts.flatMap((p) => mistakesOf(p, lessonScores?.[p.id])));
  }, [info, items, lessonScores]);

  const closeTo = `${R.homework(id)}?yuborildi=1`;
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
  const finish = () => router.replace(R.complete(id) as Href);
  useDesktopKeys(
    item ? Object.fromEntries(item.options.map((o, i) => [String(i + 1), () => setPicked(o)])) : { Enter: items ? finish : undefined },
    !answered,
  );

  // Bajarilgan va hozirgi xato — to'q sariq (dizayn: "Xato 1 / 2").
  const segs = list.map((_, i) => (i <= step ? '#FF7A1A' : '#E2E6EE'));

  return (
    <FocusFrame
      closeTo={closeTo}
      title="Bugungi xatolar"
      subtitle={`Xatolar ustida ishlash · ${total} ta`}
      center={
        total > 0 ? (
          <View style={{ width: 420, gap: 7 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt f="bodyHeavy" size={13} color="#34405A">
                Xato {step + 1} / {total}
              </Txt>
              <Txt f="bodyHeavy" size={13} color="#4A5468">
                Bugungi uyga vazifa
              </Txt>
            </View>
            <View accessibilityRole="progressbar" accessibilityLabel={`${total} ta xatodan ${step + 1}-si`} style={{ flexDirection: 'row', gap: 4 }}>
              {segs.map((c, i) => (
                <View key={i} style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: c }} />
              ))}
            </View>
          </View>
        ) : null
      }
      scroll={false}
    >
      {!info || !items ? (
        <Loading error={error} />
      ) : (
        <FocusBody
          bottom={
            item && answered ? (
              <FeedbackBar
                correct={ok}
                coin={false}
                title={ok ? 'Toʻgʻri! Bu safar topdingiz' : undefined}
                width={1000}
                detail={
                  <Txt f="bodyBold" size={16} color={ok ? '#075E3A' : '#B42318'} lh={22.4}>
                    {ok ? '' : 'Toʻgʻri javob: '}
                    <Txt f="bodyHeavy" size={16} color={ok ? '#075E3A' : '#B42318'} lang="ru">
                      «{item.correct}»
                    </Txt>
                  </Txt>
                }
                buttonLabel={isLast ? 'Darsni yakunlash' : `Keyingi · ${step + 2} / ${total}`}
                onPress={goNext}
              />
            ) : !item ? (
              <View style={st.footer}>
                <View style={{ width: 1000, maxWidth: '100%', flexDirection: 'row', justifyContent: 'flex-end' }}>
                  <BigButton label="Darsni yakunlash" kind="primary" arrow kbd="Enter" onPress={finish} />
                </View>
              </View>
            ) : (
              <View style={{ height: 132 }} />
            )
          }
        >
          <View style={{ width: 1000, maxWidth: '100%', gap: 24 }}>
            <View style={{ gap: 6 }}>
              <Txt f="display" size={34} lh={37.4} style={{ letterSpacing: -0.68, marginTop: 4 }} accessibilityRole="header">
                Xatolar ustida ishlash · {total} ta
              </Txt>
              <Txt f="body" size={16} color="#4A5468">
                Bugungi uyga vazifadagi xatolarni yana bir bor yeching
              </Txt>
            </View>

            {item && (
              <>
                <View style={st.card}>
                  <View style={st.illu}>
                    <Image source={designImages['c04932e65803a7f5c40ff5868fd21516']} resizeMode="contain" style={{ width: 136, height: 126 }} accessibilityElementsHidden />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                    <Txt f="bodyHeavy" size={12} color="#4A5468" style={caps(12)}>
                      {partLabel(item.part)} · {item.n}-savol
                    </Txt>
                    <Txt f="display" size={36} lh={39.6} lang={hasCyrillic(item.prompt) ? 'ru' : undefined} style={{ letterSpacing: -0.72 }}>
                      {item.fill && answered ? item.prompt.replace(/_{2,}/, item.correct) : item.prompt}
                    </Txt>
                    <Txt f="bodyBold" size={15} color="#4A5468">
                      {item.fill ? 'Gapni toʻldiring' : !hasCyrillic(item.prompt) && item.options.some(hasCyrillic) ? 'Ruschasini tanlang' : 'Toʻgʻri javobni tanlang'}
                    </Txt>
                  </View>
                </View>

                <View accessibilityRole="radiogroup" accessibilityLabel="Javob variantlari" style={{ flexDirection: 'row', gap: 14 }}>
                  {item.options.map((o, i) => (
                    <DOption
                      key={`${i}-${o}`}
                      test
                      n={i + 1}
                      label={o}
                      disabled={answered}
                      onPress={() => !answered && setPicked(o)}
                      state={!answered ? 'idle' : o === item.correct ? 'correct' : o === picked ? 'wrong' : 'idle'}
                    />
                  ))}
                </View>

                {(!!item.prev || !!next) && (
                  <View style={{ flexDirection: 'row', gap: 14, alignItems: 'stretch' }}>
                    {item.prev ? (
                      <View style={st.prevRow}>
                        <IClose size={18} color="#B42318" sw={2.8} />
                        <Txt f="bodyBold" size={15} color="#B42318" style={{ flex: 1 }}>
                          {'Avval: '}
                          <Txt f="bodyHeavy" size={15} color="#B42318" lang="ru" style={{ textDecorationLine: 'line-through' }}>
                            «{item.prev}»
                          </Txt>
                          {' — notoʻgʻri edi'}
                        </Txt>
                      </View>
                    ) : (
                      <View style={{ flex: 1 }} />
                    )}
                    {next ? (
                      <View accessibilityLabel="Navbatdagi xato" style={st.nextCard}>
                        <View style={st.nextNum}>
                          <Txt f="bodyHeavy" size={14} color="#B34700">
                            {step + 2}
                          </Txt>
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                          <Txt f="bodyHeavy" size={12} color="#4A5468" style={caps(12)}>
                            Navbatda
                          </Txt>
                          <Txt f="bodyHeavy" size={15} numberOfLines={1}>
                            {partLabel(next.part)} · {nextCount} ta xato
                          </Txt>
                        </View>
                      </View>
                    ) : (
                      <View style={{ flex: 1 }} />
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </FocusBody>
      )}
    </FocusFrame>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 28, paddingVertical: 26, paddingHorizontal: 36, flexDirection: 'row', alignItems: 'center', gap: 30 },
  illu: { width: 148, height: 148, borderRadius: 74, backgroundColor: '#FFF4D1', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  prevRow: { flex: 1, backgroundColor: '#FDECEC', borderRadius: 18, paddingHorizontal: 20, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10 },
  nextCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 18, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF1E6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  footer: { height: 112, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E4E8F0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
});
