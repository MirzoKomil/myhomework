/**
 * v2 Sirli soʻz (dizayn: 30 · Mystery).
 *
 * Eski resources/games/mystery-word.tsx mantig'i: 5 harfli yashirin so'z
 * (o'quvchi lug'atidan, yetmasa — zaxira), 6 urinish, harf holatlari
 * (o'z joyida / bor, joyi boshqa / yo'q). Dizayn bo'yicha o'z ekran
 * klaviaturasi bor (4 qator: 11+11+11 harf, oxirida Ё va OK); "Maslahat"
 * 10 coin evaziga bitta harfni ochadi. So'zdagi urg'u belgisi o'yinda olib tashlanadi.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackspaceIcon, BulbIcon, CheckIcon } from '@/components/v2/practice/icons';
import { GameHeader, displayRu, reset } from '@/components/v2/practice/shared';
import { GameResult } from '@/components/v2/practice/GameResult';
import { fonts } from '@/constants/v2/tokens';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';
import { DMystery } from '@/components/v2/desktop/practice/DMystery';
// O'yin mantig'i (baholash, urinishlar, klaviatura) — telefon va kompyuter uchun bitta hook'da.
import { HINT_PRICE, LEN, MAX_TRIES, ST_LABEL, useMysteryGame, type St } from '@/components/v2/desktop/practice/useMysteryGame';

// Dizayndagi tartib: har qatorda 11 ta katak, 3-qator oxirida "O'chirish",
// alohida pastki qatorda Ё (1 katak) va OK (10 katak).
const KB_RU = [
  ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х'],
  ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'],
  ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'ъ', 'б', 'ю'],
];
const KB_EN = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const ST_BG: Record<St, string> = { correct: '#087A4A', present: '#8A5F00', absent: '#5B6478' };

export default function MysteryScreen() {
  return useIsDesktop() ? <DMystery /> : <MysteryMobile />;
}

function MysteryMobile() {
  const insets = useSafeAreaInsets();
  const { isRu, lesson, answer, guesses, cur, hints, msg, over, keyState, type, back, submit, hint, restart, attempt } = useMysteryGame();

  const rows = Array.from({ length: MAX_TRIES }, (_, i) => i);
  const kb = isRu ? KB_RU : KB_EN;

  return (
    <View style={styles.screen}>
      <View style={styles.column}>
        <GameHeader
          overline={`Bugungi soʻz · ${LEN} harf`}
          overlineColor="#075E3A"
          title="Sirli soʻz"
          right={<View style={styles.pill}><Text style={styles.pillText}>{attempt}-urinish / {MAX_TRIES}</Text></View>}
        />

        <View accessibilityLabel="Urinishlar" style={styles.board}>
          {rows.map((ri) => {
            const g = guesses[ri];
            const isCur = ri === guesses.length && !over;
            return (
              <View key={ri} style={styles.row}>
                {Array.from({ length: LEN }, (_, ci) => {
                  if (g) {
                    const s = g.st[ci];
                    return (
                      <View
                        key={ci}
                        accessibilityLabel={`${g.word[ci].toUpperCase()} — ${ST_LABEL[s]}`}
                        style={[styles.tile, { backgroundColor: ST_BG[s] }, s === 'present' && styles.present]}
                      >
                        <Text style={[styles.tileText, s === 'absent' && { color: '#E4E8F0' }]}>{g.word[ci].toUpperCase()}</Text>
                        {s === 'correct' && <View style={styles.tick}><CheckIcon size={12} /></View>}
                      </View>
                    );
                  }
                  if (isCur) {
                    const ch = cur[ci];
                    if (ch) {
                      return (
                        <View key={ci} style={[styles.tile, styles.typed]}>
                          <Text style={[styles.tileText, { color: '#0B1220' }]}>{ch.toUpperCase()}</Text>
                        </View>
                      );
                    }
                    if (ci === cur.length) {
                      return (
                        <View key={ci} accessibilityLabel="Keyingi harf" style={[styles.tile, styles.caretTile]}>
                          {hints[ci] ? <Text style={[styles.tileText, styles.hintText]}>{hints[ci].toUpperCase()}</Text> : <View style={styles.caret} />}
                        </View>
                      );
                    }
                    return (
                      <View key={ci} style={[styles.tile, styles.nextEmpty]}>
                        {!!hints[ci] && <Text style={[styles.tileText, styles.hintText]}>{hints[ci].toUpperCase()}</Text>}
                      </View>
                    );
                  }
                  return <View key={ci} style={[styles.tile, { backgroundColor: '#CDEFDD' }]} />;
                })}
              </View>
            );
          })}
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, { backgroundColor: '#087A4A', alignItems: 'center', justifyContent: 'center' }]}><CheckIcon size={10} strokeWidth={4} /></View>
            <Text style={styles.legendText}>oʻz joyida</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, { backgroundColor: '#8A5F00', borderWidth: 2, borderStyle: 'dashed', borderColor: '#FFE7A6' }]} />
            <Text style={styles.legendText}>bor, joyi boshqa</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, { backgroundColor: '#5B6478' }]} />
            <Text style={styles.legendText}>yoʻq</Text>
          </View>
        </View>

        <View style={styles.actions}>
          {over ? (
            <Pressable accessibilityRole="button" onPress={restart} style={styles.hintBtn}>
              <Text style={styles.hintBtnText}>{over === 'won' ? 'Topdingiz! Yana' : `Javob: ${answer.toUpperCase()} · Yana`}</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" onPress={hint} style={styles.hintBtn}>
              <BulbIcon />
              <Text style={styles.hintBtnText}>Maslahat · −{HINT_PRICE} coin</Text>
            </Pressable>
          )}
          <View style={styles.topic}>
            <Text style={styles.topicText} numberOfLines={1}>{msg ?? `Mavzu: ${lesson?.name ?? '—'}`}</Text>
          </View>
        </View>

        <View accessibilityLabel={isRu ? 'Kirill klaviaturasi' : 'Klaviatura'} style={[styles.kb, { paddingBottom: Math.max(insets.bottom, 30) }]}>
          {kb.map((row, ri) => (
            <View key={ri} style={styles.kbRow}>
              {row.map((l) => {
                const st = keyState[l];
                return (
                  <Pressable
                    key={l}
                    accessibilityRole="button"
                    accessibilityLabel={l}
                    onPress={() => type(l)}
                    style={[styles.key, st && { backgroundColor: ST_BG[st] }, st === 'present' && styles.keyPresent]}
                  >
                    <Text style={[styles.keyText, st && { color: '#FFFFFF' }]}>{l.toUpperCase()}</Text>
                  </Pressable>
                );
              })}
              {ri === kb.length - 1 && (
                <Pressable accessibilityRole="button" accessibilityLabel="Oʻchirish" onPress={back} style={styles.key}>
                  <BackspaceIcon />
                </Pressable>
              )}
            </View>
          ))}
          <View style={styles.kbRow}>
            {isRu && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="ё"
                onPress={() => type('ё')}
                style={[styles.key, styles.lastKey, { flex: 1 }, keyState['ё'] && { backgroundColor: ST_BG[keyState['ё']] }, keyState['ё'] === 'present' && styles.keyPresent]}
              >
                <Text style={[styles.keyText, keyState['ё'] && { color: '#FFFFFF' }]}>Ё</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Javobni tekshirish"
              onPress={submit}
              style={[styles.key, styles.lastKey, { flex: 10, borderRadius: 9, backgroundColor: '#087A4A' }]}
            >
              <Text style={[styles.keyText, { fontSize: 13, color: '#FFFFFF' }]}>OK</Text>
            </Pressable>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#E3F7EE' },
  column: { flex: 1, maxWidth: 480, alignSelf: 'center', width: '100%' },
  pill: { height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  pillText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#075E3A', ...reset },

  board: { paddingTop: 16, paddingHorizontal: 40, gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  tile: { flex: 1, height: 57, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: displayRu, fontSize: 26, color: '#FFFFFF', ...reset },
  present: { borderWidth: 2.5, borderStyle: 'dashed', borderColor: '#FFE7A6' },
  tick: { position: 'absolute', top: 4, right: 4 },
  typed: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#0B1220' },
  caretTile: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#0FA968' },
  caret: { width: 2, height: 26, backgroundColor: '#087A4A' },
  nextEmpty: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#CDEFDD' },
  hintText: { color: '#9AA4BC' },

  legend: { paddingTop: 14, paddingHorizontal: 20, flexDirection: 'row', gap: 12, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendBox: { width: 16, height: 16, borderRadius: 4 },
  legendText: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#26304A', ...reset },

  actions: { paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', gap: 8 },
  hintBtn: { flex: 1, flexBasis: 0, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  hintBtnText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#0B1220', ...reset },
  topic: { flex: 1, flexBasis: 0, minWidth: 0, height: 44, borderRadius: 14, backgroundColor: '#CDEFDD', alignItems: 'center', justifyContent: 'center' },
  topicText: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: '#075E3A', ...reset },

  kb: { marginTop: 'auto', paddingHorizontal: 4, gap: 6 },
  kbRow: { flexDirection: 'row', gap: 2 },
  key: { flex: 1, height: 46, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  keyPresent: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#FFE7A6' },
  lastKey: { height: 48 },
  keyText: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#0B1220', ...reset },
});
