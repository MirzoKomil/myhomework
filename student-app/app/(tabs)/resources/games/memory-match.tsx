import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';

const EMOJIS = ['🍎', '🐘', '🐯', '🐰', '🍅', '🥕', '🐸', '🐝'];

type Card = { id: number; emoji: string; revealed: boolean; matched: boolean };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(): Card[] {
  const pairs = shuffle([...EMOJIS, ...EMOJIS]);
  return pairs.map((emoji, id) => ({ id, emoji, revealed: false, matched: false }));
}

export default function MemoryMatchGame() {
  const [cards, setCards] = useState<Card[]>(buildDeck);
  const [firstPick, setFirstPick] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const matchedCount = cards.filter((c) => c.matched).length;
  const won = matchedCount === cards.length;

  const handleTap = (id: number) => {
    if (locked || won) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.revealed || card.matched) return;

    if (firstPick === null) {
      setCards((cs) => cs.map((c) => (c.id === id ? { ...c, revealed: true } : c)));
      setFirstPick(id);
      return;
    }

    const first = cards.find((c) => c.id === firstPick)!;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, revealed: true } : c)));
    setMoves((m) => m + 1);
    setLocked(true);

    if (first.emoji === card.emoji) {
      timeoutRef.current = setTimeout(() => {
        setCards((cs) => cs.map((c) => (c.id === id || c.id === firstPick ? { ...c, matched: true } : c)));
        setFirstPick(null);
        setLocked(false);
      }, 350);
    } else {
      timeoutRef.current = setTimeout(() => {
        setCards((cs) => cs.map((c) => (c.id === id || c.id === firstPick ? { ...c, revealed: false } : c)));
        setFirstPick(null);
        setLocked(false);
      }, 700);
    }
  };

  const restart = () => {
    setCards(buildDeck());
    setFirstPick(null);
    setMoves(0);
    setLocked(false);
  };

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
        </View>
      ) : (
        <View style={styles.grid}>
          {cards.map((card) => (
            <Pressable
              key={card.id}
              style={[styles.card, card.matched && styles.cardMatched]}
              onPress={() => handleTap(card.id)}>
              <Text style={styles.cardText}>{card.revealed || card.matched ? card.emoji : '❔'}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  statsText: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, justifyContent: 'center' },
  card: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  cardMatched: { backgroundColor: theme.colors.successBg },
  cardText: { fontSize: 30 },
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
