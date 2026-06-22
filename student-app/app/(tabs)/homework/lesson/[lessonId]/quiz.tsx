import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';

const options = [
  { id: 'a', label: 'Archery', correct: true },
  { id: 'b', label: 'Camping', correct: false },
  { id: 'c', label: 'Painting', correct: false },
  { id: 'd', label: 'Travel', correct: false },
];

export default function QuizScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);

  const handleSelect = (id: string) => {
    if (answered) return;
    setSelected(id);
    setAnswered(true);
  };

  const isCorrect = options.find((o) => o.id === selected)?.correct;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Round 1</Text>
        <Text style={styles.progress}>3 / 7</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '43%' }]} />
      </View>

      <View style={styles.content}>
        <Text style={styles.instruction}>To'g'ri rasmni tanlang</Text>

        <View style={styles.questionCard}>
          <Text style={styles.word}>Archery</Text>
          <Text style={styles.phonetic}>/ˈɑːrtʃəri/</Text>
          <Pressable style={styles.speakerBtn}>
            <Ionicons name="volume-high" size={20} color={theme.colors.purple} />
          </Pressable>
        </View>

        <View style={styles.grid}>
          {options.map((opt) => {
            const isSelected = selected === opt.id;
            const showResult = answered && isSelected;
            return (
              <Pressable
                key={opt.id}
                style={[
                  styles.option,
                  isSelected && styles.optionSelected,
                  showResult && (opt.correct ? styles.optionCorrect : styles.optionWrong),
                ]}
                onPress={() => handleSelect(opt.id)}>
                <Ionicons
                  name={opt.correct ? 'bowling-ball' : 'image'}
                  size={40}
                  color={theme.colors.textMuted}
                />
                <Text style={styles.optionLabel}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {answered && (
        <View style={[styles.footer, isCorrect ? styles.footerCorrect : styles.footerWrong]}>
          <Ionicons
            name={isCorrect ? 'checkmark-circle' : 'close-circle'}
            size={22}
            color="#fff"
          />
          <Text style={styles.footerText}>
            {isCorrect ? "To'g'ri javob!" : "Noto'g'ri, qayta urinib ko'ring"}
          </Text>
          <Pressable style={styles.nextBtn} onPress={() => router.back()}>
            <Text style={styles.nextText}>Keyingi</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text },
  progress: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted },
  progressBar: { height: 4, backgroundColor: theme.colors.border, marginHorizontal: 20 },
  progressFill: { height: 4, backgroundColor: theme.colors.purple, borderRadius: 2 },
  content: { flex: 1, padding: 20 },
  instruction: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginBottom: 16 },
  questionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    ...theme.shadow.card,
  },
  word: { fontFamily: theme.fonts.extraBold, fontSize: 28, color: theme.colors.text },
  phonetic: { fontFamily: theme.fonts.regular, fontSize: 15, color: theme.colors.textMuted, marginTop: 4 },
  speakerBtn: {
    marginTop: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  option: {
    width: '47%',
    aspectRatio: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadow.card,
  },
  optionSelected: { borderColor: theme.colors.purple },
  optionCorrect: { borderColor: theme.colors.success, backgroundColor: theme.colors.successBg },
  optionWrong: { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerBg },
  optionLabel: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted, marginTop: 8 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },
  footerCorrect: { backgroundColor: theme.colors.success },
  footerWrong: { backgroundColor: theme.colors.danger },
  footerText: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: 14, color: '#fff' },
  nextBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  nextText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
});
