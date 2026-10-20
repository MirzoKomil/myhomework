/**
 * Kompyuter: "Bo'sh joyni to'ldiring" qismi — D_Exercise (variantli savol)
 * va D_TypeAnswer (har 5-savol yozib javob beriladi). Mantiq mobil
 * FillBlankView / TypeAnswerView bilan aynan bir xil: usePartRun (har
 * to'g'ri javob +1 coin +1 chaqmoq, 65% dan kam — qayta urinish),
 * urg'usiz/ё-siz solishtirish (normalizeRu), "Birinchi harf" bir marta.
 */
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

import { FocusFrame, FocusProgress } from '@/components/v2/desktop/Shell';
import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { blankExtras } from '@/components/v2/homework/ChoiceParts';
import { RetryView } from '@/components/v2/homework/PartStates';
import { getPartScore } from '@/components/v2/homework/scoreStore';
import { isTypedQuestion, normalizeRu } from '@/components/v2/homework/TypeAnswer';
import { usePartRun, type PartRun } from '@/components/v2/homework/usePartRun';
import { designImages } from '@/constants/v2/designImages';
import type { GrammarBlank, HomeworkPart, SpeakingPrompt, VocabWord } from '@/data/lessonContent';

import type { PartCtx } from './DPart';
import { BigButton, caps, DOption, FeedbackBar, FocusBody, HeaderChip, IBulb, ICoin, IKeyboard, KbdKey, KeysHint, Loading, segColor, Txt, WhiteFooter, webShadow } from './dui';

/** Har savol holati: javob berilgan bo'lsa to'g'ri/xato (mobil segStates bilan bir xil). */
export function questionStates(run: PartRun, total: number, answeredNow: number, lessonId: string, partId: string, textOf: (i: number) => string) {
  const saved = getPartScore(lessonId, partId);
  return Array.from({ length: total }, (_, i) => {
    if (i >= answeredNow) return undefined;
    if (run.results[i] !== undefined) return run.results[i];
    return !(saved?.mistakes ?? []).includes(textOf(i));
  });
}

/** Sarlavha markazi: "Savol 4 / 10" · "4 / 4 to'g'ri" va har savol bo'lagi. */
export function QuestionProgress({ index, states, label }: { index: number; states: (boolean | undefined)[]; label: string }) {
  const answered = states.filter((x) => x !== undefined).length;
  const correct = states.filter((x) => x === true).length;
  return (
    <FocusProgress
      left={`Savol ${index + 1} / ${states.length}`}
      right={answered ? `${correct} / ${answered} toʻgʻri` : undefined}
      rightColor={correct === answered ? '#075E3A' : '#B42318'}
      segments={states.map((r, i) => segColor(r, i === index))}
      label={label}
    />
  );
}

type Props = { ctx: PartCtx; part: HomeworkPart; blanks: GrammarBlank[]; vocabulary: VocabWord[]; phrases: SpeakingPrompt[] };

