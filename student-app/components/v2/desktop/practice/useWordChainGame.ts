/**
 * So'nggi harf o'yini holati va qoidalari — telefon (app/v2/mashq/songgi-harf.tsx)
 * va kompyuter (DWordChain) ekranlari uchun bitta manba.
 *
 * Sabab: ikki ko'rinishda qoidalar, ball, coin/chaqmoq va ovozlar bir xil
 * bo'lishi shart — mantiq telefon ekranidan o'zgarishsiz ko'chirildi,
 * faqat joylashuv (JSX) har ekranning o'zida qoldi.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollView } from 'react-native';

import { plainWord, saveRecords, useCurrentLesson, useRecords } from '@/components/v2/practice/shared';
import { loadMixContext, pickMix, rememberShown, type MixContext } from '@/components/v2/practice/wordMix';
import COMMON_ENGLISH_WORDS from '@/data/commonEnglishWords.json';
import COMMON_RUSSIAN_WORDS from '@/data/commonRussianWords.json';
import { useLang } from '@/i18n/LanguageContext';
import { addCoins, getTotalCoins } from '@/services/coinsStore';
import { addLightning } from '@/services/lightningStore';
import { playSfx } from '@/services/sfx';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

export const TURN_SECONDS = 15;
export const HINT_PRICE = 10;
const MIN_BANK_SIZE = 5;

// Rus tilida ь/ъ/ы bilan boshlanadigan so'z yo'q — zanjir tiqilib qolmasligi
// uchun bunday harf bilan tugagan so'zda undan oldingi harf olinadi.
export function chainLetterIndex(word: string, isRu: boolean) {
  let i = word.length - 1;
  while (isRu && i > 0 && 'ьъы'.includes(word[i])) i--;
  return i;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function useWordChainGame() {
  const { courseLang } = useLang();
  const isRu = courseLang === 'russian';
  const lesson = useCurrentLesson();
  const { rec, reload } = useRecords();

  const [bank, setBank] = useState<string[] | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  // Urg'usiz kalit → kontentdagi asl yozilish (urg'u bilan bo'lsa ham).
  const [display, setDisplay] = useState<Record<string, string>>({});
  const [chain, setChain] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [finished, setFinished] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const letterRe = isRu ? /^[а-яё]+$/i : /^[a-z]+$/;

  // Boshlang'ich so'z — aqlli aralash (joriy dars / takrorlash / eski darslar).
  const mixRef = useRef<MixContext | null>(null);
  const vocabRef = useRef<string[]>([]);
  const startWord = (vocab: string[], all: string[]) => {
    const w = vocab.length >= MIN_BANK_SIZE ? pickMix(vocab, 1, (x) => x, mixRef.current)[0] : undefined;
    if (w) rememberShown([w]);
    return w ?? pick(vocab.length >= MIN_BANK_SIZE ? vocab : all);
  };

  useEffect(() => {
    let off = false;
    const common = (isRu ? COMMON_RUSSIAN_WORDS : COMMON_ENGLISH_WORDS) as string[];
    Promise.all([getAccumulatedVocabulary().catch(() => []), loadMixContext().catch(() => null)])
      .then(([words, ctx]) => {
        if (off) return;
        mixRef.current = ctx;
        const tr: Record<string, string> = {};
        const disp: Record<string, string> = {};
        const vocab: string[] = [];
        for (const w of words) {
          const orig = w.english.toLowerCase();
          const k = plainWord(orig);
          if (letterRe.test(k)) {
            vocab.push(k);
            tr[k] = w.translation;
            disp[k] = orig;
          }
        }
        const all = Array.from(new Set([...vocab, ...common]));
        setTranslations(tr);
        setDisplay(disp);
        setBank(all);
        vocabRef.current = vocab;
        setChain([startWord(vocab, all)]);
      });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRu]);

  // Joriy dars so'zlari (×2 ball).
  const lessonDisplay = useMemo(
    () => (lesson?.vocab ?? []).map((w) => w.english.toLowerCase()).filter((w) => letterRe.test(plainWord(w))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lesson, isRu],
  );
  const lessonWords = useMemo(
    () => lessonDisplay.map(plainWord),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lessonDisplay],
  );

  const last = chain[chain.length - 1] ?? '';
  const letter = last ? last[chainLetterIndex(last, isRu)] : '';

  // Navbat taymeri: har yangi so'zda qaytadan boshlanadi, tugasa o'yin tugaydi.
  useEffect(() => {
    if (!bank || finished || !chain.length) return;
    setTimeLeft(TURN_SECONDS);
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [chain.length, bank, finished]);

  useEffect(() => {
    if (timeLeft === 0 && !finished && bank) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // Natija oynasi uchun: shu o'yindagi chaqmoq va o'yindan oldingi rekord.
  const [bolts, setBolts] = useState(0);
  const [recordBefore, setRecordBefore] = useState(0);
  const finish = () => {
    setRecordBefore(rec.wordChain);
    setFinished(true);
    if (score > 0) playSfx('complete');
    else playSfx('lose');
    if (score > rec.wordChain) saveRecords({ wordChain: score }).then(reload);
  };

  const accept = (word: string, points: number) => {
    setChain((c) => [...c, word]);
    setInput('');
    setError(null);
    if (points > 0) {
      setScore((s) => s + points);
      addCoins(points);
      addLightning(1);
      setBolts((b) => b + 1);
    }
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const submit = () => {
    if (finished || !bank) return;
    const word = plainWord(letter + input.trim()).toLowerCase();
    if (word.length < 2) return;
    if (!bank.includes(word)) {
      playSfx('wrong');
      return setError("Bu so'z ro'yxatda yo'q, boshqasini urinib ko'ring");
    }
    if (chain.includes(word)) return setError("Bu so'z allaqachon ishlatilgan");
    playSfx('correct');
    accept(word, lessonWords.includes(word) ? 2 : 1);
  };

  const candidates = () => (bank ?? []).filter((w) => w[0] === letter && !chain.includes(w));

  const useHelp = async () => {
    if (finished) return;
    const options = candidates();
    if (!options.length) return setError("Bu harfga so'z qolmadi — oʻtkazib yuboring");
    if (getTotalCoins() < HINT_PRICE) return setError(`Maslahat uchun ${HINT_PRICE} coin kerak`);
    await addCoins(-HINT_PRICE);
    setInput(pick(options).slice(1));
    setError(null);
  };

  const skip = () => {
    if (finished || !bank) return;
    const options = candidates();
    accept(options.length ? pick(options) : pick(bank.filter((w) => !chain.includes(w))), 0);
  };

  const restart = () => {
    if (!bank) return;
    setChain([startWord(vocabRef.current, bank)]);
    setScore(0);
    setBolts(0);
    setInput('');
    setError(null);
    setFinished(false);
  };

  const record = Math.max(rec.wordChain, finished ? score : 0);

  return {
    isRu,
    lesson,
    bank,
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
  };
}
