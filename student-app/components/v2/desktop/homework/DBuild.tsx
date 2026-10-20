/**
 * Kompyuter: "Gap tuzish" qismi (dizayn: D_Build). Mantiq mobil BuildView
 * bilan aynan bir xil: so'zlar bankidan bosib gap yig'iladi, hammasi
 * joylashgach "Tekshirish"; yig'ilgan so'zni bosib qaytarish mumkin.
 * Klaviatura: Enter — tekshirish / davom etish, Backspace — oxirgi so'zni qaytarish.
 */
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { FocusFrame } from '@/components/v2/desktop/Shell';
import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { shuffle } from '@/components/v2/homework/lib';
import { RetryView } from '@/components/v2/homework/PartStates';
import { getPartScore } from '@/components/v2/homework/scoreStore';
import { usePartRun } from '@/components/v2/homework/usePartRun';
import { designImages } from '@/constants/v2/designImages';
import type { HomeworkPart, SentenceBuildQ } from '@/data/lessonContent';

import type { PartCtx } from './DPart';
import { BigButton, caps, FeedbackBar, FocusBody, HeaderBar, ICheck, IClose, KeysHint, Loading, Txt, WhiteFooter, webShadow } from './dui';

export function DBuild({ ctx, part, items }: { ctx: PartCtx; part: HomeworkPart; items: SentenceBuildQ[] }) {
  const run = usePartRun(ctx.lessonId, part, items.length, ctx.allParts);
  const [result, setResult] = useState<{ correct: boolean } | null>(null);
  const [built, setBuilt] = useState<number[]>([]);
  const [widths, setWidths] = useState<Record<number, number>>({});
  const item = items[Math.min(run.index, items.length - 1)];
  // Har yangi gapda so'zlar qayta aralashtiriladi.
  const words = useMemo(() => shuffle(item.words), [item]);
  const left = words.length - built.length;

  const check = () => {
    if (left > 0 || result) return;
    const ok = built.map((i) => words[i]).join(' ') === item.answer.join(' ');
    setResult({ correct: ok });
    run.answer(ok, item.translation);
  };
  useDesktopKeys({ Enter: check, Backspace: () => !result && setBuilt((b) => b.slice(0, -1)) }, run.ready && run.tooLow === null && !result);

  const title = `Gap tuzing${run.replay ? ' · takrorlash' : ''}`;
  const frame = { closeTo: ctx.closeTo, title, subtitle: `${ctx.number}-dars vazifasi · ${part.title}` };
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
              setResult(null);
              setBuilt([]);
              run.retry();
            }}
          />
        </View>
      </FocusFrame>
    );

  const saved = getPartScore(ctx.lessonId, part.id);
  const doneOk = (i: number) => run.results[i] ?? !(saved?.mistakes ?? []).includes(items[i].translation);
  // Javob qatoridagi bo'sh (punktir) joylar — qolgan so'zlar kengligida.
  const rest = words.map((_, i) => i).filter((i) => !built.includes(i));

  return (
    <FocusFrame
      {...frame}
      center={<HeaderBar left={`Gap ${run.index + 1} / ${items.length}`} right={part.title} pct={((run.index + 1) / items.length) * 100} color="#2F5BFF" label={`Gap ${run.index + 1} / ${items.length}`} />}
      scroll={false}
    >
      <FocusBody
        bottom={
          result ? (
            <FeedbackBar
              correct={result.correct}
              coin={result.correct && !run.replay}
              width={1180}
              detail={
                <Txt f="bodyBold" size={16} color={result.correct ? '#075E3A' : '#B42318'} lh={22.4} lang="ru">
                  {item.answer.join(' ')}
                </Txt>
              }
              buttonLabel={result.correct ? 'Davom etish' : 'Tushunarli'}
              onPress={() => {
                setResult(null);
                setBuilt([]);
                setWidths({});
                run.next();
              }}
            />
          ) : (
            <WhiteFooter width={1180}>
              <KeysHint keys={['Tab', 'Enter']} label="soʻz tanlash" />
              <KeysHint keys={['Backspace']} label="oxirgi soʻzni qaytarish" />
              <View style={{ flex: 1 }} />
              {left > 0 ? (
                <BigButton label={`Tekshirish · ${left} ta soʻz qoldi`} kind="disabled" lock kbd="Enter" pad={[24, 24]} />
              ) : (
                <BigButton label="Tekshirish" kind="primary" kbd="Enter" onPress={check} pad={[24, 24]} />
              )}
            </WhiteFooter>
          )
        }
      >
        <View style={{ width: 1180, maxWidth: '100%', flexDirection: 'row', gap: 32, alignItems: 'center' }}>
          <View style={{ flex: 1, minWidth: 0, gap: 28 }}>
            <View style={{ gap: 4 }}>
              <Txt f="bodyHeavy" size={12} color="#1E3FD1" style={caps(12)}>
                {`${ctx.overline} · ${part.title}`}
              </Txt>
              <Txt f="display" size={32} style={{ letterSpacing: -0.64 }} accessibilityRole="header">
                Rus tilida gap tuzing
              </Txt>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
              <Image source={designImages['2770f303e2a36a9ec52c3a0b44e9b032']} resizeMode="contain" style={{ width: 136, height: 127, flexShrink: 0 }} accessibilityElementsHidden />
              <View style={st.bubble}>
                <Txt f="bodyHeavy" size={28}>
                  {item.translation}
                </Txt>
              </View>
            </View>
            <View accessibilityLabel="Javob" style={st.answer}>
              {built.map((i) => (
                <Pressable key={i} accessibilityRole="button" disabled={!!result} onPress={() => setBuilt((b) => b.filter((x) => x !== i))} style={[st.word, webShadow('0 4px 0 #D5DBE7')]}>
                  <Txt f="bodyHeavy" size={24} lang="ru">
                    {words[i]}
                  </Txt>
                </Pressable>
              ))}
              {!result && rest.map((i) => <View key={`slot-${i}`} accessibilityElementsHidden style={[st.slotDash, { width: widths[i] ?? 110 }]} />)}
            </View>
            <View accessibilityLabel="Soʻzlar" style={st.bank}>
              {words.map((w, i) =>
                built.includes(i) ? (
                  <View key={i} accessibilityElementsHidden style={[st.slot, { width: widths[i] ?? 86 }]} />
                ) : (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    disabled={!!result}
                    onLayout={(e) => {
                      const w0 = e.nativeEvent.layout.width;
                      setWidths((m) => (m[i] === w0 ? m : { ...m, [i]: w0 }));
                    }}
                    onPress={() => setBuilt((b) => [...b, i])}
                    style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [st.word, webShadow('0 4px 0 #D5DBE7'), hovered && !result && { borderColor: '#9DB2FF' }]}
                  >
                    <Txt f="bodyHeavy" size={24} lang="ru">
                      {w}
                    </Txt>
                  </Pressable>
                ),
              )}
            </View>
            {/* Eslatma kartasi — darsda grammatika izohi maydoni yo'q, shu sabab ko'rsatilmaydi (mobil kabi). */}
          </View>

          <View accessibilityLabel="Tuzilgan gaplar" style={st.side}>
            <Txt f="bodyHeavy" size={12} color="#4A5468" style={[caps(12), { paddingHorizontal: 2, paddingBottom: 4 }]}>
              Tuzilgan gaplar
            </Txt>
            {items.map((it, i) => {
              if (i < run.index) {
                const ok = doneOk(i);
                const fg = ok ? '#075E3A' : '#B42318';
                return (
                  <View key={it.id} style={[st.sRow, { backgroundColor: ok ? '#E3F7EE' : '#FDECEC' }]}>
                    <View style={[st.sDot, { backgroundColor: ok ? '#087A4A' : '#D92D20' }]}>{ok ? <ICheck size={15} color="#FFFFFF" sw={3.2} /> : <IClose size={14} color="#FFFFFF" sw={3.2} />}</View>
                    <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                      <Txt f="bodyHeavy" size={17} color={fg} lang="ru">
                        {it.answer.join(' ')}
                      </Txt>
                      <Txt f="bodyBold" size={13} color={fg}>
                        {it.translation}
                      </Txt>
                    </View>
                    <Txt f="bodyHeavy" size={13} color={fg}>
                      {i + 1} / {items.length}
                    </Txt>
                  </View>
                );
              }
              if (i === run.index) {
                return (
                  <View key={it.id} style={[st.sRow, st.sNow]}>
                    <View style={[st.sDot, { backgroundColor: '#E8EEFF' }]}>
                      <Txt f="bodyHeavy" size={14} color="#1E3FD1">
                        {i + 1}
                      </Txt>
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                      <Txt f="bodyBold" size={13} color="#4A5468">
                        Hozirgi gap
                      </Txt>
                      <Txt f="bodyHeavy" size={17} lang="ru">
                        {[...built.map((k) => words[k]), '…'].join(' ')}
                      </Txt>
                    </View>
                    <Txt f="bodyHeavy" size={13} color="#1E3FD1">
                      {i + 1} / {items.length}
                    </Txt>
                  </View>
                );
              }
              return (
                <View key={it.id} style={[st.sRow, { backgroundColor: '#F4F6FA' }]}>
                  <View style={[st.sDot, { backgroundColor: '#FFFFFF' }]}>
                    <Txt f="bodyHeavy" size={14} color="#4A5468">
                      {i + 1}
                    </Txt>
                  </View>
                  <Txt f="bodyBold" size={15} color="#4A5468" style={{ flex: 1 }}>
                    {i + 1}-gap
                  </Txt>
                  <Txt f="bodyHeavy" size={13} color="#4A5468">
                    {i + 1} / {items.length}
                  </Txt>
                </View>
              );
            })}
            <View style={{ flex: 1 }} />
            {run.replay && (
              <View style={st.replay}>
                <Image source={designImages['81a355f68578bf95c65fc6772f9124c9']} resizeMode="contain" style={{ width: 40, height: 40 }} accessibilityElementsHidden />
                <Txt f="bodyBold" size={13} color="#4A5468" lh={18.2} style={{ flex: 1 }}>
                  Takrorlash rejimi · vazifa topshirilgan: {ctx.replayScore}
                </Txt>
              </View>
            )}
          </View>
        </View>
      </FocusBody>
    </FocusFrame>
  );
}

const st = StyleSheet.create({
  bubble: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 22, paddingHorizontal: 28, flexShrink: 1 },
  answer: { minHeight: 190, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', gap: 12 },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  word: { height: 62, paddingHorizontal: 24, borderRadius: 17, borderWidth: 2, borderColor: '#D5DBE7', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  slot: { height: 62, borderRadius: 17, backgroundColor: '#E9EDF4' },
  slotDash: { height: 62, borderRadius: 17, borderWidth: 2, borderStyle: 'dashed', borderColor: '#C9D1E0' },
  side: { width: 420, flexShrink: 0, alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 26, padding: 20, gap: 10 },
  sRow: { minHeight: 64, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sNow: { backgroundColor: '#FFFFFF', borderWidth: 2, borderStyle: 'dashed', borderColor: '#9DB2FF' },
  sDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  replay: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: '#EEF1F7' },
});
