/**
 * v2 Soʻnggi harf (dizayn: 27 · WordChain).
 *
 * Mantiq eski resources/games/word-chain.tsx'dan: so'z banki = o'quvchi
 * ochgan darslar lug'ati + tilning eng ko'p ishlatiladigan so'zlari.
 * Dizayndagi navbat taymeri (15 s), "Maslahat" (−10 coin — mos so'zni yozib
 * beradi) va "Oʻtkazib yuborish" (navbatni so'z bilan to'ldirib, ballsiz
 * o'tadi) qo'shildi. Joriy dars so'zi ×2 ball beradi.
 */
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BulbIcon, InfoIcon, LockIcon, StopwatchIcon } from '@/components/v2/practice/icons';
import { GameHeader, displayRu, plainWord, reset, stressLetters } from '@/components/v2/practice/shared';
import { designImages } from '@/constants/v2/designImages';
import { GameResult } from '@/components/v2/practice/GameResult';
import { fonts } from '@/constants/v2/tokens';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';
import { DWordChain } from '@/components/v2/desktop/practice/DWordChain';
// O'yin mantig'i (qoidalar, ball, taymer) — telefon va kompyuter uchun bitta hook'da.
import { chainLetterIndex, HINT_PRICE, TURN_SECONDS, useWordChainGame } from '@/components/v2/desktop/practice/useWordChainGame';

export default function WordChainScreen() {
  return useIsDesktop() ? <DWordChain /> : <WordChainMobile />;
}

