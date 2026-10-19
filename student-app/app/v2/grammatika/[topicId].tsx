/**
 * v2 Grammatika mavzusi (dizayn: 32 Grammar).
 *
 * Kontent — CRM'dagi mavzu (title, formula, description, examples). Dizayndagi
 * tuslanish jadvali, rangli misol yorliqlari va "Tipik xato" bloki uchun
 * mavzu turida maydon yo'q: jadval kartasida formula + tushuntirish,
 * misollar kartalarida real misollar ko'rsatiladi; "Tipik xato" ma'lumot
 * bo'lmagani uchun ko'rsatilmaydi.
 */
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadGrammarRows, type GrammarRow } from '@/components/v2/library/grammar';
import { BackButton, Check, Column, Display, go, PlayRounded, T } from '@/components/v2/library/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';

export default function GrammarTopicScreen() {
  const insets = useSafeAreaInsets();
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const [row, setRow] = useState<GrammarRow | null>(null);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadGrammarRows()
        .then((d) => {
          if (!alive) return;
          setRow(d.rows.find((r) => r.topic.id === topicId) ?? null);
          setTotal(d.rows.length);
        })
        .catch(() => {})
        .finally(() => alive && setLoaded(true));
      return () => {
        alive = false;
      };
    }, [topicId]),
  );

  if (!row) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
        <Column style={{ paddingHorizontal: 20, gap: 16 }}>
          <BackButton fallback={R.grammarList} />
          {loaded && <T w={700} size={15} color="#4A5468">Mavzu topilmadi</T>}
        </Column>
      </View>
    );
  }

  const { topic, lesson, learned, code } = row;
  const examples = topic.examples ?? [];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(insets.top, 44) + 10 }} showsVerticalScrollIndicator={false}>
        <Column>
          <View style={styles.top}>
            <View style={styles.headRow}>
              <BackButton fallback={R.grammarList} />
              <T w={800} size={13} color="#4A5468" style={{ flex: 1 }}>Maʼlumotnoma · {code} / {total}</T>
              {learned && (
                <View style={styles.learned}>
                  <Check size={14} color="#075E3A" sw={3} />
                  <T w={800} size={12} color="#075E3A">Oʻrganilgan</T>
                </View>
              )}
            </View>
            <View style={styles.hero}>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                {lesson && (
                  <View style={styles.lessonPill}>
                    <T w={800} size={12} color="#0B1220">{lesson.number}-dars</T>
                  </View>
                )}
                <Display size={24} ls={-0.01} color="#FFFFFF">{lesson?.lesson.name || topic.title}</Display>
                {!!topic.formula && (
                  <T w={700} size={13} color="#FFFFFF" lh={1.35}>{topic.formula}</T>
                )}
              </View>
              <View style={styles.heroImgBox}>
                <Image source={designImages['f639c30e1400761df83230b833ba42b2']} style={{ width: 72, height: 72 }} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
              </View>
            </View>
          </View>

          <View style={styles.body}>
            {(!!topic.description || !!topic.formula) && (
              <View style={styles.tableCard}>
                <T w={800} size={12} color="#4A5468" style={{ paddingTop: 2, paddingBottom: 6 }}>{topic.title}</T>
                {!!topic.description && (
                  <View style={styles.tableRow}>
                    <T w={700} size={14.5} lh={1.45}>{topic.description}</T>
                  </View>
                )}
              </View>
            )}

            {examples.length > 0 && (
              <View style={styles.grid}>
                {examples.map((ex, i) => (
                  <View key={i} style={styles.exCard}>
                    <T w={800} size={15}>{ex.en}</T>
                    <T w={600} size={12} color="#4A5468" lh={1.35}>{ex.uz}</T>
                  </View>
                ))}
              </View>
            )}
            {!topic.description && !examples.length && (
              <T w={600} size={14} color="#4A5468">Bu mavzu tez orada toʻldiriladi</T>
            )}
          </View>
        </Column>
      </ScrollView>

      {lesson && (
        <Column style={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: insets.bottom + 34 }}>
          <Pressable accessibilityRole="button" onPress={() => go(R.video(lesson.lesson.id))} style={({ pressed }) => [styles.cta, pressed && { backgroundColor: '#1E3FD1' }]}>
            <PlayRounded size={20} />
            <T w={800} size={17} color="#FFFFFF">Darsga oʻtish · {lesson.number}-dars</T>
          </Pressable>
        </Column>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6FA' },
  top: { paddingHorizontal: 20, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  learned: { height: 32, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#E3F7EE', flexDirection: 'row', alignItems: 'center', gap: 5 },
  hero: { backgroundColor: '#2F5BFF', borderRadius: 24, paddingVertical: 12, paddingRight: 12, paddingLeft: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  lessonPill: { alignSelf: 'flex-start', backgroundColor: '#FFC93C', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8 },
  heroImgBox: { width: 80, height: 80, borderRadius: 18, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  body: { paddingTop: 12, paddingHorizontal: 20, gap: 10, paddingBottom: 8 },
  tableCard: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingTop: 10, paddingHorizontal: 14, paddingBottom: 8 },
  tableRow: { borderTopWidth: 1, borderTopColor: '#EEF1F7', paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  exCard: { width: '48.5%', flexGrow: 1, flexBasis: '45%', backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  cta: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
