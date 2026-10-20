/**
 * Kompyuter: "Moslashtirish" qismi (dizayn: D_Match). Mantiq mobil MatchView
 * bilan aynan bir xil: ruscha so'z, keyin tarjima bosiladi; to'g'ri juftlik
 * +1 coin; aniqlik = juftliklar / (juftliklar + xatolar); 6 tadan bosqich.
 * Tab + Enter — tugmalar orasida yurish va tanlash (veb fokus).
 */
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { FocusFrame } from '@/components/v2/desktop/Shell';
import { shuffle } from '@/components/v2/homework/lib';
import { RetryView } from '@/components/v2/homework/PartStates';
import { usePartRun } from '@/components/v2/homework/usePartRun';
import { Pop } from '@/components/v2/motion';
import { designImages } from '@/constants/v2/designImages';
import type { HomeworkPart, MatchPair } from '@/data/lessonContent';
import { playSfx } from '@/services/sfx';
import { praiseAnswer } from '@/services/voicePraise';

import type { PartCtx } from './DPart';
import { caps, FocusBody, HeaderBar, HeaderChip, ICheck, KeysHint, Loading, Txt, WhiteFooter, webShadow } from './dui';

const STAGE = 6;

export function DMatch({ ctx, part, pairs }: { ctx: PartCtx; part: HomeworkPart; pairs: MatchPair[] }) {
  const run = usePartRun(ctx.lessonId, part, pairs.length, ctx.allParts);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [wrong, setWrong] = useState<{ left: string; right: string } | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const stages = Math.max(1, Math.ceil(pairs.length / STAGE));
  const stage = Math.min(stages - 1, Math.floor(matched.size / STAGE));
  const stagePairs = useMemo(() => pairs.slice(stage * STAGE, stage * STAGE + STAGE), [pairs, stage]);
  const right = useMemo(() => shuffle(stagePairs), [stagePairs]);

  // Moslashtirish chala qolgan joydan davom ettirilmaydi — boshidan (mobil kabi).
  useEffect(() => {
    if (run.ready && run.index > 0 && !run.replay) run.retry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.ready]);

  const title = `Juftlarini toping${run.replay ? ' · takrorlash' : ''}`;
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
              setMatched(new Set());
              setWrongCount(0);
              run.retry();
            }}
          />
        </View>
      </FocusFrame>
    );

  const tapLeft = (id: string) => {
    if (!matched.has(id)) setSelected(id);
  };
  const tapRight = (id: string) => {
    if (!selected || matched.has(id) || wrong) return;
    if (selected === id) {
      const next = new Set(matched);
      next.add(id);
      setMatched(next);
      setSelected(null);
      run.answer(true);
      playSfx('match');
      praiseAnswer(true);
      if (next.size === pairs.length) {
        const accuracy = pairs.length / (pairs.length + wrongCount);
        setTimeout(() => void run.finish(Math.round(accuracy * pairs.length * 1000) / 1000), 500);
      }
    } else {
      const p = pairs.find((x) => x.id === selected);
      setWrongCount((c) => c + 1);
      playSfx('wrong');
      praiseAnswer(false);
      if (!run.replay && p) run.answer(false, `${p.left} — ${p.right}`, false);
      setWrong({ left: selected, right: id });
      setTimeout(() => {
        setWrong(null);
        setSelected(null);
      }, 500);
    }
  };

  const stageMatched = stagePairs.filter((p) => matched.has(p.id)).length;

  const tile = (key: string, label: string, isLeft: boolean) => {
    const done = matched.has(key);
    const isSel = isLeft && selected === key;
    const isWrong = !!wrong && (isLeft ? wrong.left === key : wrong.right === key);
    const c = done
      ? { border: '#BFE8D3', bg: '#E3F7EE', fg: '#075E3A', shadow: '' }
      : isWrong
        ? { border: '#D92D20', bg: '#FDECEC', fg: '#B42318', shadow: '#D92D20' }
        : isSel
          ? { border: '#2F5BFF', bg: '#E8EEFF', fg: '#1E3FD1', shadow: '#2F5BFF' }
          : { border: '#E2E6EE', bg: '#FFFFFF', fg: '#0B1220', shadow: '#E2E6EE' };
    return (
      <Pressable
        key={(isLeft ? 'l-' : 'r-') + key}
        accessibilityRole="button"
        accessibilityState={{ disabled: done, selected: isSel }}
        disabled={done}
        onPress={() => (isLeft ? tapLeft(key) : tapRight(key))}
        style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [
          st.tile,
          { borderColor: !done && !isSel && !isWrong && hovered ? '#C9D3F5' : c.border, backgroundColor: c.bg },
          c.shadow ? webShadow(`0 4px 0 ${c.shadow}`) : null,
        ]}
      >
        <Txt f="bodyHeavy" size={21} color={c.fg} lang={isLeft ? 'ru' : undefined} style={{ textAlign: 'center' }} numberOfLines={2}>
          {label}
        </Txt>
        {done && (
          <Pop from={0.3} style={st.doneMark}>
            <ICheck size={13} color="#FFFFFF" sw={3.2} />
          </Pop>
        )}
      </Pressable>
    );
  };

  return (
    <FocusFrame
      {...frame}
      center={<HeaderBar left={`${matched.size} / ${pairs.length}`} right={part.title} pct={(matched.size / pairs.length) * 100} color="#087A4A" label={`${pairs.length} juftlikdan ${matched.size} tasi topildi`} />}
      right={<HeaderChip green>{`${stageMatched} / ${stagePairs.length} juftlik`}</HeaderChip>}
      scroll={false}
    >
      <FocusBody
        bottom={
          <WhiteFooter height={100} width={900}>
            {/* Holat matni faqat takrorlash rejimida (mobil kabi). */}
            {run.replay ? (
              <>
                <Image source={designImages['81a355f68578bf95c65fc6772f9124c9']} resizeMode="contain" style={{ width: 60, height: 60 }} accessibilityElementsHidden />
                <Txt f="body" size={16} color="#34405A" lh={23.2} style={{ flex: 1 }}>
                  <Txt f="bodyHeavy" size={16}>
                    Takrorlash rejimi.
                  </Txt>
                  {` Vazifa topshirilgan: ${ctx.replayScore} — ball oʻzgarmaydi.`}
                </Txt>
              </>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Txt f="bodyBold" size={14} color="#4A5468">
              Juftlik topilgach keyingisi avtomatik ochiladi
            </Txt>
          </WhiteFooter>
        }
      >
        <View style={{ width: 900, maxWidth: '100%', gap: 22 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
            <View style={{ gap: 4, flexShrink: 1 }}>
              <Txt f="bodyHeavy" size={12} color="#1E3FD1" style={caps(12)}>
                {`${ctx.overline} · ${part.title}`}
              </Txt>
              <Txt f="display" size={32} style={{ letterSpacing: -0.64 }} accessibilityRole="header">
                Juftlarini toping
              </Txt>
              <Txt f="body" size={16} color="#4A5468">
                {stages > 1 ? `${stage + 1}-bosqich · ` : ''}
                {stagePairs.length} juftlik. Ruscha soʻzni, keyin tarjimasini bosing.
              </Txt>
            </View>
            <KeysHint keys={['Tab', 'Enter']} label="tanlash" />
          </View>
          <View style={{ gap: 14 }}>
            <View style={st.row}>
              <Txt f="bodyHeavy" size={12} color="#4A5468" style={[caps(12), st.colLabel]}>
                Ruscha
              </Txt>
              <Txt f="bodyHeavy" size={12} color="#4A5468" style={[caps(12), st.colLabel]}>
                Tarjima
              </Txt>
            </View>
            {stagePairs.map((p, i) => (
              <View key={p.id} style={st.row}>
                {tile(p.id, p.left, true)}
                {tile(right[i].id, right[i].right, false)}
              </View>
            ))}
          </View>
        </View>
      </FocusBody>
    </FocusFrame>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 28 },
  colLabel: { flex: 1, paddingLeft: 4 },
  tile: { flex: 1, height: 74, borderRadius: 20, borderWidth: 2, paddingHorizontal: 44, alignItems: 'center', justifyContent: 'center' },
  doneMark: { position: 'absolute', right: 16, top: '50%', marginTop: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: '#087A4A', alignItems: 'center', justifyContent: 'center' },
});