function WordChainMobile() {
  const insets = useSafeAreaInsets();
  const {
    isRu,
    lesson,
    translations,
    display,
    chain,
    input,
    setInput,
    error,
    setError,
    score,
    timeLeft,
    finished,
    scrollRef,
    lessonDisplay,
    letter,
    bolts,
    recordBefore,
    submit,
    useHelp,
    skip,
    restart,
    record,
  } = useWordChainGame();

  return (
    <View style={styles.screen}>
      <View style={styles.column}>
        <GameHeader
          overline="Soʻz oʻyini"
          overlineColor="#1E3FD1"
          title="Soʻnggi harf"
          right={
            <View style={styles.scoreBox}>
              <Text style={styles.scoreNum}>{score}</Text>
              <Text style={styles.scoreLabel}>{`soʻz\nrekord ${record}`}</Text>
            </View>
          }
        />

        <View style={styles.timerRow}>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={`${timeLeft} soniya qoldi`}
            style={styles.track}
          >
            <View style={[styles.fill, { width: `${(timeLeft / TURN_SECONDS) * 100}%` }]} />
          </View>
          <View style={styles.timePill}>
            <StopwatchIcon />
            <Text style={styles.timeText}>{timeLeft} s</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.rule}>
            Yangi soʻz oldingi soʻzning <Text style={styles.ruleBold}>oxirgi harfi</Text> bilan boshlanadi
          </Text>

          <ScrollView ref={scrollRef} style={styles.chainScroll} contentContainerStyle={styles.chain} accessibilityLabel="Zanjir">
            {chain.map((w, i) => {
              const li = chainLetterIndex(w, isRu);
              // Harflar urg'u bilan (agar kontentda bo'lsa) — indekslar urg'usiz so'z bilan bir xil.
              const d = display[w];
              const ls = d && plainWord(d) === w ? stressLetters(d) : Array.from(w);
              return (
                <View key={`${w}-${i}`} style={styles.link}>
                  <Text style={styles.linkWord}>
                    {i > 0 ? <Text style={styles.blue}>{ls[0]}</Text> : ls[0]}
                    {ls.slice(1, li).join('')}
                    {li > 0 && <Text style={[styles.blue, styles.underline]}>{ls[li]}</Text>}
                    {ls.slice(li + 1).join('')}
                  </Text>
                  <Text style={styles.linkTr} numberOfLines={1}>{translations[w] ?? ''}</Text>
                </View>
              );
            })}
          </ScrollView>

          {finished ? (
            <View style={styles.resultBox}>
              <Text style={styles.resultTitle}>Vaqt tugadi · {score} soʻz</Text>
              <Text style={styles.resultSub}>Rekord: {record}</Text>
            </View>
          ) : (
            <View style={styles.inputWrap}>
              <View accessibilityLabel={`Birinchi harf: ${letter} (qulflangan)`} style={styles.lockChip}>
                <Text style={styles.lockLetter}>{letter}</Text>
                <LockIcon />
              </View>
              <TextInput
                accessibilityLabel="Soʻzning davomi"
                value={input}
                onChangeText={(t) => { setInput(t.replace(/\s/g, '')); setError(null); }}
                onSubmitEditing={submit}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={Platform.OS === 'web'}
                style={styles.input}
              />
            </View>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}

          {!finished && (
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" onPress={useHelp} style={styles.helpBtn}>
                <BulbIcon />
                <Text style={styles.helpText}>Maslahat · −{HINT_PRICE} coin</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={skip} style={styles.skipBtn}>
                <Text style={styles.skipText}>Oʻtkazib yuborish</Text>
              </Pressable>
            </View>
          )}

          {isRu && (
            <View style={styles.note}>
              <View style={{ marginTop: 1 }}>
                <InfoIcon />
              </View>
              <Text style={styles.noteText}>
                Soʻz <Text style={styles.noteBold}>ь</Text>, <Text style={styles.noteBold}>ъ</Text> yoki{' '}
                <Text style={styles.noteBold}>ы</Text> bilan tugasa — undan oldingi harfdan boshlang.
              </Text>
            </View>
          )}

          <View style={styles.bonus}>
            <View style={styles.bonusIcon}>
              <Image source={(designImages as Record<string, ImageSourcePropType>)['fbb02b72ab2658bf66887f19d3df5d58']} style={styles.bonusImg} resizeMode="contain" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.bonusTitle}>{lesson ? `${lesson.number}-dars soʻzi` : 'Dars soʻzi'} = ×2 ball</Text>
              <Text style={styles.bonusSub} numberOfLines={1}>
                {lessonDisplay.length ? `${lessonDisplay.slice(0, 4).join(', ')}${lessonDisplay.length > 4 ? '…' : ''}` : '—'}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 34) }]}>
          <Pressable accessibilityRole="button" onPress={finished ? restart : submit} style={styles.submit}>
            <Text style={styles.submitText}>{finished ? 'Qaytadan boshlash' : 'Yuborish'}</Text>
          </Pressable>
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
        onAgain={restart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#E8EEFF' },
  column: { flex: 1, maxWidth: 480, alignSelf: 'center', width: '100%' },
  scoreBox: { height: 44, paddingHorizontal: 12, borderRadius: 15, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreNum: { fontFamily: fonts.display, fontSize: 22, color: '#0B1220', ...reset },
  scoreLabel: { fontFamily: fonts.bodyHeavy, fontSize: 12, lineHeight: 13.8, color: '#4A5468', ...reset },

  timerRow: { paddingTop: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: '#2F5BFF' },
  timePill: { height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#1E3FD1', fontVariant: ['tabular-nums'], ...reset },

  body: { flex: 1, paddingTop: 18, paddingHorizontal: 20, gap: 10 },
  rule: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 19.6, color: '#26304A', ...reset },
  ruleBold: { fontFamily: fonts.bodyHeavy, color: '#1E3FD1' },
  chainScroll: { flexGrow: 0, flexShrink: 1 },
  chain: { gap: 8 },
  link: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 13, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  linkWord: { fontFamily: fonts.bodyHeavy, fontSize: 22, lineHeight: 30, color: '#0B1220', ...reset },
  blue: { color: '#1E3FD1' },
  underline: { textDecorationLine: 'underline' },
  linkTr: { flexShrink: 1, fontFamily: fonts.body, fontSize: 14, color: '#4A5468', ...reset },

  inputWrap: {
    marginTop: 4,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2F5BFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    boxShadow: '0 0 0 4px rgba(47,91,255,0.15)',
  },
  lockChip: { height: 42, minWidth: 42, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  lockLetter: { fontFamily: displayRu, fontSize: 24, color: '#FFFFFF', ...reset },
  input: { flex: 1, minWidth: 0, height: 44, fontFamily: fonts.bodyHeavy, fontSize: 24, color: '#0B1220', padding: 0, outlineStyle: 'none' } as object,
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#B42318', ...reset },
  resultBox: { marginTop: 4, minHeight: 60, borderRadius: 18, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' },
  resultTitle: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: '#0B1220', ...reset },
  resultSub: { fontFamily: fonts.body, fontSize: 13, color: '#4A5468', ...reset },

  actions: { flexDirection: 'row', gap: 8 },
  helpBtn: { height: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  helpText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#0B1220', ...reset },
  skipBtn: { height: 44, paddingHorizontal: 14, borderRadius: 14, justifyContent: 'center' },
  skipText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#1E3FD1', ...reset },

  note: { backgroundColor: '#D9E2FF', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noteText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18.2, color: '#1E3FD1', ...reset },
  noteBold: { fontFamily: fonts.bodyHeavy },

  bonus: { marginTop: 'auto', backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 10, paddingLeft: 10, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bonusIcon: { width: 52, height: 52, borderRadius: 15, backgroundColor: '#FFF4D1', alignItems: 'center', justifyContent: 'center' },
  bonusImg: { width: 44, height: 44 },
  bonusTitle: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#0B1220', ...reset },
  bonusSub: { fontFamily: fonts.body, fontSize: 13, color: '#4A5468', ...reset },

  footer: { paddingTop: 14, paddingHorizontal: 20 },
  submit: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: '#FFFFFF', ...reset },
});
