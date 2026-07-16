import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CelebrationOverlay } from '@/components/ui/CelebrationOverlay';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { addCoins } from '@/services/coinsStore';
import { addLightning } from '@/services/lightningStore';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

// O'quvchining lug'atida yetarli so'z topilmasa ishlatiladigan zaxira juftliklar.
const FALLBACK_PAIRS: [string, string][] = [
  ['apple', 'olma'], ['elephant', 'fil'], ['tiger', 'yo\'lbars'], ['rabbit', 'quyon'],
  ['tomato', 'pomidor'], ['carrot', 'sabzi'], ['frog', 'qurbaqa'], ['bee', 'ari'],
];
const PAIR_COUNT = 8;
const MIN_POOL_SIZE = 6;

type Card = { id: number; pairId: string; text: string; revealed: boolean; matched: boolean };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(pairs: [string, string][]): Card[] {
  const cards: Omit<Card, 'id'>[] = [];
  pairs.forEach(([en, uz], i) => {
    const pairId = `${i}-${en}`;
    cards.push({ pairId, text: en, revealed: false, matched: false });
    cards.push({ pairId, text: uz, revealed: false, matched: false });
  });
  return shuffle(cards).map((c, id) => ({ ...c, id }));
}

export default function MemoryMatchGame() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [firstPick, setFirstPick] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pairsRef = useRef<[string, string][]>(FALLBACK_PAIRS);

  useEffect(() => {
    let cancelled = false;
    getAccumulatedVocabulary().then((words) => {
      if (cancelled) return;
      const uniq = new Map<string, string>();
      for (const w of words) {
        const key = w.english.toLowerCase();
        if (!uniq.has(key)) uniq.set(key, w.translation);
      }
      const pool: [string, string][] = Array.from(uniq.entries());
      const source = pool.length >= MIN_POOL_SIZE ? pool : FALLBACK_PAIRS;
      const picked = shuffle(source).slice(0, PAIR_COUNT);
      pairsRef.current = picked;
      setCards(buildDeck(picked));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const matchedCount = cards?.filter((c) => c.matched).length ?? 0;
  const won = cards !== null && matchedCount === cards.length;

  const handleTap = (id: number) => {
    if (locked || won || !cards) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.revealed || card.matched) return;

    if (firstPick === null) {
      setCards((cs) => cs!.map((c) => (c.id === id ? { ...c, revealed: true } : c)));
      setFirstPick(id);
      return;
    }

    const first = cards.find((c) => c.id === firstPick)!;
    setCards((cs) => cs!.map((c) => (c.id === id ? { ...c, revealed: true } : c)));
    setMoves((m) => m + 1);
    setLocked(true);

    if (first.pairId === card.pairId) {
      addCoins(1);
      addLightning(1);
      timeoutRef.current = setTimeout(() => {
        setCards((cs) => cs!.map((c) => (c.id === id || c.id === firstPick ? { ...c, matched: true } : c)));
        setFirstPick(null);
        setLocked(false);
      }, 350);
    } else {
      timeoutRef.current = setTimeout(() => {
        setCards((cs) => cs!.map((c) => (c.id === id || c.id === firstPick ? { ...c, revealed: false } : c)));
        setFirstPick(null);
        setLocked(false);
      }, 700);
    }
  };

  const restart = () => {
    setCards(buildDeck(pairsRef.current));
    setFirstPick(null);
    setMoves(0);
    setLocked(false);
  };

  if (!cards) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="Esla-Mosla" showBack />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Esla-Mosla" showBack />
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>Yurishlar: {moves}</Text>
        <Text style={styles.statsText}>
          Topilgan: {matchedCount / 2} / {cards.length / 2}
        </Text>
      </View>

      {won ? (
        <View style={styles.resultWrap}>
          <Text style={styles.resultEmoji}>🎉</Text>
          <Text style={styles.resultTitle}>Barchasi topildi!</Text>
          <Text style={styles.resultSub}>{moves} ta yurishda yakunladingiz</Text>
          <Pressable style={styles.restartBtn} onPress={restart}>
            <Text style={styles.restartText}>Qaytadan o'ynash</Text>
          </Pressable>
          <CelebrationOverlay visible={won} />
        </View>
      ) : (
        <View style={styles.grid}>
          {cards.map((card) => (
            <Pressable
              key={card.id}
              style={[styles.card, card.matched && styles.cardMatched]}
              onPress={() => handleTap(card.id)}>
              <Text style={styles.cardText} numberOfLines={2} adjustsFontSizeToFit>
                {card.revealed || card.matched ? card.text : '❔'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  statsText: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, justifyContent: 'center' },
  card: {
    width: 84,
    height: 64,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    ...theme.shadow.card,
  },
  cardMatched: { backgroundColor: theme.colors.successBg },
  cardText: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text, textAlign: 'center' },
  resultWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  resultEmoji: { fontSize: 56, marginBottom: 14 },
  resultTitle: { fontFamily: theme.fonts.extraBold, fontSize: 22, color: theme.colors.text, marginBottom: 6 },
  resultSub: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted, marginBottom: 24 },
  restartBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  restartText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});
