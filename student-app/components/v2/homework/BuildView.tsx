/**
 * D · Gap tuzish (dizayn: Build). Mantiq eski SentenceBuildRound bilan bir
 * xil: so'zlar bankidan bosib gap yig'iladi, so'ng "Tekshirish". Dizayndagi
 * kabi ishlatilgan so'z bankda kulrang bo'sh joy bo'lib qoladi, yig'ilgan
 * so'zni bosib qaytarish mumkin.
 */
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { designImages } from '@/constants/v2/designImages';
import type { HomeworkPart, SentenceBuildQ } from '@/data/lessonContent';

import { BulbIcon } from './icons';
import { shuffle } from './lib';
import { RetryView } from './PartStates';
import { BarHeader, FeedbackSheet, Overline, Txt } from './ui';
import { usePartRun } from './usePartRun';

type Props = {
  lessonId: string;
  part: HomeworkPart;
  items: SentenceBuildQ[];
  allParts: HomeworkPart[];
  overline: string;
  onClose: () => void;
};

export function BuildView({ lessonId, part, items, allParts, overline, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const run = usePartRun(lessonId, part, items.length, allParts);
  const [result, setResult] = useState<{ correct: boolean } | null>(null);
  const [built, setBuilt] = useState<number[]>([]);
  const [widths, setWidths] = useState<Record<number, number>>({});
  const item = items[Math.min(run.index, items.length - 1)];
  // Har yangi gapda so'zlar qayta aralashtiriladi.
  const words = useMemo(() => shuffle(item.words), [item]);

  if (!run.ready) return null;
  if (run.tooLow !== null) return <RetryView percent={run.tooLow} onRetry={() => { setResult(null); setBuilt([]); run.retry(); }} />;

  const check = () => {
    const ok = built.map((i) => words[i]).join(' ') === item.answer.join(' ');
    setResult({ correct: ok });
    run.answer(ok, item.translation);
  };

  return (
    <View style={{ flex: 1 }}>
      <BarHeader current={run.index + 1} total={items.length} color="#2F5BFF" label={`${items.length} gapdan ${run.index + 1}-gap`} onClose={onClose} />
      <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 6 }}>
          <Overline>{overline}</Overline>
          <Txt f="display" size={24} style={{ letterSpacing: -0.24 }} accessibilityRole="header">
            Rus tilida gap tuzing
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={designImages['2770f303e2a36a9ec52c3a0b44e9b032']} resizeMode="contain" style={{ width: 72, height: 72, flexShrink: 0 }} accessibilityElementsHidden />
          <View style={st.bubble}>
            <Txt f="bodyBold" size={18} lh={24.3}>
              {item.translation}
            </Txt>
          </View>
        </View>
        <View accessibilityLabel="Javob qatori" style={st.answer}>
          {/* Dizayndagi ikkinchi qator chizig'i (72px balandlikda). */}
          <View pointerEvents="none" style={st.answerLine} />
          {built.map((i) => (
            <Pressable key={i} accessibilityRole="button" disabled={!!result} onPress={() => setBuilt((b) => b.filter((x) => x !== i))} style={[st.word, { paddingHorizontal: 16 }]}>
              <Txt f="bodyBold" size={18} lang="ru">
                {words[i]}
              </Txt>
            </Pressable>
          ))}
        </View>
        <View accessibilityLabel="Soʻzlar banki" style={st.bank}>
          {words.map((w, i) =>
            built.includes(i) ? (
              <View key={i} accessibilityElementsHidden style={[st.slot, { width: widths[i] ?? 52 }]} />
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
                style={st.word}
              >
                <Txt f="bodyBold" size={18} lang="ru">
                  {w}
                </Txt>
              </Pressable>
            ),
          )}
        </View>
        <View style={st.hint}>
          <BulbIcon />
          <Txt f="bodyBold" size={13} color="#4D3A00" lh={18.9} style={{ flex: 1 }}>
            Eslatma: soʻzni bosib gapga qoʻshing, gapdagi soʻzni bosib qaytaring.
          </Txt>
        </View>
      </ScrollView>
      {result ? (
        <FeedbackSheet
          correct={result.correct}
          coin={result.correct && !run.replay}
          detail={
            <Txt f={result.correct ? 'bodyBold' : 'body'} size={result.correct ? 15 : 14} color={result.correct ? '#075E3A' : '#7A1C14'} lang="ru">
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
        <View style={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: Math.max(34, insets.bottom + 14) }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: built.length === 0 }}
            disabled={built.length === 0}
            onPress={check}
            style={({ pressed }) => [st.check, pressed && { opacity: 0.85 }]}
          >
            <Txt f="bodyHeavy" size={17} color="#FFFFFF">
              Tekshirish
            </Txt>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  body: { paddingTop: 22, paddingHorizontal: 20, paddingBottom: 20, gap: 22 },
  bubble: { flex: 1, backgroundColor: '#F4F6FA', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16 },
  answer: { minHeight: 120, borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#E4E8F0', paddingVertical: 14, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', gap: 8 },
  answerLine: { position: 'absolute', left: 0, right: 0, top: 70, height: 2, backgroundColor: '#E4E8F0' },
  bank: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  word: { height: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 2, borderBottomWidth: 4, borderColor: '#D5DBE7', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  slot: { height: 48, borderRadius: 14, backgroundColor: '#EEF1F7' },
  hint: { backgroundColor: '#FFF4D1', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  check: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
});