export function DFillBlank({ ctx, part, blanks, vocabulary, phrases }: Props) {
  const run = usePartRun(ctx.lessonId, part, blanks.length, ctx.allParts);
  const [selected, setSelected] = useState<string | null>(null);
  const q = blanks[Math.min(run.index, blanks.length - 1)];
  const typed = isTypedQuestion(run.index);
  const answered = selected !== null;

  const pick = (opt: string) => {
    if (answered || !run.ready || run.tooLow !== null || typed) return;
    setSelected(opt);
    run.answer(opt === q.answer, q.sentence, true, opt);
  };
  // 1/2/3 — variant tanlash (dizayndagi <kbd>).
  useDesktopKeys(Object.fromEntries(q.options.map((o, i) => [String(i + 1), () => pick(o)])), !answered && !typed);

  if (!run.ready)
    return (
      <FocusFrame closeTo={ctx.closeTo} title={`Uyga vazifa · ${ctx.short}`} subtitle={ctx.lessonName}>
        <Loading />
      </FocusFrame>
    );
  if (run.tooLow !== null)
    return (
      <FocusFrame closeTo={ctx.closeTo} title={`Uyga vazifa · ${ctx.short}`} subtitle={ctx.lessonName}>
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

  // Har 5-savol — yozib javob berish (D_TypeAnswer).
  if (typed) {
    return (
      <DTypeAnswer
        key={q.id}
        ctx={ctx}
        part={part}
        run={run}
        blank={q}
        blanks={blanks}
        translation={blankExtras(q, vocabulary, phrases).translation}
        onAnswer={(ok, t) => run.answer(ok, q.sentence, true, t)}
        onNext={() => run.next()}
      />
    );
  }

  const isCorrect = selected === q.answer;
  const others = q.options.filter((o) => o !== q.answer);
  const states = questionStates(run, blanks.length, run.index + (answered ? 1 : 0), ctx.lessonId, part.id, (i) => blanks[i]?.sentence ?? '');
  const coins = states.filter((x) => x === true).length;
  const extras = blankExtras(q, vocabulary, phrases);
  const pieces = q.sentence.split(/_{2,}/);

  return (
    <FocusFrame
      closeTo={ctx.closeTo}
      title={`Uyga vazifa · ${ctx.short}`}
      subtitle={ctx.lessonName}
      center={<QuestionProgress index={run.index} states={states} label={`${part.title}: ${blanks.length} savoldan ${states.filter((x) => x !== undefined).length} tasi bajarildi`} />}
      right={!run.replay ? <HeaderChip>{`+${coins} coin`}</HeaderChip> : null}
      scroll={false}
    >
      <FocusBody
        bottom={
          answered ? (
            <FeedbackBar
              correct={isCorrect}
              coin={isCorrect && !run.replay}
              width={880}
              gap={18}
              btnPadLeft={30}
              btnSize={17}
              detail={isCorrect ? q.sentence.replace(/_{2,}/, q.answer) : `Toʻgʻri javob: «${q.answer}»`}
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
        <View style={{ width: 880, maxWidth: '100%', gap: 30 }}>
          <View style={{ gap: 4 }}>
            <Txt f="bodyHeavy" size={12} color="#1E3FD1" style={caps(12)}>
              {part.title}
            </Txt>
            <Txt f="display" size={32} style={{ letterSpacing: -0.64 }} accessibilityRole="header">
              Gapni toʻldiring
            </Txt>
          </View>
          <View style={st.card}>
            {/* Javob so'zining rasmi dars lug'atida bo'lsa — shu; bo'lmasa bo'sh doira (mobil kabi). */}
            <View style={st.illu}>
              {!!extras.imageUrl && <Image source={{ uri: extras.imageUrl }} resizeMode="contain" style={{ width: 158, height: 158 }} accessibilityElementsHidden />}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
              <Txt f="bodyHeavy" size={40} lh={52} lang="ru">
                {pieces.map((piece, i) => (
                  <Txt key={i} f="bodyHeavy" size={40} lh={52}>
                    {piece}
                    {i < pieces.length - 1 &&
                      (answered ? (
                        <Txt f="bodyHeavy" size={40} lh={52} color="#075E3A" style={st.fill}>
                          {q.answer}
                        </Txt>
                      ) : (
                        <Txt f="bodyHeavy" size={40} lh={52} style={st.blank}>
                          {Platform.OS === 'web' ? '' : '  '}
                        </Txt>
                      ))}
                  </Txt>
                ))}
              </Txt>
              {!!extras.translation && (
                <Txt f="body" size={18} color="#4A5468">
                  {extras.translation}
                </Txt>
              )}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {q.options.map((opt, i) => (
              <DOption
                key={opt}
                n={i + 1}
                label={opt}
                disabled={answered}
                onPress={() => pick(opt)}
                state={!answered ? 'idle' : opt === q.answer ? 'correct' : opt === selected ? 'wrong' : 'idle'}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 52 }}>
            {answered ? (
              // Eslatma: to'g'ri shakl va bu gapda ishlatilmaydigan variantlar (dars ma'lumotidan).
              <View style={st.tip}>
                <IBulb size={18} />
                <Txt f="bodyBold" size={15} color="#7A5300" lh={21} style={{ flex: 1 }}>
                  <Txt f="bodyHeavy" size={15} color="#7A5300" lang="ru">
                    {q.answer}
                  </Txt>
                  {others.length > 0 && (
                    <>
                      {' · '}
                      {others.map((o, i) => (
                        <Txt key={o} f="bodyBold" size={15} color="#7A5300">
                          {i > 0 ? (i === others.length - 1 ? ' va ' : ', ') : ''}
                          <Txt f="bodyBold" size={15} color="#7A5300" lang="ru">
                            {o}
                          </Txt>
                        </Txt>
                      ))}
                      {' bu yerda ishlatilmaydi.'}
                    </>
                  )}
                </Txt>
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <KeysHint keys={q.options.map((_, i) => String(i + 1))} label="tanlash" gap={6} />
          </View>
        </View>
      </FocusBody>
    </FocusFrame>
  );
}

/** D_TypeAnswer: tushib qolgan so'z jismoniy klaviaturada (ruscha) yoziladi. */
function DTypeAnswer({
  ctx,
  part,
  run,
  blank,
  blanks,
  translation,
  onAnswer,
  onNext,
}: {
  ctx: PartCtx;
  part: HomeworkPart;
  run: PartRun;
  blank: GrammarBlank;
  blanks: GrammarBlank[];
  translation?: string;
  onAnswer: (correct: boolean, typed: string) => void;
  onNext: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [hints, setHints] = useState(1);
  const [result, setResult] = useState<boolean | null>(null);
  const pieces = blank.sentence.split(/_{2,}/);
  // Gap boshidagi so'z bo'lsa bosh harf bilan yoziladi (mobil bilan bir xil).
  const startsSentence = pieces[0].trim() === '';
  const letters = typed.replace(/\s/g, '').length;
  const need = normalizeRu(blank.answer).replace(/\s/g, '').length;
  const canCheck = result === null && letters >= need;

  const add = (ch: string) => {
    if (result !== null) return;
    setTyped((t) => t + (t.length === 0 && startsSentence ? ch.toUpperCase() : ch.toLowerCase()));
  };
  const del = () => result === null && setTyped((t) => t.slice(0, -1));
  const check = () => {
    if (!canCheck) return;
    const ok = normalizeRu(typed) === normalizeRu(blank.answer);
    setResult(ok);
    onAnswer(ok, typed.trim());
  };
  const takeHint = () => {
    if (hints <= 0 || result !== null) return;
    setHints(0);
    setTyped(blank.answer.slice(0, 1));
  };

  // Jismoniy klaviatura: kirill harflar, Backspace, Enter (mobil vebdagi kabi).
  const ref = useRef({ add, del, check });
  ref.current = { add, del, check };
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Backspace') ref.current.del();
      else if (e.key === 'Enter') ref.current.check();
      else if (/^[Ѐ-ӿ ,.\-]$/.test(e.key)) ref.current.add(e.key);
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  // H — "Birinchi harf" maslahati.
  useDesktopKeys({ h: takeHint }, result === null);

  const states = questionStates(run, blanks.length, run.index + (result !== null ? 1 : 0), ctx.lessonId, part.id, (i) => blanks[i]?.sentence ?? '');
  const coins = states.filter((x) => x === true).length;
  const hintOff = hints <= 0 || result !== null;

  return (
    <FocusFrame
      closeTo={ctx.closeTo}
      title={part.title}
      subtitle={`Yozib javob bering · ${ctx.number}-dars`}
      center={<QuestionProgress index={run.index} states={states} label={`${part.title}: ${blanks.length} savoldan ${run.index + 1}-si`} />}
      right={!run.replay ? <HeaderChip>{`+${coins} coin`}</HeaderChip> : null}
      scroll={false}
    >
      <FocusBody
        bottom={
          result !== null ? (
            <FeedbackBar
              correct={result}
              coin={result && !run.replay}
              width={880}
              gap={18}
              btnPadLeft={30}
              btnSize={17}
              detail={result ? blank.sentence.replace(/_{2,}/, blank.answer) : `Toʻgʻri javob: «${blank.answer}»`}
              buttonLabel={result ? 'Davom etish' : 'Tushunarli'}
              onPress={onNext}
            />
          ) : (
            <WhiteFooter width={880}>
              <KeysHint keys={['Enter']} label="tekshirish" />
              <KeysHint keys={['Esc']} label="chiqish" />
              <View style={{ flex: 1 }} />
              {canCheck ? (
                <BigButton label="Tekshirish" kind="primary" kbd="Enter" onPress={check} pad={[24, 24]} />
              ) : (
                <BigButton label="Tekshirish · soʻzni tugating" kind="disabled" lock kbd="Enter" pad={[24, 24]} />
              )}
            </WhiteFooter>
          )
        }
      >
        <View style={{ width: 880, maxWidth: '100%', gap: 26 }}>
          <View accessibilityLabel={blank.sentence} style={st.qCard}>
            <View style={st.waiter}>
              <Image source={designImages['c04932e65803a7f5c40ff5868fd21516']} resizeMode="contain" style={{ width: 132, height: 122 }} accessibilityElementsHidden />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
              <Txt f="bodyHeavy" size={12} color="#1E3FD1" style={caps(12)}>
                Tushib qolgan soʻzni yozing
              </Txt>
              <Txt f="bodyHeavy" size={36} lh={45} lang="ru" accessibilityRole="header">
                «
                {pieces.map((piece, i) => (
                  <Txt key={i} f="bodyHeavy" size={36} lh={45}>
                    {piece}
                    {i < pieces.length - 1 &&
                      (result !== null ? (
                        <Txt f="bodyHeavy" size={36} lh={45} color={result ? '#075E3A' : '#B42318'}>
                          {blank.answer}
                        </Txt>
                      ) : (
                        <Txt f="bodyHeavy" size={36} lh={45} style={st.typeBlank}>
                          {Platform.OS === 'web' ? '' : '  '}
                        </Txt>
                      ))}
                  </Txt>
                ))}
                »
              </Txt>
              {!!translation && (
                <Txt f="body" size={16} color="#4A5468">
                  {translation}
                </Txt>
              )}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Txt f="bodyHeavy" size={15}>
                Javobingiz (ruscha)
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <IKeyboard />
                <Txt f="bodyBold" size={13} color="#1E3FD1">
                  Klaviaturada yozing
                </Txt>
              </View>
            </View>
            <View
              accessibilityRole="text"
              accessibilityLabel={`Javobingiz (ruscha): ${typed}`}
              style={[
                st.input,
                result === true && { borderColor: '#087A4A' },
                result === false && { borderColor: '#D92D20' },
                result === null && webShadow('0 0 0 5px #D4DEFF'),
              ]}
            >
              <Txt f="bodyHeavy" size={30} lang="ru">
                {typed}
              </Txt>
              {result === null && <View style={st.caret} />}
              <View style={{ flex: 1 }} />
              <Txt f="bodyBold" size={14} color="#4A5468">
                {letters} belgi
              </Txt>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Txt f="bodyBold" size={13} color="#4A5468">
                Urgʻu belgisi shart emas
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Txt f="bodyBold" size={13} color="#4A5468">
                  Ruscha klaviatura:
                </Txt>
                <KbdKey>Win</KbdKey>
                <Txt f="bodyBold" size={13} color="#4A5468">
                  +
                </Txt>
                <KbdKey>Space</KbdKey>
              </View>
            </View>
          </View>

          {/* "Vaziyat" kartasi — darsda bu savolga dialog ma'lumoti yo'q, shu sabab ko'rsatilmaydi. */}
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: hintOff }}
              disabled={hintOff}
              onPress={takeHint}
              style={({ pressed }) => [st.hint, hintOff && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
            >
              <IBulb size={22} />
              <View style={{ flex: 1, gap: 1 }}>
                <Txt f="bodyHeavy" size={16} color="#7A5300">
                  Birinchi harf
                </Txt>
                <Txt f="bodyBold" size={13} color="#7A5300">
                  {hints} marta · maslahat
                </Txt>
              </View>
              <KbdKey>H</KbdKey>
            </Pressable>
            <View style={st.reward}>
              <ICoin size={18} />
              <Txt f="bodyHeavy" size={14} color="#34405A">
                {run.replay ? 'Takrorlash · ball oʻzgarmaydi' : 'Toʻgʻri javob · +1 coin'}
              </Txt>
            </View>
          </View>
        </View>
      </FocusBody>
    </FocusFrame>
  );
}

const inlineBlock = (w: number, extra: object) => (Platform.OS === 'web' ? ({ display: 'inline-block', width: w, height: 0, ...extra } as object) : null);

const st = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 28, paddingVertical: 40, paddingHorizontal: 44, flexDirection: 'row', alignItems: 'center', gap: 36 },
  illu: { width: 184, height: 184, borderRadius: 92, backgroundColor: '#FFF1E6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fill: { backgroundColor: '#E3F7EE', borderRadius: 10, paddingHorizontal: 8, borderBottomWidth: 3, borderBottomColor: '#087A4A', ...(Platform.OS === 'web' ? ({ display: 'inline-block' } as object) : null) },
  blank: { borderBottomWidth: 4, borderBottomColor: '#2F5BFF', marginHorizontal: 6, ...inlineBlock(120, { verticalAlign: -2 }) },
  tip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15, paddingHorizontal: 18, borderRadius: 16, backgroundColor: '#FFF4D1' },
  qCard: { backgroundColor: '#FFFFFF', borderRadius: 28, paddingVertical: 32, paddingHorizontal: 36, flexDirection: 'row', alignItems: 'center', gap: 30 },
  waiter: { width: 144, height: 144, borderRadius: 72, backgroundColor: '#FFF4D1', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typeBlank: { borderBottomWidth: 4, borderBottomColor: '#2F5BFF', marginHorizontal: 6, ...inlineBlock(120, { verticalAlign: -2 }) },
  input: { height: 84, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#2F5BFF', paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 2 },
  caret: { width: 2.5, height: 34, backgroundColor: '#2F5BFF', borderRadius: 2 },
  hint: { flex: 1, minHeight: 64, borderRadius: 22, backgroundColor: '#FFF4D1', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18 },
  reward: { flex: 1, minHeight: 64, borderRadius: 18, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18 },
});
