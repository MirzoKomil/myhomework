import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CelebrationOverlay } from '@/components/ui/CelebrationOverlay';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { CoinInfoModal } from '@/components/ui/CoinInfoModal';
import { LightningInfoModal } from '@/components/ui/LightningInfoModal';
import { LightningPill } from '@/components/ui/LightningIcon';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import {
  BATTLE_ROUNDS,
  BATTLE_ROUND_SECONDS,
  BATTLE_WIN_COINS,
  BattleOpponentType,
  BattleWord,
  battleWords as FALLBACK_BATTLE_WORDS,
} from '@/data/mock';
import {
  abandonBattleMatch,
  BattleMatchStatus,
  fetchBattleStatus,
  joinBattleQueue,
  leaveBattleQueue,
  submitBattleAnswer,
} from '@/services/contentApi';
import { addCoins, useCoins } from '@/services/coinsStore';
import { playLoseSound, playWinSound } from '@/services/gameSounds';
import { addLightning, useLightning } from '@/services/lightningStore';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

const RANDOM_AVATARS = ['🧑', '👩', '🧑‍🦱', '👨‍🦰'];
const OPTION_COLORS = ['#4F8CFF', '#F472B6', '#FBBF24', '#34D399'];
const MIN_POOL_SIZE = 4;
// 2-vazifa: navbatda haqiqiy raqib qidirish uchun eng ko'p kutish vaqti —
// shundan keyin ham hech kim topilmasa, o'quvchiga buni yaxshi tushuntirib
// beriladi (jim ravishda botga almashtirilmaydi).
const QUEUE_WAIT_SECONDS = 60;

type Phase = 'select' | 'matching' | 'playing' | 'result';
type RoundWinner = 'player' | 'opponent' | 'draw' | null;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// O'quvchi hozirgacha ochgan darslardagi so'zlardan raund uchun so'z va
// 4 ta tanlov (to'g'ri tarjima + boshqa so'zlardan 3 ta noto'g'ri variant) quradi.
function buildBattleWords(vocab: { english: string; translation: string }[]): BattleWord[] {
  const uniq = new Map<string, string>();
  for (const w of vocab) {
    const key = w.english.toLowerCase();
    if (!uniq.has(key)) uniq.set(key, w.translation);
  }
  const pool = Array.from(uniq.entries());
  if (pool.length < MIN_POOL_SIZE) return FALLBACK_BATTLE_WORDS;

  return pool.map(([word, translation], i) => {
    const others = pool.filter((_, j) => j !== i).map(([, t]) => t);
    const distractors = shuffle(others).slice(0, 3);
    return { word, translation, options: shuffle([translation, ...distractors]) };
  });
}

function OpponentAvatar({ emoji, avatarUrl, size }: { emoji: string; avatarUrl?: string; size: number }) {
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return <Text style={{ fontSize: size * 0.72 }}>{emoji}</Text>;
}

