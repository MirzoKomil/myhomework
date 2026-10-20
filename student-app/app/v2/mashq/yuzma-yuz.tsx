/**
 * v2 Yuzma-yuz (dizayn: 26 · Battle).
 *
 * Mantiq eski app/(tabs)/battle.tsx'dan aynan: haqiqiy 1v1 navbat
 * (/api/state/battle/join|status|answer|leave|abandon), raqib topilmasa
 * Bot rejimi, raundlar server tomonidan hal qilinadi. Ekran ochilishi
 * bilan raqib qidiriladi ("Raqib topish" Mashq sahifasida bosilgan).
 * Dizaynda faqat o'yin holati bor — qidiruv/natija holatlari shu
 * maketning o'zida (so'z kartasi ichida) ko'rsatiladi.
 */
import * as Speech from 'expo-speech';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoinIcon, SpeakerIcon } from '@/components/v2/practice/icons';
import { GameHeader, goBack, reset } from '@/components/v2/practice/shared';
import { V2_BATTLE_DAILY_COIN_WINS, V2_BATTLE_WIN_COINS } from '@/constants/v2/battle';
import { designImages } from '@/constants/v2/designImages';
import { fonts } from '@/constants/v2/tokens';
import { Confetti } from '@/components/v2/motion';
import { leaveBattleQueue } from '@/services/contentApi';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';
import { DBattle } from '@/components/v2/desktop/practice/DBattle';
// O'yin mantig'i (navbat, raundlar, bot so'rovi) — telefon va kompyuter uchun bitta hook'da.
import { BATTLE_ROUND_SECONDS, QUEUE_WAIT_SECONDS, useBattleGame } from '@/components/v2/desktop/practice/useBattleGame';

const img = (id: string) => (designImages as Record<string, ImageSourcePropType>)[id];
const MY_AVATAR = img('93faebd4826b1da6adaee5d0dcda6209');
const OPP_AVATAR = img('6fbb4a0364e41f76fd238e0c91d0228b');

export default function BattleScreen() {
  return useIsDesktop() ? <DBattle /> : <BattleMobile />;
}

