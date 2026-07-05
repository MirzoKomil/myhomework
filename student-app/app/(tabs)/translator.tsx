import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';

type Direction = 'en-uz' | 'uz-en';

const LANG_LABEL: Record<Direction, { from: string; to: string; pair: string }> = {
  'en-uz': { from: 'English', to: 'O\'zbekcha', pair: 'en|uz' },
  'uz-en': { from: 'O\'zbekcha', to: 'English', pair: 'uz|en' },
};

async function translateText(text: string, pair: string): Promise<string> {
  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`
  );
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (!translated) throw new Error('empty translation');
  return translated;
}

export default function TranslatorScreen() {
  const [direction, setDirection] = useState<Direction>('en-uz');
  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const labels = LANG_LABEL[direction];

  const handleSwap = () => {
    setDirection((d) => (d === 'en-uz' ? 'uz-en' : 'en-uz'));
    setSourceText(targetText);
    setTargetText(sourceText);
    setError(null);
  };

  const handleTranslate = async () => {
    if (!sourceText.trim() || loading) return;
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const result = await translateText(sourceText.trim(), labels.pair);
      setTargetText(result);
    } catch {
      setError('Tarjima qilishda xatolik yuz berdi. Internetni tekshirib qayta urining.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!targetText) return;
    await Clipboard.setStringAsync(targetText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Tarjimon" showBack />
      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.langLabel}>{labels.from}</Text>
          <TextInput
            style={styles.input}
            placeholder="Matn kiriting"
            placeholderTextColor={theme.colors.textLight}
            multiline
            value={sourceText}
            onChangeText={(t) => {
              setSourceText(t);
              setError(null);
            }}
          />

          <View style={styles.swapRow}>
            <View style={styles.swapLine} />
            <Pressable style={styles.swapBtn} onPress={handleSwap} hitSlop={10}>
              <Ionicons name="swap-vertical" size={18} color={theme.colors.purple} />
            </Pressable>
            <View style={styles.swapLine} />
          </View>

          <View style={styles.outputHeaderRow}>
            <Text style={styles.langLabel}>{labels.to}</Text>
            {targetText ? (
              <Pressable style={styles.copyBtn} onPress={handleCopy} hitSlop={10}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={theme.colors.purple} />
                <Text style={styles.copyBtnText}>{copied ? 'Nusxalandi' : 'Nusxalash'}</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={[styles.input, styles.outputText, !targetText && styles.outputPlaceholder]}>
            {targetText || 'Tarjima shu yerda chiqadi'}
          </Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <Pressable
        style={[styles.translateBtn, !sourceText.trim() && styles.translateBtnDisabled]}
        disabled={!sourceText.trim() || loading}
        onPress={handleTranslate}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.translateBtnText}>Tarjima qilish</Text>}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scrollFlex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 20 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 20,
    ...theme.shadow.card,
  },
  langLabel: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.text, marginBottom: 12 },
  outputHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: theme.colors.purpleLight,
    marginBottom: 12,
  },
  copyBtnText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.purple },
  input: {
    fontFamily: theme.fonts.medium,
    fontSize: 16,
    color: theme.colors.text,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  outputText: { color: theme.colors.purple },
  outputPlaceholder: { color: theme.colors.textLight },
  swapRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  swapLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  swapBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: theme.colors.danger,
    marginTop: 12,
    textAlign: 'center',
  },
  translateBtn: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  translateBtnDisabled: { backgroundColor: theme.colors.purpleLight },
  translateBtnText: { fontFamily: theme.fonts.bold, fontSize: 16, color: '#fff' },
});