export default function BattleScreen() {
  const { courseLang } = useLang();
  const navigation = useNavigation();
  const speechLang = courseLang === 'russian' ? 'ru-RU' : 'en-US';
  const coins = useCoins();
  const lightning = useLightning();
  const [showCoinInfo, setShowCoinInfo] = useState(false);
  const [showLightningInfo, setShowLightningInfo] = useState(false);
  const [phase, setPhase] = useState<Phase>('select');
  const [opponentType, setOpponentType] = useState<BattleOpponentType | null>(null);
  const [opponentName, setOpponentName] = useState('Bot');
  const [opponentAvatar, setOpponentAvatar] = useState('🤖');
  const [opponentAvatarUrl, setOpponentAvatarUrl] = useState('');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [queueSecondsLeft, setQueueSecondsLeft] = useState(QUEUE_WAIT_SECONDS);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [resultNote, setResultNote] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [roundWords, setRoundWords] = useState<BattleWord[]>([]);
  const [timeLeft, setTimeLeft] = useState(BATTLE_ROUND_SECONDS);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [roundWinner, setRoundWinner] = useState<RoundWinner>(null);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const botTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutSubmitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextRoundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundLockedRef = useRef(false);
  const serverRoundRef = useRef(0);
  const matchFinishedRef = useRef(false);
  // O'quvchi ochgan darslardagi so'zlardan quriladigan raund havzasi —
  // ekran ochilishi bilan oldindan yuklab qo'yiladi, shunda "o'yin boshlash"
  // bosilganda kutish shart bo'lmaydi.
  const battleWordsRef = useRef<BattleWord[]>(FALLBACK_BATTLE_WORDS);

  // Quyidagi uchtasi — navigatsiyadan chiqishda (tab almashtirish, orqaga
  // tugmasi, brauzer "orqaga"si) darhol to'xtatish uchun kerak. Bu holatlar
  // ko'pincha ESKI (stale) closure ichidan chaqiriladi, shu sabab state
  // o'rniga har doim YANGILANGAN ref'lardan o'qiladi.
  const phaseRef = useRef<Phase>('select');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  const matchIdRef = useRef<string | null>(null);
  useEffect(() => {
    matchIdRef.current = matchId;
  }, [matchId]);
  const opponentTypeRef = useRef<BattleOpponentType | null>(null);
  useEffect(() => {
    opponentTypeRef.current = opponentType;
  }, [opponentType]);
  // handleMatchPoll bir marta (o'yin boshlanganda) setInterval'ga
  // biriktiriladi va keyin qayta yaratilmaydi — shu sabab u ichida
  // roundWinner state'ini to'g'ridan-to'g'ri o'qish "eskirgan" (stale)
  // qiymat qaytaradi. Har doim yangi qiymatni ko'rish uchun ref ishlatiladi.
  const roundWinnerRef = useRef<RoundWinner>(null);
  useEffect(() => {
    roundWinnerRef.current = roundWinner;
  }, [roundWinner]);

  const currentWord = roundWords[round];

  useEffect(() => {
    let cancelled = false;
    getAccumulatedVocabulary().then((words) => {
      if (!cancelled) battleWordsRef.current = buildBattleWords(words);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (queueCountdownRef.current) {
      clearInterval(queueCountdownRef.current);
      queueCountdownRef.current = null;
    }
  };

  // 17-vazifa qoshimcha bilan bir xil uslub: navigatsiyadan chiqishda
  // (blur/unmount/tasdiqlangan orqaga) hamma narsa DARHOL to'xtaydi —
  // taymerlar, ovoz, va agar haqiqiy o'yin bo'lsa, raqibga bildirish uchun
  // serverga "chiqib ketdi" deb xabar beriladi.
  const stopAndLeaveGame = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
    if (timeoutSubmitRef.current) clearTimeout(timeoutSubmitRef.current);
    stopPolling();
    Speech.stop();
    const mId = matchIdRef.current;
    if (mId) {
      abandonBattleMatch(mId).catch(() => {});
    } else if (phaseRef.current === 'matching' && opponentTypeRef.current === 'random') {
      leaveBattleQueue().catch(() => {});
    }
    setPhase('select');
    setOpponentType(null);
    setMatchId(null);
  };

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
      if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
      if (timeoutSubmitRef.current) clearTimeout(timeoutSubmitRef.current);
      stopPolling();
      Speech.stop();
    };
  }, []);

  // 17-vazifa qoshimcha: o'yin ketayotib boshqa tabga/sahifaga o'tilsa
  // (bu holatda ekran "unmount" bo'lmaydi, faqat fokusni yo'qotadi), o'yin
  // fonda davom etib, so'zlarni talaffuz qilib chiqib bermasligi kerak —
  // va qaytib kirilganda ham xuddi shu joydan "davom etmasligi", balki
  // yangi tanlov ekrani ko'rsatilishi kerak.
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (phaseRef.current === 'matching' || phaseRef.current === 'playing') {
          stopAndLeaveGame();
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Orqaga tugmasi (header, hardware/brauzer "orqaga", swipe) o'yin
  // davomida bosilsa — darhol chiqib ketish o'rniga avval tasdiqlash
  // so'raladi, faqat tasdiqlansa o'yin to'xtab, navigatsiya davom etadi.
  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (phaseRef.current !== 'matching' && phaseRef.current !== 'playing') return;
      e.preventDefault();
      Alert.alert("O'yin davom etmoqda", "Boshqa sahifaga o'tsangiz, o'yin shu yerda to'xtaydi. Davom etasizmi?", [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: 'Ha, chiqish',
          style: 'destructive',
          onPress: () => {
            stopAndLeaveGame();
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
  }, [navigation]);

  const handleHeaderBack = () => {
    if (phaseRef.current === 'matching' || phaseRef.current === 'playing') {
      Alert.alert("O'yin davom etmoqda", "Chiqsangiz, o'yin shu yerda to'xtaydi. Davom etasizmi?", [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: 'Ha, chiqish',
          style: 'destructive',
          onPress: () => {
            stopAndLeaveGame();
            navigation.goBack();
          },
        },
      ]);
    } else {
      navigation.goBack();
    }
  };

  const enterMatch = (status: BattleMatchStatus) => {
    stopPolling();
    const words = status.words && status.words.length ? status.words : shuffle(battleWordsRef.current).slice(0, BATTLE_ROUNDS);
    setMatchId(status.matchId ?? null);
    setOpponentName(status.opponentName || 'Hamkurs');
    setOpponentAvatarUrl(status.opponentAvatarUrl || '');
    setOpponentAvatar(RANDOM_AVATARS[Math.floor(Math.random() * RANDOM_AVATARS.length)]);
    setRoundWords(words);
    setPlayerScore(status.scores?.me ?? 0);
    setOpponentScore(status.scores?.opponent ?? 0);
    serverRoundRef.current = status.currentRound ?? 0;
    matchFinishedRef.current = false;
    setResultNote(null);
    setRound(status.currentRound ?? 0);
    setRoundWinner(null);
    setPhase('playing');
    if (status.matchId) startMatchPolling(status.matchId);
  };

  const giveUpQueue = () => {
    stopPolling();
    leaveBattleQueue().catch(() => {});
    setPhase('select');
    setOpponentType(null);
    setQueueMessage("Afsuski, hozircha boshqa o'yinchi navbatda emas. Birozdan so'ng qayta urinib ko'ring yoki Bot bilan mashq qiling.");
  };

  const handleQueuePoll = (status: BattleMatchStatus) => {
    if (status.status === 'waiting') return;
    if (status.status === 'not_found') {
      stopPolling();
      setPhase('select');
      setOpponentType(null);
      setQueueMessage("Afsuski, hozircha boshqa o'yinchi navbatda emas. Birozdan so'ng qayta urinib ko'ring yoki Bot bilan mashq qiling.");
      return;
    }
    enterMatch(status);
  };

  const startQueuePolling = () => {
    stopPolling();
    pollRef.current = setInterval(() => {
      fetchBattleStatus().then(handleQueuePoll).catch(() => {});
    }, 1500);
    queueCountdownRef.current = setInterval(() => {
      setQueueSecondsLeft((s) => {
        if (s <= 1) {
          giveUpQueue();
          return QUEUE_WAIT_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
  };

  const handleMatchPoll = (status: BattleMatchStatus) => {
    if (status.status === 'abandoned') {
      stopPolling();
      setPlayerScore(status.scores?.me ?? 0);
      setOpponentScore(status.scores?.opponent ?? 0);
      setResultNote(status.opponentLeft ? "Raqibingiz o'yindan chiqib ketdi" : null);
      matchFinishedRef.current = true;
      setPhase('result');
      return;
    }
    if (status.status === 'finished') {
      stopPolling();
      matchFinishedRef.current = true;
      setPlayerScore(status.scores?.me ?? 0);
      setOpponentScore(status.scores?.opponent ?? 0);
      if (roundWinnerRef.current === null && status.lastRoundResult) {
        setRoundWinner(status.lastRoundResult.draw ? 'draw' : status.lastRoundResult.iWon ? 'player' : 'opponent');
      } else if (roundWinnerRef.current === null) {
        setPhase('result');
      }
      return;
    }
    if (typeof status.currentRound === 'number' && status.currentRound !== serverRoundRef.current) {
      serverRoundRef.current = status.currentRound;
      setPlayerScore(status.scores?.me ?? 0);
      setOpponentScore(status.scores?.opponent ?? 0);
      if (roundWinnerRef.current === null && status.lastRoundResult) {
        setRoundWinner(status.lastRoundResult.draw ? 'draw' : status.lastRoundResult.iWon ? 'player' : 'opponent');
      }
    }
  };

  const startMatchPolling = (id: string) => {
    stopPolling();
    pollRef.current = setInterval(() => {
      fetchBattleStatus(id).then(handleMatchPoll).catch(() => {});
    }, 1400);
  };

  const startMatch = (type: BattleOpponentType) => {
    setOpponentType(type);
    setQueueMessage(null);
    setResultNote(null);
    matchFinishedRef.current = false;

    if (type === 'bot') {
      setOpponentName('Bot');
      setOpponentAvatarUrl('');
      setOpponentAvatar('🤖');
      setMatchId(null);
      setPhase('matching');
      setTimeout(() => {
        setRoundWords(shuffle(battleWordsRef.current).slice(0, BATTLE_ROUNDS));
        setRound(0);
        setPlayerScore(0);
        setOpponentScore(0);
        setRoundWinner(null);
        setPhase('playing');
      }, 1600);
      return;
    }

    // 2-vazifa: "Tasodifiy o'yinchi" — HAQIQIY, bir vaqtda navbatda turgan
    // boshqa o'quvchini qidiradi (avval bu ham mahalliy soxta bot edi).
    setOpponentName('');
    setOpponentAvatarUrl('');
    setMatchId(null);
    setPhase('matching');
    setQueueSecondsLeft(QUEUE_WAIT_SECONDS);
    const words = shuffle(battleWordsRef.current).slice(0, BATTLE_ROUNDS);
    joinBattleQueue(words)
      .then((status) => {
        if (status.status === 'waiting') {
          startQueuePolling();
        } else if (status.status === 'not_found') {
          setPhase('select');
          setOpponentType(null);
          setQueueMessage("Afsuski, hozircha boshqa o'yinchi navbatda emas. Birozdan so'ng qayta urinib ko'ring yoki Bot bilan mashq qiling.");
        } else {
          enterMatch(status);
        }
      })
      .catch(() => {
        setPhase('select');
        setOpponentType(null);
        setQueueMessage("Hozircha bu funksiya ishlamayapti. Birozdan so'ng qayta urinib ko'ring.");
      });
  };

  // Round lifecycle: so'zni talaffuz qilish, sanoqni boshlash, va — faqat
  // Bot rejimida — "raqib"ning javobini simulyatsiya qilish. Haqiqiy
  // o'yinda esa vaqt tugasa serverga "vaqt tugadi" deb yuboriladi, g'olibni
  // esa faqat server (ikkala tomon javobini solishtirib) aniqlaydi.
  useEffect(() => {
    if (phase !== 'playing' || !currentWord) return;
    roundLockedRef.current = false;
    setSelectedOption(null);
    setRoundWinner(null);
    setTimeLeft(BATTLE_ROUND_SECONDS);

    Speech.speak(currentWord.word, { language: speechLang, rate: 0.9 });

    tickRef.current = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);

    if (matchId) {
      timeoutSubmitRef.current = setTimeout(() => {
        if (roundLockedRef.current) return;
        roundLockedRef.current = true;
        submitBattleAnswer(matchId, round, false, BATTLE_ROUND_SECONDS * 1000).catch(() => {});
      }, BATTLE_ROUND_SECONDS * 1000);
    } else {
      const botDelay = (2 + Math.random() * (BATTLE_ROUND_SECONDS - 2.5)) * 1000;
      botTimeoutRef.current = setTimeout(() => {
        if (roundLockedRef.current) return;
        roundLockedRef.current = true;
        if (tickRef.current) clearInterval(tickRef.current);
        setOpponentScore((s) => s + 1);
        setRoundWinner('opponent');
      }, botDelay);
    }

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
      if (timeoutSubmitRef.current) clearTimeout(timeoutSubmitRef.current);
    };
  }, [phase, round, matchId]);

  // Raund hal bo'lgach, natijani biroz ko'rsatib turib keyingi raundga
  // (yoki — agar tugagan bo'lsa — natija ekraniga) o'tkazadi.
  useEffect(() => {
    if (phase !== 'playing' || roundWinner === null) return;
    nextRoundTimeoutRef.current = setTimeout(() => {
      if (matchId) {
        if (matchFinishedRef.current) {
          setPhase('result');
        } else {
          setRound(serverRoundRef.current);
        }
      } else if (round + 1 >= BATTLE_ROUNDS) {
        setPhase('result');
      } else {
        setRound((r) => r + 1);
      }
    }, 1400);
    return () => {
      if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
    };
  }, [roundWinner]);

  // G'olib faqat shu raundni haqiqatan yutgan tomon bo'lsa mukofotlanadi —
  // Bot rejimida bu tanlov paytida, haqiqiy o'yinda esa server javobi
  // kelgach ma'lum bo'ladi.
  useEffect(() => {
    if (roundWinner === 'player') {
      addCoins(1);
      addLightning(1);
    }
  }, [roundWinner]);

  // G'alaba qozonilganda bonus coinlarni va tovushni bir marta ishga tushirish.
  useEffect(() => {
    if (phase !== 'result') return;
    if (playerScore > opponentScore) {
      addCoins(BATTLE_WIN_COINS);
      playWinSound();
    } else if (playerScore < opponentScore) {
      playLoseSound();
    }
  }, [phase]);

  const handleAnswer = (option: string) => {
    if (roundLockedRef.current || phase !== 'playing') return;
    roundLockedRef.current = true;
    if (tickRef.current) clearInterval(tickRef.current);
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    if (timeoutSubmitRef.current) clearTimeout(timeoutSubmitRef.current);
    setSelectedOption(option);
    const correct = option === currentWord.translation;

    if (matchId) {
      const elapsedMs = (BATTLE_ROUND_SECONDS - timeLeft) * 1000;
      submitBattleAnswer(matchId, round, correct, elapsedMs).catch(() => {});
      return;
    }

    if (correct) {
      setPlayerScore((s) => s + 1);
      setRoundWinner('player');
    } else {
      setOpponentScore((s) => s + 1);
      setRoundWinner('opponent');
    }
  };

  const resetGame = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
    if (timeoutSubmitRef.current) clearTimeout(timeoutSubmitRef.current);
    stopPolling();
    setPhase('select');
    setOpponentType(null);
    setMatchId(null);
    setRoundWinner(null);
    setResultNote(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Speaking Battle" showBack onBack={handleHeaderBack} />

      {phase === 'select' && (
        <View style={styles.selectWrap}>
          <View style={styles.balanceRow}>
            <Pressable style={styles.coinRow} onPress={() => setShowCoinInfo(true)}>
              <CoinIcon size={18} />
              <Text style={styles.coinText}>{coins}</Text>
            </Pressable>
            <Pressable onPress={() => setShowLightningInfo(true)}>
              <LightningPill amount={lightning} size={18} />
            </Pressable>
          </View>
          <Text style={styles.selectTitle}>Kim bilan o'ynaysiz?</Text>
          <Text style={styles.selectSubtitle}>
            So'zni tinglang va to'g'ri tarjimasini birinchi bo'lib toping — g'olib coin yutadi!
          </Text>

          {queueMessage && (
            <View style={styles.queueMessageBox}>
              <Ionicons name="information-circle-outline" size={18} color={theme.colors.textMuted} />
              <Text style={styles.queueMessageText}>{queueMessage}</Text>
            </View>
          )}

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
            <Text style={styles.matchAvatarEmoji}>{opponentType === 'random' ? '❓' : opponentAvatar}</Text>
          </View>
          <Text style={styles.matchingText}>Qidirilmoqda...</Text>
          {opponentType === 'random' && (
            <>
              <Text style={styles.matchingCountdown}>{queueSecondsLeft} soniya qoldi</Text>
              <Pressable style={styles.cancelQueueBtn} onPress={giveUpQueue}>
                <Text style={styles.cancelQueueText}>Bekor qilish</Text>
              </Pressable>
            </>
          )}
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
              <View style={styles.scoreAvatarWrap}>
                <OpponentAvatar emoji={opponentAvatar} avatarUrl={opponentAvatarUrl} size={30} />
              </View>
              <Text style={styles.scoreName} numberOfLines={1}>{opponentName}</Text>
              <Text style={styles.scoreValue}>{opponentScore}</Text>
            </View>
          </View>

          <Text style={styles.roundLabel}>{round + 1}-raund / {BATTLE_ROUNDS}</Text>

          <Pressable
            style={styles.wordCard}
            onPress={() => Speech.speak(currentWord.word, { language: speechLang, rate: 0.9 })}>
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
                  disabled={roundWinner !== null || (!!matchId && selectedOption !== null)}
                  onPress={() => handleAnswer(option)}>
                  <Text style={styles.optionText}>{option}</Text>
                </Pressable>
              );
            })}
          </View>

          {!!matchId && selectedOption && roundWinner === null && (
            <Text style={styles.waitingText}>Javobingiz yuborildi — raqibingiz kutilmoqda...</Text>
          )}

          {roundWinner && (
            <Text
              style={[
                styles.roundFeedback,
                roundWinner === 'player' ? styles.feedbackWin : roundWinner === 'draw' ? styles.feedbackDraw : styles.feedbackLose,
              ]}>
              {roundWinner === 'player'
                ? "To'g'ri! Siz ushbu raundni yutdingiz 🎉"
                : roundWinner === 'draw'
                  ? "Ikkalangiz ham to'g'ri javob berolmadingiz"
                  : `${opponentName} bu raundni yutdi`}
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
          {resultNote && <Text style={styles.resultNote}>{resultNote}</Text>}
          {playerScore > opponentScore && (
            <View style={styles.rewardPill}>
              <Text style={styles.rewardText}>+{BATTLE_WIN_COINS}</Text>
              <CoinIcon size={16} />
            </View>
          )}
          <Pressable style={styles.playAgainBtn} onPress={resetGame}>
            <Text style={styles.playAgainText}>Yana o'ynash</Text>
          </Pressable>
          <CelebrationOverlay visible={playerScore > opponentScore} />
        </View>
      )}

      <CoinInfoModal visible={showCoinInfo} onClose={() => setShowCoinInfo(false)} />
      <LightningInfoModal visible={showLightningInfo} onClose={() => setShowLightningInfo(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  selectWrap: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  balanceRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  coinRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.warningBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  coinEmoji: { fontSize: 16 },
  coinText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#B45309' },
  selectTitle: { fontFamily: theme.fonts.extraBold, fontSize: 22, color: theme.colors.text, textAlign: 'center', marginBottom: 8 },
  selectSubtitle: {
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  queueMessageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 20,
    ...theme.shadow.card,
  },
  queueMessageText: { flex: 1, fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted, lineHeight: 19 },
  modeCardWrap: { marginBottom: 16 },
  modeCard: { borderRadius: theme.radius.lg, padding: 24, alignItems: 'center', ...theme.shadow.card },
  modeIcon: { fontSize: 36, marginBottom: 10 },
  modeTitle: { fontFamily: theme.fonts.bold, fontSize: 18, color: '#fff', marginBottom: 4 },
  modeSubtitle: { fontFamily: theme.fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  matchingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  matchAvatars: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  matchAvatarEmoji: { fontSize: 56 },
  matchVs: { fontFamily: theme.fonts.extraBold, fontSize: 18, color: theme.colors.textMuted },
  matchingText: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.textMuted },
  matchingCountdown: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textLight },
  cancelQueueBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface },
  cancelQueueText: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.textMuted },
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
  scoreAvatarWrap: { width: 30, height: 30, marginBottom: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 15 },
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
  waitingText: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted, marginTop: 18, textAlign: 'center' },
  roundFeedback: { fontFamily: theme.fonts.semiBold, fontSize: 14, marginTop: 18, textAlign: 'center' },
  feedbackWin: { color: theme.colors.success },
  feedbackLose: { color: theme.colors.danger },
  feedbackDraw: { color: theme.colors.textMuted },
  resultWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  resultEmoji: { fontSize: 64, marginBottom: 16 },
  resultTitle: { fontFamily: theme.fonts.extraBold, fontSize: 26, color: theme.colors.text, marginBottom: 8 },
  resultScore: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted, marginBottom: 8 },
  resultNote: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textLight, marginBottom: 12, textAlign: 'center' },
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
