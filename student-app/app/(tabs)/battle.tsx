import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/ui/CoinIcon';
import { CoinInfoModal } from '@/components/ui/CoinInfoModal';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import {
  BATTLE_ROUNDS,
  BATTLE_ROUND_SECONDS,
  BATTLE_WIN_COINS,
  BattleOpponentType,
  BattleWord,
  battleWords,
} from '@/data/mock';
import { addCoins, useCoins } from '@/services/coinsStore';

const RANDOM_NAMES = ['Aziz', 'Malika', 'Diyor', 'Kamola', 'Sardor', 'Nilufar', 'Javlon', 'Zarina'];
const RANDOM_AVATARS = ['🧑', '👩', '🧑‍🦱', '👨‍🦰'];
const OPTION_COLORS = ['#4F8CFF', '#F472B6', '#FBBF24', '#34D399'];

type Phase = 'select' | 'matching' | 'playing' | 'result';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function BattleScreen() {
  const coins = useCoins();
  const [showCoinInfo, setShowCoinInfo] = useState(false);
  const [phase, setPhase] = useState<Phase>('select');
  const [opponentType, setOpponentType] = useState<BattleOpponentType | null>(null);
  const [opponentName, setOpponentName] = useState('Bot');
  const [opponentAvatar, setOpponentAvatar] = useState('🤖');
  const [round, setRound] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [roundWords, setRoundWords] = useState<BattleWord[]>([]);
  const [timeLeft, setTimeLeft] = useState(BATTLE_ROUND_SECONDS);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [roundWinner, setRoundWinner] = useState<'player' | 'opponent' | null>(null);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const botTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextRoundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundLockedRef = useRef(false);

  const currentWord = roundWords[round];

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
      if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
      Speech.stop();
    };
  }, []);

  const startMatch = (type: BattleOpponentType) => {
    setOpponentType(type);
    if (type === 'random') {
      setOpponentName(RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]);
      setOpponentAvatar(RANDOM_AVATARS[Math.floor(Math.random() * RANDOM_AVATARS.length)]);
    } else {
      setOpponentName('Bot');
      setOpponentAvatar('🤖');
    }
    setPhase('matching');
    setTimeout(() => {
      setRoundWords(shuffle(battleWords).slice(0, BATTLE_ROUNDS));
      setRound(0);
      setPlayerScore(0);
      setOpponentScore(0);
      setRoundWinner(null);
      setPhase('playing');
    }, 1600);
  };

  // Round lifecycle: speak the word, start the countdown, schedule the bot's answer.
  useEffect(() => {
    if (phase !== 'playing' || !currentWord) return;
    roundLockedRef.current = false;
    setSelectedOption(null);
    setRoundWinner(null);
    setTimeLeft(BATTLE_ROUND_SECONDS);

    Speech.speak(currentWord.word, { language: 'en-US', rate: 0.9 });

    tickRef.current = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);

    const botDelay = (2 + Math.random() * (BATTLE_ROUND_SECONDS - 2.5)) * 1000;
    botTimeoutRef.current = setTimeout(() => {
      if (roundLockedRef.current) return;
      roundLockedRef.current = true;
      if (tickRef.current) clearInterval(tickRef.current);
      setOpponentScore((s) => s + 1);
      setRoundWinner('opponent');
    }, botDelay);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    };
  }, [phase, round]);

  // Once a round resolves, pause briefly to show feedback, then advance.
  useEffect(() => {
    if (phase !== 'playing' || roundWinner === null) return;
    nextRoundTimeoutRef.current = setTimeout(() => {
      if (round + 1 >= BATTLE_ROUNDS) {
        setPhase('result');
      } else {
        setRound((r) => r + 1);
      }
    }, 1400);
    return () => {
      if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
    };
  }, [roundWinner]);

  // G'alaba qozonilganda bonus coinlarni bir marta hisoblash.
  useEffect(() => {
    if (phase === 'result' && playerScore > opponentScore) {
      addCoins(BATTLE_WIN_COINS);
    }
  }, [phase]);

  const handleAnswer = (option: string) => {
    if (roundLockedRef.current || phase !== 'playing') return;
    roundLockedRef.current = true;
    if (tickRef.current) clearInterval(tickRef.current);
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    setSelectedOption(option);
    if (option === currentWord.translation) {
      setPlayerScore((s) => s + 1);
      setRoundWinner('player');
      addCoins(1);
    } else {
      setOpponentScore((s) => s + 1);
      setRoundWinner('opponent');
    }
  };

  const resetGame = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
    setPhase('select');
    setOpponentType(null);
    setRoundWinner(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Speaking Battle" showBack />

      {phase === 'select' && (
        <View style={styles.selectWrap}>
          <Pressable style={styles.coinRow} onPress={() => setShowCoinInfo(true)}>
            <CoinIcon size={18} />
            <Text style={styles.coinText}>{coins}</Text>
          </Pressable>
          <Text style={styles.selectTitle}>Kim bilan o'ynaysiz?</Text>
          <Text style={styles.selectSubtitle}>
            So'zni tinglang va to'g'ri tarjimasini birinchi bo'lib toping — g'olib coin yutadi!
          </Text>

          <Pressable style={styles.modeCardWrap} onPress={() => startMatch('random')}>
            <LinearGradient colors={['#6FA8FF', '#4F8CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modeCard}>
              <Text style={styles.modeIcon}>🧑‍🤝‍🧑</Text>
              <Text style={styles.modeTitle}>Tasodifiy o'yinchi</Text>
              <Text style={styles.modeSubtitle}>Boshqa o'quvchi bilan bellashing</Text>
            </LinearGradient>
          </Pressable>

          <Pressable style={styles.modeCardWrap} onPress={() => startMatch('bot')}>
            <LinearGradient colors={['#9B7BFF', '#6B4FE0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modeCard}>
              <Text style={styles.modeIcon}>🤖</Text>
              <Text style={styles.modeTitle}>Bot bilan</Text>
              <Text style={styles.modeSubtitle}>Mashq qilish uchun qulay rejim</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}

      {phase === 'matching' && (
        <View style={styles.matchingWrap}>
          <View style={styles.matchAvatars}>
            <Text style={styles.matchAvatarEmoji}>🙂</Text>
            <Text style={styles.matchVs}>VS</Text>
            <Text style={styles.matchAvatarEmoji}>{opponentAvatar}</Text>
          </View>
          <Text style={styles.matchingText}>Qidirilmoqda...</Text>
        </View>
      )}

      {phase === 'playing' && currentWord && (
        <View style={styles.playWrap}>
          <View style={styles.scoreBar}>
            <View style={styles.scorePlayer}>
              <Text style={styles.scoreAvatar}>🙂</Text>
              <Text style={styles.scoreName}>Siz</Text>
              <Text style={styles.scoreValue}>{playerScore}</Text>
            </View>
            <View style={styles.timerBadge}>
              <Text style={styles.timerText}>{timeLeft}</Text>
            </View>
            <View style={styles.scorePlayer}>
              <Text style={styles.scoreAvatar}>{opponentAvatar}</Text>
              <Text style={styles.scoreName} numberOfLines={1}>{opponentName}</Text>
              <Text style={styles.scoreValue}>{opponentScore}</Text>
            </View>
          </View>

          <Text style={styles.roundLabel}>{round + 1}-raund / {BATTLE_ROUNDS}</Text>

          <Pressable
            style={styles.wordCard}
            onPress={() => Speech.speak(currentWord.word, { language: 'en-US', rate: 0.9 })}>
            <Ionicons name="volume-high" size={28} color={theme.colors.purple} />
            <Text style={styles.wordText}>{currentWord.word}</Text>
            <Text style={styles.wordHint}>Qayta eshitish uchun bosing</Text>
          </Pressable>

          <View style={styles.optionsGrid}>
            {currentWord.options.map((option, i) => {
              const isCorrect = option === currentWord.translation;
              const isSelected = option === selectedOption;
              const revealed = roundWinner !== null;
              const bg = revealed
                ? isCorrect
                  ? theme.colors.success
                  : isSelected
                    ? theme.colors.danger
                    : OPTION_COLORS[i]
                : OPTION_COLORS[i];
              return (
                <Pressable
                  key={option}
                  style={[styles.optionBtn, { backgroundColor: bg }, revealed && !isCorrect && !isSelected && styles.optionDim]}
                  disabled={roundWinner !== null}
                  onPress={() => handleAnswer(option)}>
                  <Text style={styles.optionText}>{option}</Text>
                </Pressable>
              );
            })}
          </View>

          {roundWinner && (
            <Text style={[styles.roundFeedback, roundWinner === 'player' ? styles.feedbackWin : styles.feedbackLose]}>
              {roundWinner === 'player' ? "To'g'ri! Siz ushbu raundni yutdingiz 🎉" : `${opponentName} bu raundni yutdi`}
            </Text>
          )}
        </View>
      )}

      {phase === 'result' && (
        <View style={styles.resultWrap}>
          <Text style={styles.resultEmoji}>
            {playerScore > opponentScore ? '🏆' : playerScore === opponentScore ? '🤝' : '😔'}
          </Text>
          <Text style={styles.resultTitle}>
            {playerScore > opponentScore ? "G'alaba!" : playerScore === opponentScore ? 'Durrang' : 'Mag\'lubiyat'}
          </Text>
          <Text style={styles.resultScore}>
            Siz {playerScore} — {opponentScore} {opponentName}
          </Text>
          {playerScore > opponentScore && (
            <View style={styles.rewardPill}>
              <Text style={styles.rewardText}>+{BATTLE_WIN_COINS}</Text>
              <CoinIcon size={16} />
            </View>
          )}
          <Pressable style={styles.playAgainBtn} onPress={resetGame}>
            <Text style={styles.playAgainText}>Yana o'ynash</Text>
          </Pressable>
        </View>
      )}

      <CoinInfoModal visible={showCoinInfo} onClose={() => setShowCoinInfo(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  selectWrap: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  coinRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.warningBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 20,
  },
  coinEmoji: { fontSize: 16 },
  coinText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#B45309' },
  selectTitle: { fontFamily: theme.fonts.extraBold, fontSize: 22, color: theme.colors.text, textAlign: 'center', marginBottom: 8 },
  selectSubtitle: {
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  modeCardWrap: { marginBottom: 16 },
  modeCard: { borderRadius: theme.radius.lg, padding: 24, alignItems: 'center', ...theme.shadow.card },
  modeIcon: { fontSize: 36, marginBottom: 10 },
  modeTitle: { fontFamily: theme.fonts.bold, fontSize: 18, color: '#fff', marginBottom: 4 },
  modeSubtitle: { fontFamily: theme.fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  matchingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  matchAvatars: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  matchAvatarEmoji: { fontSize: 56 },
  matchVs: { fontFamily: theme.fonts.extraBold, fontSize: 18, color: theme.colors.textMuted },
  matchingText: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.textMuted },
  playWrap: { flex: 1, paddingHorizontal: 20, paddingTop: 8, alignItems: 'center' },
  scoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 18,
  },
  scorePlayer: { alignItems: 'center', width: 100 },
  scoreAvatar: { fontSize: 30, marginBottom: 4 },
  scoreName: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.textMuted },
  scoreValue: { fontFamily: theme.fonts.extraBold, fontSize: 20, color: theme.colors.text },
  timerBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: { fontFamily: theme.fonts.extraBold, fontSize: 18, color: '#fff' },
  roundLabel: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.textMuted, marginBottom: 18 },
  wordCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
    ...theme.shadow.card,
  },
  wordText: { fontFamily: theme.fonts.extraBold, fontSize: 28, color: theme.colors.text, marginTop: 10 },
  wordHint: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textLight, marginTop: 6 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%' },
  optionBtn: {
    width: '47%',
    paddingVertical: 20,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionDim: { opacity: 0.45 },
  optionText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
  roundFeedback: { fontFamily: theme.fonts.semiBold, fontSize: 14, marginTop: 18, textAlign: 'center' },
  feedbackWin: { color: theme.colors.success },
  feedbackLose: { color: theme.colors.danger },
  resultWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  resultEmoji: { fontSize: 64, marginBottom: 16 },
  resultTitle: { fontFamily: theme.fonts.extraBold, fontSize: 26, color: theme.colors.text, marginBottom: 8 },
  resultScore: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted, marginBottom: 20 },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.warningBg,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 28,
  },
  rewardText: { fontFamily: theme.fonts.extraBold, fontSize: 18, color: '#B45309' },
  playAgainBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 16,
    paddingHorizontal: 40,
  },
  playAgainText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});
