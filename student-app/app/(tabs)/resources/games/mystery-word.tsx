import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { addCoins } from '@/services/coinsStore';

const WORDS = ['apple', 'grape', 'house', 'water', 'plant', 'chair', 'brave', 'smile', 'dance', 'light'];
const WORD_LENGTH = 5;
const MAX_TRIES = 6;

type LetterStatus = 'correct' | 'present' | 'absent';

function evaluateGuess(guess: string, answer: string): LetterStatus[] {
  const result: LetterStatus[] = new Array(WORD_LENGTH).fill('absent');
  const answerLetters = answer.split('');
  const used = new Array(WORD_LENGTH).fill(false);

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answerLetters[i]) {
      result[i] = 'correct';
      used[i] = true;
    }
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'correct') continue;
    const idx = answerLetters.findIndex((l, j) => l === guess[i] && !used[j]);
    if (idx !== -1) {
      result[i] = 'present';
      used[idx] = true;
    }
  }
  return result;
}

function pickAnswer() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

export default function MysteryWordGame() {
  const [answer, setAnswer] = useState(pickAnswer);
  const [guesses, setGuesses] = useState<{ word: string; statuses: LetterStatus[] }[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState<'won' | 'lost' | null>(null);

  const submit = () => {
    const word = input.trim().toLowerCase();
    if (word.length !== WORD_LENGTH || !/^[a-z]+$/.test(word)) {
      setError(`${WORD_LENGTH} harfli so'z kiriting`);
      return;
    }
    const statuses = evaluateGuess(word, answer);
    const nextGuesses = [...guesses, { word, statuses }];
    setGuesses(nextGuesses);
    setInput('');
    setError(null);

    if (word === answer) {
      addCoins(1);
      setGameOver('won');
    } else if (nextGuesses.length >= MAX_TRIES) {
      setGameOver('lost');
    }
  };

  const restart = () => {
    setAnswer(pickAnswer());
    setGuesses([]);
    setInput('');
    setError(null);
    setGameOver(null);
  };

  const statusColor = (s: LetterStatus) =>
    s === 'correct' ? theme.colors.success : s === 'present' ? theme.colors.warning : theme.colors.textLight;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Sirli So'z" showBack />
      <View style={styles.board}>
        {guesses.map((g, gi) => (
          <View key={gi} style={styles.row}>
            {g.word.split('').map((letter, li) => (
              <View key={li} style={[styles.cell, { backgroundColor: statusColor(g.statuses[li]) }]}>
                <Text style={styles.cellText}>{letter.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        ))}
        {!gameOver &&
          Array.from({ length: MAX_TRIES - guesses.length }).map((_, ri) => (
            <View key={`empty-${ri}`} style={styles.row}>
              {Array.from({ length: WORD_LENGTH }).map((__, ci) => (
                <View key={ci} style={styles.cellEmpty} />
              ))}
            </View>
          ))}
      </View>

      {!gameOver ? (
        <View style={styles.inputBar}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={`${WORD_LENGTH} harfli so'z...`}
              placeholderTextColor={theme.colors.textLight}
              value={input}
              onChangeText={(t) => {
                setInput(t);
                setError(null);
              }}
              maxLength={WORD_LENGTH}
              autoCapitalize="none"
              onSubmitEditing={submit}
            />
            <Pressable style={styles.submitBtn} onPress={submit}>
              <Text style={styles.submitText}>Tekshirish</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.resultWrap}>
          <Text style={styles.resultEmoji}>{gameOver === 'won' ? '🎉' : '😔'}</Text>
          <Text style={styles.resultTitle}>{gameOver === 'won' ? "Topdingiz!" : "Afsus, sinab ko'ring"}</Text>
          <Text style={styles.resultSub}>Javob: {answer.toUpperCase()}</Text>
          <Pressable style={styles.restartBtn} onPress={restart}>
            <Text style={styles.restartText}>Qaytadan o'ynash</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  board: { alignItems: 'center', paddingTop: 12, gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  cell: { width: 46, height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontFamily: theme.fonts.extraBold, fontSize: 18, color: '#fff' },
  cellEmpty: {
    width: 46,
    height: 46,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  inputBar: { padding: 20 },
  errorText: { fontFamily: theme.fonts.medium, fontSize: 12, color: theme.colors.danger, marginBottom: 8, textAlign: 'center' },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    color: theme.colors.text,
    ...theme.shadow.card,
  },
  submitBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontFamily: theme.fonts.bold, fontSize: 13, color: '#fff' },
  resultWrap: { alignItems: 'center', padding: 32 },
  resultEmoji: { fontSize: 48, marginBottom: 12 },
  resultTitle: { fontFamily: theme.fonts.extraBold, fontSize: 20, color: theme.colors.text, marginBottom: 6 },
  resultSub: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted, marginBottom: 20 },
  restartBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  restartText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});
