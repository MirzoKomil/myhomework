import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CelebrationOverlay } from '@/components/ui/CelebrationOverlay';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import COMMON_ENGLISH_WORDS from '@/data/commonEnglishWords.json';
import { addCoins } from '@/services/coinsStore';
import { playLoseSound, playWinSound } from '@/services/gameSounds';
import { addLightning } from '@/services/lightningStore';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

// So'z faqat o'quvchi hozircha o'rgangan ~25-75 so'zdan iborat lug'atga
// cheklansa, zanjir tez-tez tiqilib qoladi (kerakli harf bilan boshlanadigan
// so'z topilmay qoladi). Shuning uchun tekshiruv uchun ingliz tilidagi eng
// ko'p ishlatiladigan 10 000 so'zdan iborat ro'yxat (commonEnglishWords.json)
// bilan birlashtiriladi — cheklov deyarli yo'qoladi, boshlang'ich so'z esa
// baribir o'quvchining o'z lug'atidan tanlanadi.
const MIN_BANK_SIZE = 5;

export default function WordChainGame() {
  const { t } = useLang();
  const [wordBank, setWordBank] = useState<string[] | null>(null);
  const [chain, setChain] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAccumulatedVocabulary().then((words) => {
      if (cancelled) return;
      const vocabWords = words.map((w) => w.english.toLowerCase()).filter((w) => /^[a-z]+$/.test(w));
      const finalBank = Array.from(new Set([...vocabWords, ...COMMON_ENGLISH_WORDS]));
      const startPool = vocabWords.length >= MIN_BANK_SIZE ? vocabWords : finalBank;
      setWordBank(finalBank);
      setChain([startPool[Math.floor(Math.random() * startPool.length)]]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const lastWord = chain[chain.length - 1] ?? '';
  const requiredLetter = lastWord.slice(-1).toUpperCase();

  const submit = () => {
    const word = input.trim().toLowerCase();
    if (!word || !wordBank) return;

    if (word[0] !== lastWord.slice(-1).toLowerCase()) {
      setError(t('wc_error_start_letter').replace('{letter}', requiredLetter));
      return;
    }
    if (!wordBank.includes(word)) {
      setError(t('wc_error_not_in_list'));
      return;
    }
    if (chain.includes(word)) {
      setError(t('wc_error_already_used'));
      return;
    }
    addCoins(1);
    addLightning(1);
    setChain((c) => [...c, word]);
    setInput('');
    setError(null);
  };

  const restart = () => {
    if (!wordBank) return;
    setChain([wordBank[Math.floor(Math.random() * wordBank.length)]]);
    setInput('');
    setError(null);
    setFinished(false);
  };

  const score = chain.length - 1;

  const finish = () => {
    setFinished(true);
    if (score > 0) playWinSound();
    else playLoseSound();
  };

  if (!wordBank || chain.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title={t('game_word_chain_title')} showBack />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="So'nggi harf" showBack />
      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>{t('wc_chain_length')}</Text>
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
            {t('wc_hint_prefix')} <Text style={styles.hintLetter}>{requiredLetter}</Text> {t('wc_hint_suffix')}
          </Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={t('wc_placeholder')}
              placeholderTextColor={theme.colors.textLight}
              value={input}
              onChangeText={(text) => {
                setInput(text);
                setError(null);
              }}
              autoCapitalize="none"
              onSubmitEditing={submit}
            />
            <Pressable style={styles.submitBtn} onPress={submit}>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
          </View>
          <Pressable style={styles.finishBtn} onPress={finish}>
            <Text style={styles.finishText}>{t('wc_finish_btn')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.resultWrap}>
          <Text style={styles.resultEmoji}>🏆</Text>
          <Text style={styles.resultTitle}>{t('wc_result_label')} {score}</Text>
          <Pressable style={styles.restartBtn} onPress={restart}>
            <Text style={styles.restartText}>{t('wc_restart')}</Text>
          </Pressable>
          <CelebrationOverlay visible={finished && score > 0} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
