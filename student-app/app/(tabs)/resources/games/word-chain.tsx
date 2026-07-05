import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { addCoins } from '@/services/coinsStore';

const WORD_BANK = [
  'apple', 'elephant', 'tiger', 'rabbit', 'tomato', 'orange', 'egg', 'grape', 'eagle', 'ant',
  'nest', 'table', 'engine', 'ear', 'rain', 'nose', 'ever', 'river', 'rope', 'exit',
  'tea', 'apron', 'note', 'evening', 'garden', 'name', 'east', 'time', 'echo', 'ocean',
  'nut', 'toy', 'yellow', 'window', 'water', 'road', 'day', 'yard', 'door', 'red',
  'dog', 'game', 'egg', 'gold', 'dream', 'moon', 'nine', 'earth', 'hand', 'dance',
];

const START_WORD = 'radio';

export default function WordChainGame() {
  const [chain, setChain] = useState<string[]>([START_WORD]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const lastWord = chain[chain.length - 1];
  const requiredLetter = lastWord.slice(-1).toUpperCase();

  const submit = () => {
    const word = input.trim().toLowerCase();
    if (!word) return;

    if (word[0] !== lastWord.slice(-1).toLowerCase()) {
      setError(`So'z "${requiredLetter}" harfi bilan boshlanishi kerak`);
      return;
    }
    if (!WORD_BANK.includes(word)) {
      setError("Bu so'z ro'yxatda yo'q, boshqasini urinib ko'ring");
      return;
    }
    if (chain.includes(word)) {
      setError("Bu so'z allaqachon ishlatilgan");
      return;
    }
    addCoins(1);
    setChain((c) => [...c, word]);
    setInput('');
    setError(null);
  };

  const restart = () => {
    setChain([START_WORD]);
    setInput('');
    setError(null);
    setFinished(false);
  };

  const score = chain.length - 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="So'nggi harf" showBack />
      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>Zanjir uzunligi</Text>
        <Text style={styles.scoreValue}>{score}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.chainScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.chainWrap}>
          {chain.map((w, i) => (
            <View key={`${w}-${i}`} style={styles.wordBubble}>
              <Text style={styles.wordText}>{w}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {!finished ? (
        <View style={styles.inputBar}>
          <Text style={styles.hint}>
            Keyingi so'z <Text style={styles.hintLetter}>{requiredLetter}</Text> harfi bilan boshlanishi kerak
          </Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="So'z yozing..."
              placeholderTextColor={theme.colors.textLight}
              value={input}
              onChangeText={(t) => {
                setInput(t);
                setError(null);
              }}
              autoCapitalize="none"
              onSubmitEditing={submit}
            />
            <Pressable style={styles.submitBtn} onPress={submit}>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
          </View>
          <Pressable style={styles.finishBtn} onPress={() => setFinished(true)}>
            <Text style={styles.finishText}>Yakunlash</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.resultWrap}>
          <Text style={styles.resultEmoji}>🏆</Text>
          <Text style={styles.resultTitle}>Natija: {score}</Text>
          <Pressable style={styles.restartBtn} onPress={restart}>
            <Text style={styles.restartText}>Qaytadan boshlash</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  scoreLabel: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted },
  scoreValue: { fontFamily: theme.fonts.extraBold, fontSize: 20, color: theme.colors.purple },
  chainScroll: { flexGrow: 1, padding: 20, paddingTop: 8 },
  chainWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wordBubble: {
    backgroundColor: theme.colors.purpleLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  wordText: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.purple },
  inputBar: { padding: 20, paddingTop: 8 },
  hint: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted, marginBottom: 8 },
  hintLetter: { fontFamily: theme.fonts.extraBold, color: theme.colors.purple, fontSize: 15 },
  errorText: { fontFamily: theme.fonts.medium, fontSize: 12, color: theme.colors.danger, marginBottom: 8 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
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
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishBtn: { alignItems: 'center', paddingVertical: 10 },
  finishText: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.textMuted },
  resultWrap: { alignItems: 'center', padding: 32 },
  resultEmoji: { fontSize: 48, marginBottom: 12 },
  resultTitle: { fontFamily: theme.fonts.extraBold, fontSize: 22, color: theme.colors.text, marginBottom: 20 },
  restartBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  restartText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});
