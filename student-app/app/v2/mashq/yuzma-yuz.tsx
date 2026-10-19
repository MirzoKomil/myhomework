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
import { useFocusEffect } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoinIcon, SpeakerIcon } from '@/components/v2/practice/icons';
import { GameHeader, goBack, reset, useCurrentLesson } from '@/components/v2/practice/shared';
import { designImages } from '@/constants/v2/designImages';
import { fonts } from '@/constants/v2/tokens';
import {
  BATTLE_ROUNDS,
  BATTLE_ROUND_SECONDS,
  BATTLE_WIN_COINS,
  type BattleOpponentType,
  type BattleWord,
  battleWords as FALLBACK_BATTLE_WORDS,
} from '@/data/mock';
import { useLang } from '@/i18n/LanguageContext';
import { useAvatarUri } from '@/services/avatarStore';
import { addCoins } from '@/services/coinsStore';
import {
  abandonBattleMatch,
  type BattleMatchStatus,
  fetchBattleStatus,
  fetchLeaderboard,
  joinBattleQueue,
  leaveBattleQueue,
  submitBattleAnswer,
} from '@/services/contentApi';
import { playLoseSound, playWinSound } from '@/services/gameSounds';
import { addLightning } from '@/services/lightningStore';
import { useAuth } from '@/services/studentAuthStore';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

const img = (id: string) => (designImages as Record<string, ImageSourcePropType>)[id];
const MY_AVATAR = img('93faebd4826b1da6adaee5d0dcda6209');
const OPP_AVATAR = img('6fbb4a0364e41f76fd238e0c91d0228b');
const MIN_POOL_SIZE = 4;
const QUEUE_WAIT_SECONDS = 60;
const NOT_FOUND = "Hozircha boshqa oʻyinchi navbatda emas. Qayta urinib koʻring yoki Bot bilan mashq qiling.";

type Phase = 'matching' | 'notFound' | 'playing' | 'result';
type RoundWinner = 'player' | 'opponent' | 'draw' | null;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Eski battle.tsx bilan bir xil: ochilgan darslar so'zlaridan raundlar.
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
    return { word, translation, options: shuffle([translation, ...shuffle(others).slice(0, 3)]) };
  });
}

