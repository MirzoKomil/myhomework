import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { VocabWordSheet } from '@/components/VocabWordSheet';
import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import { getResolvedLessonContent, LessonContent, VocabWord, VOCAB_PRACTICE_SIZE } from '@/data/lessonContent';
import { markDone, useLessonProgress } from '@/services/lessonProgressStore';
import { saveLastPosition } from '@/services/progressStore';

export default function VocabularyListScreen() {
  const { t } = useLang();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const [content, setContent] = useState<LessonContent | null>(null);
  const [selectedWord, setSelectedWord] = useState<VocabWord | null>(null);
  const progress = useLessonProgress(String(lessonId));

  useEffect(() => {
    getResolvedLessonContent(String(lessonId), 0).then(setContent);
  }, [lessonId]);

  useEffect(() => {
    markDone(String(lessonId), 'vocabList');
    saveLastPosition({ lessonId: String(lessonId), section: 'vocabulary/list', label: t('res_words_title') });
  }, [lessonId]);

  if (!content) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={t('res_words_title')} showBack />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  // 58-vazifa: "Lug'at mashqlari" (vocabulary/practice.tsz) — noto'g'ri
  // javob berilgan so'zni navbat oxiriga qo'shib, to'g'ri javob berilgunicha
  // qayta-qayta so'raydi (3 bosqichning har birida) — shu sababli mashq
  // TUGAGAN bo'lsa, birinchi VOCAB_PRACTICE_SIZE ta so'zning HAMMASI
  // kamida bir marta to'g'ri o'zlashtirilgan bo'ladi (alohida so'z-bo'yicha
  // kuzatuv shart emas).
  const isMastered = (index: number) => progress.vocabPractice && index < VOCAB_PRACTICE_SIZE;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="So'zlar ro'yxati" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{content.vocabulary.length} {t('hw_cat_vocab_sub_suffix')}</Text>
        {content.vocabulary.map((word, index) => {
          const mastered = isMastered(index);
          return (
            <Pressable key={word.id} onPress={() => setSelectedWord(word)}>
              <Card style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.iconWrap}>
                    {word.imageUrl ? (
                      <Image source={{ uri: word.imageUrl }} style={styles.wordImage} resizeMode="cover" />
                    ) : (
                      <Ionicons name={word.icon} size={26} color={theme.colors.purple} />
                    )}
                  </View>
                  <View style={styles.info}>
                    <View style={styles.headRow}>
                      <Text style={styles.english}>{word.english}</Text>
                      <Ionicons
                        name={mastered ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={mastered ? theme.colors.success : theme.colors.textLight}
                      />
                    </View>
                    <Text style={styles.transcript}>{word.transcript}</Text>
                    <Text style={styles.translation}>{word.translation}</Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
      <VocabWordSheet word={selectedWord} lang={content.lang} onClose={() => setSelectedWord(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 40, gap: 10 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginBottom: 4 },
  card: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  wordImage: { width: '100%', height: '100%' },
  info: { flex: 1 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  english: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text },
  transcript: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textLight, marginTop: 1 },
  translation: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.purple, marginTop: 2 },
});
