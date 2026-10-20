/**
 * Kompyuter: Soʻnggi harf (dizayn: D_WordChain).
 *
 * Mantiq telefon bilan bitta (useWordChainGame): so'z banki, 15 s navbat,
 * ×2 ball, Maslahat (−10 coin), O'tkazib yuborish, rekord, GameResult.
 * Zanjirdan oxirgi 4 ta so'z ko'rsatiladi (dizayndagi 4 karta).
 * Klaviatura: yozish — davomi, Enter — yuborish (tugagach — qaytadan), Esc — chiqish.
 */
import { useEffect, useRef } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';

import { FocusFrame } from '@/components/v2/desktop/Shell';
import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { GameResult } from '@/components/v2/practice/GameResult';
import { plainWord, stressLetters } from '@/components/v2/practice/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';

import { H, IArrow, IBulb, IInfo, ILock, IStopwatch, K, T, useAvail, web } from './ui';
import { chainLetterIndex, HINT_PRICE, TURN_SECONDS, useWordChainGame } from './useWordChainGame';

const img = (id: string) => (designImages as Record<string, ImageSourcePropType>)[id];
const SHOWN = 4;
// 1100 − 3 × (22 o'q + 2 × 10 oraliq) = 974 → 4 karta.
const CARD_W = (1100 - 3 * 42) / 4;