function BattleMobile() {
  const insets = useSafeAreaInsets();
  const {
    speechLang,
    lesson,
    myAvatar,
    student,
    phase,
    opponentName,
    opponentAvatarUrl,
    matchId,
    queueSecondsLeft,
    queueMessage,
    resultNote,
    winPaid,
    round,
    totalRounds,
    playerScore,
    opponentScore,
    timeLeft,
    selectedOption,
    roundWinner,
    history,
    ranks,
    currentWord,
    stopAndLeaveGame,
    giveUpQueue,
    startMatch,
    handleAnswer,
    oppLabel,
    revealed,
    status,
  } = useBattleGame();

  const ringStyle = (c: string) => ({ boxShadow: `0 0 0 3px #16203A, 0 0 0 5px ${c}` }) as object;

  return (
    <View style={styles.screen}>
      <View style={styles.column}>
        <GameHeader
          dark
          overline=""
          overlineColor="#9AA4BC"
          title=""
          onClose={() => { stopAndLeaveGame(); goBack(); }}
          right={<View style={{ width: 44 }} />}
        />
        {/* Sarlavha o'rtada — GameHeader matni bo'sh, shu yerda alohida */}
        <View pointerEvents="none" style={[styles.centerTitle, { top: Math.max(insets.top, 44) + 10 }]}>
          <Text style={styles.roundTitle}>
            {phase === 'playing' ? `Raund ${Math.min(round + 1, totalRounds)} / ${totalRounds}` : phase === 'result' ? 'Oʻyin tugadi' : 'Raqib qidirilmoqda'}
          </Text>
          <Text style={styles.roundSub}>{lesson ? `${lesson.number}-dars soʻzlari` : 'Dars soʻzlari'}</Text>
        </View>

        <View style={styles.scoreCard}>
          <View style={styles.side}>
            <View style={[styles.avatar, ringStyle('#6F8DFF')]}>
              <Image source={myAvatar ? { uri: myAvatar } : MY_AVATAR} accessibilityLabel={`${student?.name?.split(' ')[0] ?? 'Siz'} avatari`} style={[styles.avatar, { backgroundColor: '#E8EEFF' }]} />
            </View>
            <View style={styles.sideText}>
              <Text style={styles.name} numberOfLines={1}>Siz</Text>
              <Text style={styles.rank}>{ranks.me ? `${ranks.me}-oʻrin` : ' '}</Text>
            </View>
          </View>
          <Text accessibilityLabel={`Hisob ${playerScore} ga ${opponentScore}`} style={styles.score}>
            <Text style={{ color: '#8FA8FF' }}>{playerScore}</Text>
            <Text style={{ color: '#8A93A6' }}> : </Text>
            <Text style={{ color: '#FFB38A' }}>{opponentScore}</Text>
          </Text>
          <View style={[styles.side, { justifyContent: 'flex-end' }]}>
            <View style={[styles.sideText, { alignItems: 'flex-end' }]}>
              <Text style={styles.name} numberOfLines={1}>{opponentName || '…'}</Text>
              <Text style={styles.rank}>{ranks.opp ? `${ranks.opp}-oʻrin` : ' '}</Text>
            </View>
            <View style={[styles.avatar, ringStyle('#FF9A52'), !opponentName && { opacity: 0.35 }]}>
              <Image
                source={opponentAvatarUrl ? { uri: opponentAvatarUrl } : OPP_AVATAR}
                accessibilityLabel={`${oppLabel} avatari`}
                style={[styles.avatar, { backgroundColor: '#FFF1E6' }]}
              />
            </View>
          </View>
        </View>

        <View style={styles.timerWrap}>
          <View style={styles.timerRow}>
            <View accessibilityLabel={`${phase === 'matching' ? queueSecondsLeft : timeLeft} soniya qoldi`} style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${phase === 'matching' ? (queueSecondsLeft / QUEUE_WAIT_SECONDS) * 100 : phase === 'playing' ? (timeLeft / BATTLE_ROUND_SECONDS) * 100 : 0}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.timerText}>{phase === 'matching' ? queueSecondsLeft : phase === 'playing' ? timeLeft : 0} s</Text>
          </View>
          <View style={styles.timerMeta}>
            <Text style={styles.meta}>Tez javob = koʻproq ball</Text>
            {!!status && (
              <View style={styles.thinking}>
                <View style={styles.thinkDot} />
                <Text style={[styles.meta, { color: '#FFB38A' }]} numberOfLines={1}>{status}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.main}>
          <View style={styles.wordCard}>
            {phase === 'playing' && currentWord ? (
              <>
                <Text style={styles.prompt}>Tinglang va tarjimasini tanlang</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Soʻzni qayta tinglash"
                  onPress={() => Speech.speak(currentWord.word, { language: speechLang, rate: 0.9 })}
                  style={styles.speak}
                >
                  <SpeakerIcon />
                </Pressable>
                {revealed ? (
                  <Text style={styles.revealWord}>{currentWord.word}</Text>
                ) : (
                  <View style={styles.hiddenRow}>
                    <View style={styles.dashes}>
                      {Array.from({ length: Math.min(Math.max(currentWord.word.length, 3), 6) }, (_, i) => (
                        <View key={i} style={styles.dash} />
                      ))}
                    </View>
                    <Text style={styles.hiddenText}>Soʻz javobdan keyin ochiladi</Text>
                  </View>
                )}
              </>
            ) : phase === 'result' ? (
              <>
                <Text style={styles.resultTitle}>
                  {playerScore > opponentScore ? 'Gʻalaba!' : playerScore === opponentScore ? 'Durrang' : 'Magʻlubiyat'}
                </Text>
                <Text style={styles.hiddenText}>
                  Siz {playerScore} — {opponentScore} {oppLabel}
                  {playerScore > opponentScore && winPaid ? ` · +${V2_BATTLE_WIN_COINS} coin` : ''}
                </Text>
                {playerScore > opponentScore && winPaid === false && (
                  <Text style={styles.hiddenText}>{`Bugungi coinli gʻalabalar tugadi (${V2_BATTLE_DAILY_COIN_WINS}/${V2_BATTLE_DAILY_COIN_WINS})`}</Text>
                )}
                {!!resultNote && <Text style={styles.hiddenText}>{resultNote}</Text>}
                <Pressable accessibilityRole="button" onPress={() => startMatch('random')} style={styles.cta}>
                  <Text style={styles.ctaText}>Yana oʻynash</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.prompt}>{phase === 'matching' ? 'Raqib qidirilmoqda…' : 'Bot bilan oʻynaysizmi?'}</Text>
                <View style={styles.speak}><SpeakerIcon /></View>
                <Text style={[styles.hiddenText, { textAlign: 'center' }]}>
                  {phase === 'matching' ? 'Boshqa oʻquvchi navbatga qoʻshilishi kutilmoqda' : queueMessage}
                </Text>
              </>
            )}
          </View>

          {phase === 'playing' && currentWord ? (
            <View accessibilityLabel="Javob variantlari" style={styles.options}>
              {currentWord.options.map((o) => {
                const isCorrect = o === currentWord.translation;
                const isSel = o === selectedOption;
                const bg = revealed && isCorrect ? '#087A4A' : revealed && isSel ? '#B42318' : isSel ? '#2F5BFF' : '#16203A';
                const bc = revealed && isCorrect ? '#0FA968' : revealed && isSel ? '#D92D20' : isSel ? '#6F8DFF' : '#26304A';
                return (
                  <Pressable
                    key={o}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSel }}
                    disabled={revealed || (!!matchId && selectedOption !== null)}
                    onPress={() => handleAnswer(o)}
                    style={[styles.option, { backgroundColor: bg, borderColor: bc }]}
                  >
                    <Text style={styles.optionText} numberOfLines={2}>{o}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : phase === 'matching' ? (
            <View style={styles.options}>
              <Pressable accessibilityRole="button" onPress={giveUpQueue} style={styles.option}>
                <Text style={styles.optionText}>Bekor qilish</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => { leaveBattleQueue().catch(() => {}); startMatch('bot'); }} style={styles.option}>
                <Text style={styles.optionText}>Bot bilan</Text>
              </Pressable>
            </View>
          ) : phase === 'notFound' ? (
            <View style={styles.options}>
              <Pressable accessibilityRole="button" onPress={() => startMatch('random')} style={styles.option}>
                <Text style={styles.optionText}>Yana qidirish</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => startMatch('bot')} style={[styles.option, { backgroundColor: '#2F5BFF', borderColor: '#6F8DFF' }]}>
                <Text style={styles.optionText}>Bot bilan oʻynash</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.rounds}>
          <View style={styles.roundsHead}>
            <Text style={styles.roundsLabel}>Raundlar</Text>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { borderRadius: 2, backgroundColor: '#2F5BFF' }]} />
                <Text style={styles.legendText}>Siz</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { borderRadius: 4, backgroundColor: '#FF7A1A' }]} />
                <Text style={styles.legendText} numberOfLines={1}>{oppLabel}</Text>
              </View>
            </View>
          </View>
          <View style={styles.bars}>
            {Array.from({ length: totalRounds }, (_, i) => {
              const w = history[i];
              const bg = w === 'player' ? '#2F5BFF' : w === 'opponent' ? '#FF7A1A' : w === 'draw' ? '#8A93A6' : phase === 'playing' && i === round ? '#FFFFFF' : '#26304A';
              return <View key={i} style={[styles.bar, { backgroundColor: bg, borderRadius: w === 'player' ? 2 : 4 }]} />;
            })}
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 34) }]}>
          <Text style={styles.footerText}>Gʻolib</Text>
          <View style={styles.coin}>
            <CoinIcon />
            <Text style={styles.coinText}>{V2_BATTLE_WIN_COINS} coin</Text>
          </View>
          <Text style={styles.footerText}>oladi</Text>
        </View>
      </View>
      {phase === 'result' && playerScore > opponentScore && <Confetti count={34} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1220' },
  column: { flex: 1, maxWidth: 480, alignSelf: 'center', width: '100%' },
  centerTitle: { position: 'absolute', left: 76, right: 76, height: 44, alignItems: 'center', justifyContent: 'center' },
  roundTitle: { fontFamily: fonts.bodyHeavy, fontSize: 14, lineHeight: 19, letterSpacing: 0.84, textTransform: 'uppercase', color: '#FFFFFF', ...reset },
  roundSub: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: '#9AA4BC', ...reset },

  scoreCard: { marginTop: 18, marginHorizontal: 20, padding: 14, borderRadius: 22, backgroundColor: '#16203A', flexDirection: 'row', alignItems: 'center', gap: 8 },
  side: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sideText: { minWidth: 0, flexShrink: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  name: { fontFamily: fonts.bodyHeavy, fontSize: 14, lineHeight: 19, color: '#FFFFFF', ...reset },
  rank: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: '#9AA4BC', ...reset },
  score: { fontFamily: fonts.display, fontSize: 34, letterSpacing: -0.68, fontVariant: ['tabular-nums'], ...reset },

  timerWrap: { paddingTop: 18, paddingHorizontal: 20 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#1B2438', overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: '#FFC93C' },
  timerText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#FFC93C', fontVariant: ['tabular-nums'], ...reset },
  timerMeta: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  meta: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: '#9AA4BC', ...reset },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  thinkDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF9A52' },

  main: { paddingTop: 18, paddingHorizontal: 20, gap: 14 },
  wordCard: { backgroundColor: '#16203A', borderRadius: 28, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 18 },
  prompt: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#FFFFFF', textAlign: 'center', ...reset },
  speak: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 10px #1E2A4A' } as object,
  hiddenRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dashes: { flexDirection: 'row', gap: 4 },
  dash: { width: 18, height: 6, borderRadius: 3, backgroundColor: '#26304A' },
  hiddenText: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18, color: '#9AA4BC', ...reset },
  revealWord: { fontFamily: fonts.bodyHeavy, fontSize: 20, lineHeight: 18, color: '#FFFFFF', ...reset },
  resultTitle: { fontFamily: fonts.display, fontSize: 28, color: '#FFFFFF', ...reset },
  cta: { height: 44, paddingHorizontal: 20, borderRadius: 14, backgroundColor: '#2F5BFF', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#FFFFFF', ...reset },

  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: {
    flexBasis: '47%',
    flexGrow: 1,
    height: 100,
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: '#26304A',
    backgroundColor: '#16203A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  optionText: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: '#FFFFFF', textAlign: 'center', ...reset },

  rounds: { marginTop: 'auto', marginHorizontal: 20, backgroundColor: '#16203A', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  roundsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roundsLabel: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase', color: '#9AA4BC', ...reset },
  legend: { flexDirection: 'row', gap: 10, flexShrink: 1 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  legendBox: { width: 8, height: 8 },
  legendText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: '#9AA4BC', ...reset },
  bars: { flexDirection: 'row', gap: 5 },
  bar: { flex: 1, height: 8 },

  footer: { paddingTop: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerText: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#9AA4BC', ...reset },
  coin: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coinText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#FFC93C', ...reset },
});
