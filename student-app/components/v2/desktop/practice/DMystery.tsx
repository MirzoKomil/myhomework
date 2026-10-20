/**
 * Kompyuter: Sirli soʻz (dizayn: D_Mystery).
 *
 * Mantiq telefon bilan bitta (useMysteryGame): 5 harf, 6 urinish, harf
 * holatlari, Maslahat (−10 coin), GameResult. Jismoniy klaviatura (harflar,
 * Enter — tekshirish, Backspace — o'chirish) hook ichida ulangan; ekran
 * klaviaturasi faqat holatni ko'rsatadi va bosilsa ham yozadi.
 * Esc — chiqish.
 */
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { FocusFrame } from '@/components/v2/desktop/Shell';
import { GameResult } from '@/components/v2/practice/GameResult';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';

import { H, IArrow, IBulb, ICheck, IInfo, K, KeyHints, T, web } from './ui';
import { HINT_PRICE, LEN, MAX_TRIES, ST_LABEL, useMysteryGame, type St } from './useMysteryGame';

const img = (id: string) => (designImages as Record<string, ImageSourcePropType>)[id];

// D_Mystery klaviaturasi: 11 + 11 + 11 harf (Ё — 3-qator oxirida).
const KB_RU = [
  ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х'],
  ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'],
  ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'ъ', 'б', 'ю', 'ё'],
];
const KB_EN = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];
const ST_BG: Record<St, string> = { correct: '#087A4A', present: '#8A5A00', absent: '#5B6478' };

/** "Bor, joyi boshqa" — ichki punktir ramka (dizayndagi outline: dashed, offset manfiy). */
const Dashed = ({ inset, width, radius }: { inset: number; width: number; radius: number }) => (
  <View pointerEvents="none" style={{ position: 'absolute', top: inset, left: inset, right: inset, bottom: inset, borderWidth: width, borderStyle: 'dashed', borderColor: '#FFE08A', borderRadius: radius }} />
);