export function DWordChain() {
  const g = useWordChainGame();
  const { isRu, lesson, translations, display, chain, input, setInput, error, setError, score, timeLeft, finished, lessonDisplay, letter, bolts, recordBefore, record } = g;
  const inputRef = useRef<TextInput>(null);

  // Yangi so'zdan keyin yozish maydoni yana faol bo'lsin (klaviatura bilan o'ynash uchun).
  useEffect(() => {
    if (!finished) inputRef.current?.focus();
  }, [chain.length, finished]);

  useDesktopKeys({ Enter: () => (finished ? g.restart() : g.submit()) });

  const shown = chain.slice(-SHOWN);
  const offset = chain.length - shown.length;
  const n = lesson?.number;

  const center = (
    <View accessibilityRole="timer" accessibilityLabel={`${timeLeft} soniya qoldi`} style={{ width: 440, gap: 7 }}>
      <View style={s.between}>
        <T w={800} size={13} color="#34405A" lh={18}>
          Javob uchun vaqt
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <IStopwatch />
          <T w={800} size={13} color="#1E3FD1" lh={18}>
            {timeLeft} s
          </T>
        </View>
      </View>
      <View style={s.track}>
        <View style={[s.fill, { width: `${(timeLeft / TURN_SECONDS) * 100}%` }]} />
      </View>
    </View>
  );

  const right = (
    <View style={s.scorePill}>
      <T w={800} size={24} lh={33}>
        {score}
      </T>
      <View>
        <T w={800} size={13} color="#34405A" lh={15}>
          soʻz
        </T>
        <T w={800} size={13} color="#34405A" lh={15}>
          rekord {record}
        </T>
      </View>
    </View>
  );

  // Tor oynada pastki panel tugmalari chetga yopishmasin (32px chekka).
  const footPad = useAvail(1100) < 1100 ? 32 : 0;
  const footer = (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: footPad }}>
      {!finished && (
        <>
          <Pressable accessibilityRole="button" onPress={g.useHelp} style={s.helpBtn}>
            <IBulb />
            <T w={800} size={15} lh={20}>
              Maslahat · −{HINT_PRICE} coin
            </T>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={g.skip} style={s.skipBtn}>
            <T w={800} size={15} color="#1E3FD1" lh={20}>
              Oʻtkazib yuborish
            </T>
          </Pressable>
        </>
      )}
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={finished ? 'Qaytadan boshlash (Enter)' : 'Yuborish (Enter)'}
        aria-keyshortcuts="Enter"
        onPress={finished ? g.restart : g.submit}
        style={[s.submit, web({ boxShadow: '0 5px 0 #1E3FD1' })]}
      >
        <T w={800} size={16} color="#FFFFFF" lh={22}>
          {finished ? 'Qaytadan boshlash' : 'Yuborish'}
        </T>
        <IArrow />
        <K tone="blue">Enter</K>
      </Pressable>
    </View>
  );

  return (
    <FocusFrame
      closeTo={R.practice}
      title="Soʻnggi harf"
      subtitle={`Soʻz oʻyini · ${n ? `${n}-dars soʻzlari` : 'Dars soʻzlari'}`}
      center={center}
      right={right}
      bg="#EAF0FF"
      footer={footer}
      footerHeight={100}
      footerWidth={1100}
    >
      <View style={s.body}>
        <View style={s.col}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <View style={s.gameIcon}>
              <Image source={img('557efc668fa6b22df51bb9270eeb827b')} style={{ width: 72, height: 72 }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <H size={30} lh={36}>
                Zanjirni davom ettiring
              </H>
              <T w={700} size={17} color="#34405A" lh={23}>
                Yangi soʻz oldingi soʻzning <Text style={{ fontFamily: fonts.bodyHeavy, color: '#1E3FD1' }}>oxirgi harfi</Text> bilan boshlanadi
              </T>
            </View>
            <T w={800} size={14} color="#4A5468" lh={19} style={{ alignSelf: 'flex-end' }}>
              Zanjir · {chain.length} soʻz
            </T>
          </View>

          <View accessibilityLabel="Zanjir" style={{ flexDirection: 'row', alignItems: 'stretch', gap: 10 }}>
            {shown.map((w, j) => {
              const i = offset + j;
              const li = chainLetterIndex(w, isRu);
              // Harflar urg'u bilan (agar kontentda bo'lsa) — indekslar urg'usiz so'z bilan bir xil.
              const d = display[w];
              const ls = d && plainWord(d) === w ? stressLetters(d) : Array.from(w);
              return (
                <View key={`${w}-${i}`} style={{ flexDirection: 'row', gap: 10, flexShrink: 1, minWidth: 0 }}>
                  {j > 0 && (
                    <View style={{ justifyContent: 'center' }}>
                      <IArrow size={22} color="#5B6478" sw={2.4} />
                    </View>
                  )}
                  <View style={s.link}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      {ls.map((ch, k) => {
                        const blue = (k === 0 && i > 0) || (k === li && li > 0);
                        const text = <Text style={[s.linkWord, blue && { color: '#1E3FD1' }]}>{ch}</Text>;
                        return k === li && li > 0 ? (
                          <View key={k} style={s.underline}>
                            {text}
                          </View>
                        ) : (
                          <View key={k}>{text}</View>
                        );
                      })}
                    </View>
                    <T w={600} size={16} color="#4A5468" lh={22} lines={1}>
                      {translations[w] ?? ''}
                    </T>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={[s.inputBox, web({ boxShadow: '0 0 0 6px #D4DEFF' })]}>
            <View accessibilityLabel={`Birinchi harf: ${letter} (qulflangan)`} style={s.lockChip}>
              <Text style={s.lockLetter}>{letter}</Text>
              <ILock />
            </View>
            {finished ? (
              <View style={{ flex: 1, gap: 2 }}>
                <T w={800} size={26} lh={34}>
                  Vaqt tugadi · {score} soʻz
                </T>
                <T w={600} size={16} color="#4A5468" lh={22}>
                  Rekord: {record}
                </T>
              </View>
            ) : (
              <TextInput
                ref={inputRef}
                accessibilityLabel="Soʻzning davomi"
                value={input}
                onChangeText={(t) => {
                  setInput(t.replace(/\s/g, ''));
                  setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={Platform.OS === 'web'}
                style={s.input}
              />
            )}
            {error ? (
              <T w={700} size={14} color="#B42318" lh={19} style={{ flexShrink: 1, maxWidth: 360, textAlign: 'right' }}>
                {error}
              </T>
            ) : (
              !finished && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T w={700} size={14} color="#4A5468" lh={19}>
                    Klaviaturada yozing ·
                  </T>
                  <K>Enter</K>
                  <T w={700} size={14} color="#4A5468" lh={19}>
                    yuborish
                  </T>
                </View>
              )
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 16 }}>
            {isRu && (
              <View style={s.note}>
                <IInfo />
                <T w={700} size={15} color="#1E3FD1" lh={21} style={{ flex: 1 }}>
                  Soʻz <Text style={s.b}>ь</Text>, <Text style={s.b}>ъ</Text> yoki <Text style={s.b}>ы</Text> bilan tugasa — undan oldingi harfdan boshlang.
                </T>
              </View>
            )}
            <View style={s.bonus}>
              <View style={s.bonusIcon}>
                <Image source={img('fbb02b72ab2658bf66887f19d3df5d58')} style={{ width: 54, height: 54 }} resizeMode="contain" />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <T w={800} size={17} lh={23}>
                  {n ? `${n}-dars soʻzi` : 'Dars soʻzi'} = ×2 ball
                </T>
                <T w={600} size={15} color="#4A5468" lh={20} lines={1}>
                  {lessonDisplay.length ? `${lessonDisplay.slice(0, 4).join(', ')}${lessonDisplay.length > 4 ? ' …' : ''}` : '—'}
                </T>
              </View>
            </View>
          </View>
        </View>
      </View>
      <GameResult
        show={finished}
        win={score > 0}
        title={score > 0 ? 'Vaqt tugadi — zoʻr!' : 'Vaqt tugadi'}
        subtitle={score > 0 ? `Zanjirga ${score} ta soʻz qoʻshdingiz` : 'Keyingi safar albatta chiqadi'}
        stats={[
          { value: String(score), label: 'soʻz' },
          { value: String(record), label: 'rekord' },
        ]}
        coins={score}
        lightning={bolts}
        newRecord={score > 0 && score > recordBefore}
        onAgain={g.restart}
      />
    </FocusFrame>
  );
}

const s = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#E2E6EE', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#2F5BFF' },
  scorePill: { height: 46, paddingHorizontal: 16, borderRadius: 15, backgroundColor: '#E8EEFF', flexDirection: 'row', alignItems: 'center', gap: 10 },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 32 },
  col: { width: 1100, maxWidth: '100%', gap: 30 },
  gameIcon: { width: 84, height: 84, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },

  link: { width: CARD_W, flexShrink: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 22, paddingTop: 32, paddingHorizontal: 26, paddingBottom: 30, gap: 10 },
  linkWord: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 40, lineHeight: 44, color: '#0B1220' },
  underline: { borderBottomWidth: 3, borderBottomColor: '#2F5BFF' },

  inputBox: {
    height: 140,
    paddingLeft: 28,
    paddingRight: 26,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#2F5BFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  lockChip: { width: 84, height: 84, borderRadius: 22, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  lockLetter: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 44, lineHeight: 60, color: '#FFFFFF' },
  input: { flex: 1, minWidth: 0, height: 72, fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 52, color: '#0B1220', padding: 0, outlineStyle: 'none' } as object,

  note: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 22, borderRadius: 20, backgroundColor: '#DCE5FF' },
  b: { fontFamily: fonts.bodyHeavy },
  bonus: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, paddingLeft: 14, paddingRight: 18, borderRadius: 20, backgroundColor: '#FFFFFF' },
  bonusIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: '#FFF4D1', alignItems: 'center', justifyContent: 'center' },

  helpBtn: { height: 54, paddingHorizontal: 20, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E2E6EE', flexDirection: 'row', alignItems: 'center', gap: 8 },
  skipBtn: { height: 54, paddingHorizontal: 16, borderRadius: 17, justifyContent: 'center' },
  submit: { height: 54, paddingLeft: 26, paddingRight: 22, borderRadius: 17, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', gap: 10 },
});