export default function BattleScreen() {
  const insets = useSafeAreaInsets();
  const { courseLang } = useLang();
  const speechLang = courseLang === 'russian' ? 'ru-RU' : 'en-US';
  const lesson = useCurrentLesson();
  const myAvatar = useAvatarUri();
  const { student } = useAuth();

  const [phase, setPhase] = useState<Phase>('matching');
  const [opponentType, setOpponentType] = useState<BattleOpponentType>('random');
  const [opponentName, setOpponentName] = useState('');
  const [opponentAvatarUrl, setOpponentAvatarUrl] = useState('');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [queueSecondsLeft, setQueueSecondsLeft] = useState(QUEUE_WAIT_SECONDS);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [resultNote, setResultNote] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(BATTLE_ROUNDS);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [roundWords, setRoundWords] = useState<BattleWord[]>([]);
  const [timeLeft, setTimeLeft] = useState(BATTLE_ROUND_SECONDS);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [roundWinner, setRoundWinner] = useState<RoundWinner>(null);
  const [history, setHistory] = useState<RoundWinner[]>([]);
  const [ranks, setRanks] = useState<{ me: number | null; opp: number | null }>({ me: null, opp: null });

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const botTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutSubmitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextRoundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundLockedRef = useRef(false);
  const serverRoundRef = useRef(0);
  const matchFinishedRef = useRef(false);
  const battleWordsRef = useRef<BattleWord[]>(FALLBACK_BATTLE_WORDS);
  const wordsReady = useRef<Promise<void> | null>(null);
  const phaseRef = useRef<Phase>('matching');
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const matchIdRef = useRef<string | null>(null);
  useEffect(() => { matchIdRef.current = matchId; }, [matchId]);
  const opponentTypeRef = useRef<BattleOpponentType>('random');
  useEffect(() => { opponentTypeRef.current = opponentType; }, [opponentType]);
  const roundWinnerRef = useRef<RoundWinner>(null);
  useEffect(() => { roundWinnerRef.current = roundWinner; }, [roundWinner]);

  const currentWord = roundWords[round];

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (queueCountdownRef.current) { clearInterval(queueCountdownRef.current); queueCountdownRef.current = null; }
  };
  const clearTimers = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
    if (timeoutSubmitRef.current) clearTimeout(timeoutSubmitRef.current);
  };

  // Chiqishda hammasi darhol to'xtaydi; haqiqiy o'yinda raqibga xabar beriladi.
  const stopAndLeaveGame = () => {
    clearTimers();
    stopPolling();
    Speech.stop();
    const mId = matchIdRef.current;
    if (mId && !matchFinishedRef.current) abandonBattleMatch(mId).catch(() => {});
    else if (phaseRef.current === 'matching' && opponentTypeRef.current === 'random') leaveBattleQueue().catch(() => {});
  };

  useFocusEffect(useCallback(() => () => stopAndLeaveGame(), []));

  // Reyting o'rni (Liga) — "4-oʻrin" kabi; topilmasa ko'rsatilmaydi.
  useEffect(() => {
    if (phase !== 'playing') return;
    fetchLeaderboard('country')
      .then((list) => {
        const me = list.find((e) => e.isMe)?.rank ?? null;
        const opp = opponentName ? list.find((e) => !e.isMe && e.name === opponentName)?.rank ?? null : null;
        setRanks({ me, opp });
      })
      .catch(() => {});
  }, [phase, opponentName]);

  const enterMatch = (status: BattleMatchStatus) => {
    stopPolling();
    const words = status.words && status.words.length ? status.words : shuffle(battleWordsRef.current).slice(0, BATTLE_ROUNDS);
    setMatchId(status.matchId ?? null);
    setOpponentName(status.opponentName || 'Hamkurs');
    setOpponentAvatarUrl(status.opponentAvatarUrl || '');
    setRoundWords(words);
    setTotalRounds(status.totalRounds ?? words.length);
    setPlayerScore(status.scores?.me ?? 0);
    setOpponentScore(status.scores?.opponent ?? 0);
    serverRoundRef.current = status.currentRound ?? 0;
    matchFinishedRef.current = false;
    setResultNote(null);
    setHistory([]);
    setRound(status.currentRound ?? 0);
    setRoundWinner(null);
    setPhase('playing');
    if (status.matchId) startMatchPolling(status.matchId);
  };

  const notFound = (msg = NOT_FOUND) => {
    stopPolling();
    setPhase('notFound');
    setQueueMessage(msg);
  };

  const giveUpQueue = () => {
    leaveBattleQueue().catch(() => {});
    notFound();
  };

  const startQueuePolling = () => {
    stopPolling();
    pollRef.current = setInterval(() => {
      fetchBattleStatus()
        .then((s) => {
          if (s.status === 'waiting') return;
          if (s.status === 'not_found') return notFound();
          enterMatch(s);
        })
        .catch(() => {});
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

  const recordRound = (w: RoundWinner) => setHistory((h) => [...h, w]);

  const handleMatchPoll = (status: BattleMatchStatus) => {
    if (status.status === 'abandoned') {
      stopPolling();
      setPlayerScore(status.scores?.me ?? 0);
      setOpponentScore(status.scores?.opponent ?? 0);
      setResultNote(status.opponentLeft ? 'Raqibingiz oʻyindan chiqib ketdi' : null);
      matchFinishedRef.current = true;
      setPhase('result');
      return;
    }
    const lr = status.lastRoundResult;
    const fromServer: RoundWinner = lr ? (lr.draw ? 'draw' : lr.iWon ? 'player' : 'opponent') : null;
    if (status.status === 'finished') {
      stopPolling();
      matchFinishedRef.current = true;
      setPlayerScore(status.scores?.me ?? 0);
      setOpponentScore(status.scores?.opponent ?? 0);
      if (roundWinnerRef.current === null && fromServer) {
        setRoundWinner(fromServer);
        recordRound(fromServer);
      } else if (roundWinnerRef.current === null) setPhase('result');
      return;
    }
    if (typeof status.currentRound === 'number' && status.currentRound !== serverRoundRef.current) {
      serverRoundRef.current = status.currentRound;
      setPlayerScore(status.scores?.me ?? 0);
      setOpponentScore(status.scores?.opponent ?? 0);
      if (roundWinnerRef.current === null && fromServer) {
        setRoundWinner(fromServer);
        recordRound(fromServer);
      }
    }
  };

  const startMatchPolling = (id: string) => {
    stopPolling();
    pollRef.current = setInterval(() => {
      fetchBattleStatus(id).then(handleMatchPoll).catch(() => {});
    }, 1400);
  };

  const startMatch = async (type: BattleOpponentType) => {
    clearTimers();
    stopPolling();
    setOpponentType(type);
    setQueueMessage(null);
    setResultNote(null);
    setHistory([]);
    matchFinishedRef.current = false;
    setMatchId(null);
    setPlayerScore(0);
    setOpponentScore(0);
    setRoundWinner(null);
    await wordsReady.current;

    if (type === 'bot') {
      setOpponentName('Bot');
      setOpponentAvatarUrl('');
      const words = shuffle(battleWordsRef.current).slice(0, BATTLE_ROUNDS);
      setRoundWords(words);
      setTotalRounds(words.length);
      setRound(0);
      setPhase('playing');
      return;
    }

    setOpponentName('');
    setOpponentAvatarUrl('');
    setPhase('matching');
    setQueueSecondsLeft(QUEUE_WAIT_SECONDS);
    joinBattleQueue(shuffle(battleWordsRef.current).slice(0, BATTLE_ROUNDS))
      .then((status) => {
        if (status.status === 'waiting') startQueuePolling();
        else if (status.status === 'not_found') notFound();
        else enterMatch(status);
      })
      .catch(() => notFound('Hozircha bu funksiya ishlamayapti. Birozdan soʻng qayta urinib koʻring.'));
  };

  // Ekran ochilganda: so'zlar yuklanadi va darhol raqib qidiriladi.
  useEffect(() => {
    wordsReady.current = getAccumulatedVocabulary()
      .then((w) => { battleWordsRef.current = buildBattleWords(w); })
      .catch(() => {});
    startMatch('random');
    return () => { clearTimers(); stopPolling(); Speech.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Raund: so'z o'qiladi, sanoq boshlanadi; Bot rejimida raqib javobi simulyatsiya.
  useEffect(() => {
    if (phase !== 'playing' || !currentWord) return;
    roundLockedRef.current = false;
    setSelectedOption(null);
    setRoundWinner(null);
    setTimeLeft(BATTLE_ROUND_SECONDS);
    Speech.speak(currentWord.word, { language: speechLang, rate: 0.9 });
    tickRef.current = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);

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
        recordRound('opponent');
      }, botDelay);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
      if (timeoutSubmitRef.current) clearTimeout(timeoutSubmitRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round, matchId]);

  useEffect(() => {
    if (phase !== 'playing' || roundWinner === null) return;
    nextRoundTimeoutRef.current = setTimeout(() => {
      if (matchId) {
        if (matchFinishedRef.current) setPhase('result');
        else setRound(serverRoundRef.current);
      } else if (round + 1 >= roundWords.length) setPhase('result');
      else setRound((r) => r + 1);
    }, 1400);
    return () => { if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundWinner]);

  useEffect(() => {
    if (roundWinner === 'player') {
      addCoins(1);
      addLightning(1);
    }
  }, [roundWinner]);

  useEffect(() => {
    if (phase !== 'result') return;
    if (playerScore > opponentScore) {
      addCoins(BATTLE_WIN_COINS);
      playWinSound();
    } else if (playerScore < opponentScore) playLoseSound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleAnswer = (option: string) => {
    if (roundLockedRef.current || phase !== 'playing' || !currentWord) return;
    roundLockedRef.current = true;
    if (tickRef.current) clearInterval(tickRef.current);
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    if (timeoutSubmitRef.current) clearTimeout(timeoutSubmitRef.current);
    setSelectedOption(option);
    const correct = option === currentWord.translation;
    if (matchId) {
      submitBattleAnswer(matchId, round, correct, (BATTLE_ROUND_SECONDS - timeLeft) * 1000).catch(() => {});
      return;
    }
    const w: RoundWinner = correct ? 'player' : 'opponent';
    if (correct) setPlayerScore((s) => s + 1);
    else setOpponentScore((s) => s + 1);
    setRoundWinner(w);
    recordRound(w);
  };

  const oppLabel = opponentName || 'Raqib';
  const revealed = roundWinner !== null;
  const status =
    phase !== 'playing'
      ? ''
      : revealed
        ? roundWinner === 'player'
          ? 'Siz yutdingiz'
          : roundWinner === 'draw'
            ? 'Durrang'
            : `${oppLabel} yutdi`
        : selectedOption
          ? `${oppLabel} kutilmoqda…`
          : `${oppLabel} oʻylayapti…`;

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
                  {playerScore > opponentScore ? ` · +${BATTLE_WIN_COINS} coin` : ''}
                </Text>
                {!!resultNote && <Text style={styles.hiddenText}>{resultNote}</Text>}
                <Pressable accessibilityRole="button" onPress={() => startMatch('random')} style={styles.cta}>
                  <Text style={styles.ctaText}>Yana oʻynash</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.prompt}>{phase === 'matching' ? 'Raqib qidirilmoqda…' : 'Raqib topilmadi'}</Text>
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
                <Text style={styles.optionText}>Qayta urinish</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => startMatch('bot')} style={styles.option}>
                <Text style={styles.optionText}>Bot bilan</Text>
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
            <Text style={styles.coinText}>{BATTLE_WIN_COINS} coin</Text>
          </View>
          <Text style={styles.footerText}>oladi</Text>
        </View>
      </View>
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