export function DMystery() {
  const { isRu, lesson, answer, guesses, cur, hints, msg, over, keyState, type, submit, hint, restart, attempt } = useMysteryGame();
  const kb = isRu ? KB_RU : KB_EN;

  const center = (
    <View style={{ width: 440, gap: 7 }}>
      <View style={s.between}>
        <T w={800} size={13} color="#34405A" lh={18}>
          Urinishlar
        </T>
        <T w={700} size={13} color="#075E3A" lh={18}>
          {attempt}-urinish / {MAX_TRIES}
        </T>
      </View>
      <View accessibilityLabel="Urinishlar" style={{ flexDirection: 'row', gap: 5 }}>
        {Array.from({ length: MAX_TRIES }, (_, i) => {
          const done = i < guesses.length;
          const curRow = i === guesses.length && !over;
          return (
            <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: done ? '#087A4A' : curRow ? '#BFE8D3' : '#E2E6EE' }}>
              {curRow && <View style={{ width: `${(cur.length / LEN) * 100}%`, height: 8, backgroundColor: '#087A4A' }} />}
            </View>
          );
        })}
      </View>
    </View>
  );

  const right = (
    <View style={s.topic}>
      <T w={800} size={15} color={msg ? '#B42318' : '#075E3A'} lh={20} lines={1}>
        {msg ?? `Mavzu: ${lesson?.name ?? '—'}`}
      </T>
    </View>
  );

  const footer = (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      {over ? (
        <Pressable accessibilityRole="button" onPress={restart} style={s.helpBtn}>
          <T w={800} size={15} lh={20}>
            {over === 'won' ? 'Topdingiz! Yana' : `Javob: ${answer.toUpperCase()} · Yana`}
          </T>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" onPress={hint} style={s.helpBtn}>
          <IBulb />
          <T w={800} size={15} lh={20}>
            Maslahat · −{HINT_PRICE} coin
          </T>
        </Pressable>
      )}
      <KeyHints
        items={[
          [['Backspace'], 'oʻchirish'],
          [['Esc'], 'chiqish'],
        ]}
      />
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Javobni tekshirish (Enter)" aria-keyshortcuts="Enter" onPress={submit} style={[s.submit, web({ boxShadow: '0 5px 0 #075E3A' })]}>
        <T w={800} size={16} color="#FFFFFF" lh={22}>
          Tekshirish
        </T>
        <IArrow />
        <K tone="green">Enter</K>
      </Pressable>
    </View>
  );

  return (
    <FocusFrame closeTo={R.practice} title="Sirli soʻz" subtitle={`Bugungi soʻz · ${LEN} harf`} center={center} right={right} bg="#EAF7F0" footer={footer} footerHeight={100} footerWidth={1040}>
      <View style={s.body}>
        <View style={s.wrap}>
          <View accessibilityLabel="Urinishlar" style={{ gap: 10 }}>
            {Array.from({ length: MAX_TRIES }, (_, ri) => {
              const g = guesses[ri];
              const isCur = ri === guesses.length && !over;
              return (
                <View key={ri} style={{ flexDirection: 'row', gap: 10 }}>
                  {Array.from({ length: LEN }, (_, ci) => {
                    if (g) {
                      const st = g.st[ci];
                      return (
                        <View key={ci} accessibilityLabel={`${g.word[ci].toUpperCase()} — ${ST_LABEL[st]}`} style={[s.tile, { backgroundColor: ST_BG[st] }]}>
                          {st === 'present' && <Dashed inset={3} width={3} radius={15} />}
                          <Text style={s.tileText}>{g.word[ci].toUpperCase()}</Text>
                          {st === 'correct' && (
                            <View style={s.tick}>
                              <ICheck />
                            </View>
                          )}
                        </View>
                      );
                    }
                    if (isCur) {
                      const ch = cur[ci];
                      if (ch)
                        return (
                          <View key={ci} style={[s.tile, s.typed]}>
                            <Text style={[s.tileText, { color: '#0B1220' }]}>{ch.toUpperCase()}</Text>
                          </View>
                        );
                      if (ci === cur.length)
                        return (
                          <View key={ci} accessibilityLabel="Keyingi harf" style={[s.tile, s.caretTile]}>
                            {hints[ci] ? <Text style={[s.tileText, { color: '#9AA4BC' }]}>{hints[ci].toUpperCase()}</Text> : <View style={s.caret} />}
                          </View>
                        );
                      return (
                        <View key={ci} style={[s.tile, s.nextEmpty]}>
                          {!!hints[ci] && <Text style={[s.tileText, { color: '#9AA4BC' }]}>{hints[ci].toUpperCase()}</Text>}
                        </View>
                      );
                    }
                    return <View key={ci} style={[s.tile, { backgroundColor: '#D3EEDF' }]} />;
                  })}
                </View>
              );
            })}
          </View>

          <View style={{ width: 470, gap: 18 }}>
            <View style={s.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={s.gameIcon}>
                  <Image source={img('7776361bb82c98efcd4c31c51e6331f1')} style={{ width: 54, height: 54 }} resizeMode="contain" />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <H size={26} lh={31}>
                    Kun soʻzini toping
                  </H>
                  <T w={600} size={15} color="#4A5468" lh={20}>
                    {LEN} harfli {isRu ? 'ruscha' : 'inglizcha'} soʻz · {MAX_TRIES} ta urinish
                  </T>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                <View style={s.legendItem}>
                  <View style={[s.legendBox, { backgroundColor: '#087A4A' }]}>
                    <ICheck size={13} />
                  </View>
                  <T w={700} size={14} color="#34405A" lh={19}>
                    oʻz joyida
                  </T>
                </View>
                <View style={s.legendItem}>
                  <View style={[s.legendBox, { backgroundColor: '#8A5A00' }]}>
                    <Dashed inset={2} width={2} radius={4} />
                  </View>
                  <T w={700} size={14} color="#34405A" lh={19}>
                    bor, joyi boshqa
                  </T>
                </View>
                <View style={s.legendItem}>
                  <View style={[s.legendBox, { backgroundColor: '#5B6478' }]} />
                  <T w={700} size={14} color="#34405A" lh={19}>
                    yoʻq
                  </T>
                </View>
              </View>
              <View accessibilityLabel={isRu ? 'Kirill klaviaturasi — harflar holati' : 'Klaviatura — harflar holati'} style={{ gap: 6 }}>
                {kb.map((row, ri) => (
                  <View key={ri} style={{ flexDirection: 'row', gap: 5, justifyContent: 'center' }}>
                    {row.map((l) => {
                      const st = keyState[l];
                      return (
                        <Pressable key={l} accessibilityRole="button" accessibilityLabel={l} onPress={() => type(l)} style={[s.key, st && { backgroundColor: ST_BG[st] }]}>
                          {st === 'present' && <Dashed inset={2} width={2} radius={8} />}
                          <Text style={[s.keyText, st && { color: '#FFFFFF' }]}>{l.toUpperCase()}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
            <View style={s.info}>
              <IInfo color="#087A4A" />
              <T w={700} size={15} color="#34405A" lh={21} style={{ flex: 1 }}>
                Klaviaturada {isRu ? 'kirill' : 'lotin'} harflarida yozing. Klaviatura holati — qaysi harflar sinab koʻrilganini koʻrsatadi.
              </T>
            </View>
          </View>
        </View>
      </View>
      <GameResult
        show={!!over}
        win={over === 'won'}
        title={over === 'won' ? 'Topdingiz!' : 'Bu safar topilmadi'}
        subtitle={over === 'won' ? `Soʻz: ${answer.toUpperCase()}` : `Javob: ${answer.toUpperCase()}`}
        stats={[{ value: `${guesses.length} / ${MAX_TRIES}`, label: 'urinish' }]}
        coins={over === 'won' ? 1 : 0}
        lightning={over === 'won' ? 1 : 0}
        onAgain={restart}
      />
    </FocusFrame>
  );
}

const s = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topic: { height: 46, paddingHorizontal: 18, borderRadius: 15, backgroundColor: '#E3F7EE', justifyContent: 'center', maxWidth: 360 },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  wrap: { width: 1040, maxWidth: '100%', flexDirection: 'row', gap: 60, alignItems: 'center', justifyContent: 'center' },
  tile: { width: 90, height: 90, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 40, lineHeight: 55, color: '#FFFFFF' },
  tick: { position: 'absolute', top: 6, right: 7 },
  typed: { backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#0B1220' },
  caretTile: { backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#12A15F' },
  caret: { width: 3, height: 36, borderRadius: 2, backgroundColor: '#087A4A' },
  nextEmpty: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#CDEBDD' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 26, paddingVertical: 22, paddingHorizontal: 24, gap: 18 },
  gameIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: '#E3F7EE', alignItems: 'center', justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendBox: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  // 11 × 36 + 10 × 5 > 422: dizayndagi kabi tugmalar qatorga sig'guncha torayadi.
  key: { width: 36, flexShrink: 1, minWidth: 0, height: 44, borderRadius: 10, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center' },
  keyText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 17, lineHeight: 23, color: '#0B1220' },
  info: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 18 },

  helpBtn: { height: 54, paddingHorizontal: 20, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E2E6EE', flexDirection: 'row', alignItems: 'center', gap: 8 },
  submit: { height: 54, paddingLeft: 26, paddingRight: 22, borderRadius: 17, backgroundColor: '#087A4A', flexDirection: 'row', alignItems: 'center', gap: 10 },
});
