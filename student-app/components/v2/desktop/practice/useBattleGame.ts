/**
 * Yuzma-yuz (1v1) o'yini holati — telefon (app/v2/mashq/yuzma-yuz.tsx) va
 * kompyuter (DBattle) ekranlari uchun bitta manba.
 *
 * Sabab: haqiqiy raqib navbati (/api/state/battle/join|status|answer|leave|abandon),
 * 30 s kutishdan keyin "Bot bilan oʻynaysizmi?" so'rovi, raundlar, coin/chaqmoq,
 * ovozlar va wordMix ikkala ko'rinishda aynan bir xil bo'lishi shart —
 * mantiq telefon ekranidan o'zgarishsiz ko'chirildi, joylashuv har ekranning o'zida.
 */
import { useFocusEffect } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useCurrentLesson } from '@/components/v2/practice/shared';
import { loadMixContext, markMistake, pickMix, rememberShown, type MixContext } from '@/components/v2/practice/wordMix';
import { claimBattleWinCoins, V2_BATTLE_WIN_COINS } from '@/constants/v2/battle';
import {
  BATTLE_ROUNDS,
  BATTLE_ROUND_SECONDS,
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
import { addLightning } from '@/services/lightningStore';
import { playSfx } from '@/services/sfx';
import { useAuth } from '@/services/studentAuthStore';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';
import { speak, stopVoice } from '@/services/voicePraise';

export { BATTLE_ROUND_SECONDS };

const MIN_POOL_SIZE = 4;
// Shuncha soniyada odam topilmasa — "Bot bilan o'ynaysizmi?" so'raladi.
export const QUEUE_WAIT_SECONDS = 30;
const NOT_FOUND = "Hozir boʻsh oʻquvchi topilmadi. Bot bilan oʻynab mashq qilishingiz yoki yana qidirishingiz mumkin.";

export type Phase = 'matching' | 'notFound' | 'playing' | 'result';
export type RoundWinner = 'player' | 'opponent' | 'draw' | null;

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

export function useBattleGame() {
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
  // G'alaba coin berdimi: null — hali aniqlanmagan, false — bugungi limit tugagan.
  const [winPaid, setWinPaid] = useState<boolean | null>(null);
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

  // Raund so'zlari — aqlli aralash (joriy dars / takrorlash kerak / eski darslar).
  const mixRef = useRef<MixContext | null>(null);
  const pickRounds = () => {
    const w = pickMix(battleWordsRef.current, BATTLE_ROUNDS, (x) => x.word, mixRef.current);
    rememberShown(w.map((x) => x.word));
    return w;
  };

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
    // Server o'yin bermasa (bo'sh javob) — soxta "raqib" bilan o'ynalmaydi.
    if (!status || !status.matchId) return notFound();
    stopPolling();
    const words = status.words && status.words.length ? status.words : pickRounds();
    setMatchId(status.matchId ?? null);
    // Haqiqiy raqibning ismi (birinchi so'zi); server bermasa — umumiy "Raqib".
    setOpponentName((status.opponentName || '').trim().split(/\s+/)[0] || 'Raqib');
    setOpponentAvatarUrl(status.opponentAvatarUrl || '');
    setRoundWords(words);
    setTotalRounds(status.totalRounds ?? words.length);
    setPlayerScore(status.scores?.me ?? 0);
    setOpponentScore(status.scores?.opponent ?? 0);
    serverRoundRef.current = status.currentRound ?? 0;
    matchFinishedRef.current = false;
    setResultNote(null);
    setWinPaid(null);
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
    setWinPaid(null);
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
      const words = pickRounds();
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
    joinBattleQueue(pickRounds())
      .then((status) => {
        if (status.status === 'waiting') startQueuePolling();
        else if (status.status === 'not_found') notFound();
        else enterMatch(status);
      })
      .catch(() => notFound('Hozircha bu funksiya ishlamayapti. Birozdan soʻng qayta urinib koʻring.'));
  };

  // Ekran ochilganda: so'zlar yuklanadi va darhol raqib qidiriladi.
  useEffect(() => {
    wordsReady.current = Promise.all([
      getAccumulatedVocabulary().then((w) => { battleWordsRef.current = buildBattleWords(w); }),
      loadMixContext().then((c) => { mixRef.current = c; }),
    ]).then(() => {}).catch(() => {});
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
      // Kuniga faqat birinchi 3 ta g'alaba coin beradi (Toshkent sanasi).
      claimBattleWinCoins().then((ok) => {
        if (ok) addCoins(V2_BATTLE_WIN_COINS);
        setWinPaid(ok);
      }).catch(() => setWinPaid(false));
      playSfx('complete');
      speak('gameWin', 1550);
    } else if (playerScore < opponentScore) {
      playSfx('lose');
      speak('gameLose', 1050);
    }
    return () => stopVoice();
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
    playSfx(correct ? 'correct' : 'wrong');
    // Xato javob — so'z "So'z takrorlash"da ertaga chiqadi.
    if (!correct) markMistake(currentWord.word);
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


  return {
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
  };
}
