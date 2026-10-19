/**
 * A · Moslashtirish (dizayn: Match). Mantiq eski MatchingPart bilan bir xil:
 * chapdagi ruscha so'z, keyin o'ngdagi tarjima bosiladi; to'g'ri juftlik
 * +1 coin; aniqlik = juftliklar / (juftliklar + xatolar). Dizayndagi kabi
 * juftliklar bosqichlarga (6 tadan) bo'linadi.
 */
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { designImages } from '@/constants/v2/designImages';
import type { HomeworkPart, MatchPair } from '@/data/lessonContent';

import { shuffle } from './lib';
import { RetryView } from './PartStates';
import { BarHeader, Overline, Txt } from './ui';
import { usePartRun } from './usePartRun';

const STAGE = 6;

type Props = {
  lessonId: string;
  part: HomeworkPart;
  pairs: MatchPair[];
  allParts: HomeworkPart[];
  overline: string;
  /** "46 / 50 · 46 coin" — dars vazifasining umumiy natijasi (takrorlash rejimi uchun). */
  replayScore: string;
  onClose: () => void;
};

export function MatchView({ lessonId, part, pairs, allParts, overline, replayScore, onClose }: Props) {
  const run = usePartRun(lessonId, part, pairs.length, allParts);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [wrong, setWrong] = useState<{ left: string; right: string } | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const stages = Math.max(1, Math.ceil(pairs.length / STAGE));
  const stage = Math.min(stages - 1, Math.floor(matched.size / STAGE));
  const stagePairs = useMemo(() => pairs.slice(stage * STAGE, stage * STAGE + STAGE), [pairs, stage]);
  const right = useMemo(() => shuffle(stagePairs), [stagePairs]);

  // Moslashtirish chala qolgan joydan davom ettirilmaydi — boshidan boshlanadi.
  useEffect(() => {
    if (run.ready && run.index > 0 && !run.replay) run.retry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.ready]);

  if (!run.ready) return null;
  if (run.tooLow !== null)
    return (
      <RetryView
        percent={run.tooLow}
        onRetry={() => {
          setMatched(new Set());
          setWrongCount(0);
          run.retry();
        }}
      />
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
      if (next.size === pairs.length) {
        const accuracy = pairs.length / (pairs.length + wrongCount);
        setTimeout(() => void run.finish(Math.round(accuracy * pairs.length * 1000) / 1000), 500);
      }
    } else {
      const p = pairs.find((x) => x.id === selected);
      setWrongCount((c) => c + 1);
      if (!run.replay && p) run.answer(false, `${p.left} — ${p.right}`, false);
      setWrong({ left: selected, right: id });
      setTimeout(() => {
        setWrong(null);
        setSelected(null);
      }, 500);
    }
  };

  const tile = (key: string, label: string, isLeft: boolean) => {
    const done = matched.has(key);
    const isSel = isLeft && selected === key;
    const isWrong = wrong && (isLeft ? wrong.left === key : wrong.right === key);
    const c = done
      ? { border: '#BFE8D3', bg: '#E3F7EE', fg: '#075E3A', bottom: 2 }
      : isWrong
        ? { border: '#D92D20', bg: '#FDECEC', fg: '#B42318', bottom: 4 }
        : isSel
          ? { border: '#2F5BFF', bg: '#E8EEFF', fg: '#1E3FD1', bottom: 4 }
          : { border: '#E4E8F0', bg: '#FFFFFF', fg: '#0B1220', bottom: 4 };
    return (
      <Pressable
        key={(isLeft ? 'l-' : 'r-') + key}
        accessibilityRole="button"
        accessibilityState={{ disabled: done, selected: isSel }}
        disabled={done}
        onPress={() => (isLeft ? tapLeft(key) : tapRight(key))}
        style={[st.tile, { borderColor: c.border, backgroundColor: c.bg, borderBottomWidth: c.bottom }]}
      >
        <Txt f={isSel ? 'bodyHeavy' : 'bodyBold'} size={16} lh={20} color={c.fg} lang={isLeft ? 'ru' : undefined} style={{ textAlign: 'center' }}>
          {label}
        </Txt>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <BarHeader
        current={matched.size}
        total={pairs.length}
        color="#087A4A"
        label={`${pairs.length} juftlikdan ${matched.size} tasi topildi`}
        onClose={onClose}
      />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={st.intro}>
          <Overline>{overline}</Overline>
          <Txt f="display" size={24} style={{ letterSpacing: -0.24 }} accessibilityRole="header">
            Juftlarini toping
          </Txt>
          <Txt f="body" size={14} color="#4A5468" lh={19}>
            {stages > 1 ? `${stage + 1}-bosqich · ` : ''}
            {stagePairs.length} juftlik. Ruscha soʻzni, keyin tarjimasini bosing.
          </Txt>
        </View>
        <View style={st.grid}>
          {stagePairs.map((p, i) => (
            <View key={p.id} style={st.gridRow}>
              {tile(p.id, p.left, true)}
              {tile(right[i].id, right[i].right, false)}
            </View>
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <View accessibilityRole="text" style={st.status}>
          <Image source={designImages['81a355f68578bf95c65fc6772f9124c9']} resizeMode="contain" style={{ width: 56, height: 56, flexShrink: 0 }} accessibilityElementsHidden />
          <Txt f="bodyBold" size={13} color="#4A5468" lh={18.2} style={{ flex: 1 }}>
            {run.replay ? (
              <>
                <Txt f="bodyHeavy" size={13}>
                  Takrorlash rejimi.
                </Txt>
                {' Vazifa topshirilgan: '}
                <Txt f="bodyBold" size={13} color="#4A5468" style={st.nowrap}>
                  {replayScore}
                </Txt>
                {' — ball oʻzgarmaydi.'}
              </>
            ) : (
              'Har toʻgʻri juftlik +1 coin.'
            )}
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  intro: { paddingTop: 22, paddingHorizontal: 20, gap: 6 },
  grid: { paddingTop: 20, paddingHorizontal: 20, gap: 12 },
  gridRow: { flexDirection: 'row', gap: 12 },
  nowrap: { ...({ whiteSpace: 'nowrap' } as object) },
  tile: { flex: 1, minHeight: 72, borderRadius: 16, borderWidth: 2, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  status: { marginHorizontal: 20, marginBottom: 34, marginTop: 16, backgroundColor: '#F4F6FA', borderRadius: 18, paddingVertical: 12, paddingLeft: 8, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
