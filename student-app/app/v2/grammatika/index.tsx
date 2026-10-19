/**
 * v2 Grammatika ro'yxati (dizayn: 31 GrammarList).
 *
 * Mavzular — CRM'dagi kutubxona grammatikasi (mc.library.grammar, eski
 * resources/library/grammar bilan bir xil manba). Mavzuda darsga havola
 * yo'q, shuning uchun dars nom bo'yicha topiladi; "o'rganilgan" — o'sha
 * videodars ko'rilganmi (lessonProgressStore).
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BackButton,
  Check,
  ChevronRight,
  Column,
  Display,
  go,
  T,
} from '@/components/v2/library/shared';
import { R } from '@/constants/v2/routes';
import { lessonMonth, loadGrammarRows, type GrammarRow as Row } from '@/components/v2/library/grammar';

export default function GrammarListScreen() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Row[]>([]);
  const [related, setRelated] = useState<Row | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadGrammarRows()
        .then((d) => {
          if (!alive) return;
          setRows(d.rows);
          setRelated(d.related);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  const learned = rows.filter((r) => r.learned).length;
  const total = rows.length;
  const pct = total ? (learned / total) * 100 : 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 34 }} showsVerticalScrollIndicator={false}>
      <Column>
        <View style={styles.top}>
          <View style={styles.headRow}>
            <BackButton fallback={R.practice} />
            <View style={{ flex: 1 }}>
              <Display size={26}>Grammatika</Display>
              <T w={700} size={13} color="#4A5468">Maʼlumotnoma · darslik tartibida</T>
            </View>
          </View>

          {related && (
            <Pressable
              accessibilityRole="link"
              onPress={() => go(R.grammar(related.topic.id))}
              style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
            >
              <View style={[styles.code, { backgroundColor: '#FFC93C' }]}>
                <T w={800} size={13} color="#0B1220">{related.code}</T>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <T w={800} size={11} color="#FFFFFF" style={styles.upper}>Bugungi mavzu bilan bogʻliq</T>
                <T w={800} size={15} color="#FFFFFF" lh={1.3}>
                  {related.lesson ? `${related.lesson.lesson.name} · ${related.lesson.number}-dars` : related.topic.title}
                </T>
                {!!related.topic.formula && (
                  <T w={700} size={13} color="#FFFFFF" lh={1.3}>{related.topic.formula}</T>
                )}
              </View>
              <ChevronRight color="#FFFFFF" sw={2.4} />
            </Pressable>
          )}
        </View>

        <View style={styles.listWrap}>
          <View style={styles.listHead}>
            <T w={800} size={12} color="#4A5468" style={[styles.upper, { flex: 1, letterSpacing: 0.96 }]}>Barcha mavzular</T>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={`${learned} / ${total} oʻrganildi`}
              accessibilityValue={{ min: 0, max: total, now: learned }}
              style={styles.track}
            >
              <View style={[styles.fill, { width: `${pct}%` }]} />
            </View>
            <T w={800} size={13} color="#075E3A">{learned} / {total} oʻrganildi</T>
          </View>

          <View style={styles.card}>
            {rows.map((r, i) => (
              <Pressable
                key={r.topic.id}
                accessibilityRole="link"
                onPress={() => go(R.grammar(r.topic.id))}
                style={({ pressed }) => [styles.row, i < rows.length - 1 && styles.rowBorder, pressed && styles.pressed]}
              >
                <View style={[styles.code, { backgroundColor: r.learned ? '#E3F7EE' : '#EEF1F7' }]}>
                  <T w={800} size={13} color={r.learned ? '#075E3A' : '#4A5468'}>{r.code}</T>
                </View>
                <T w={800} size={15} lh={1.3} style={{ flex: 1, minWidth: 0 }}>{r.topic.title}</T>
                {r.lesson && (
                  <T w={700} size={12} color="#5B6478" style={{ flexShrink: 0 }}>
                    {r.learned ? `${lessonMonth(r.lesson.number)}-oy` : `${r.lesson.number}-dars`}
                  </T>
                )}
                {r.learned ? (
                  <View accessibilityLabel="Oʻrganilgan" style={styles.done}>
                    <Check />
                  </View>
                ) : (
                  <ChevronRight />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </Column>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6FA' },
  pressed: { opacity: 0.85 },
  upper: { textTransform: 'uppercase', letterSpacing: 0.66 },
  top: { paddingHorizontal: 20, gap: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hero: { backgroundColor: '#2F5BFF', borderRadius: 20, paddingVertical: 12, paddingLeft: 12, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  code: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  listWrap: { paddingTop: 16, paddingHorizontal: 20, gap: 10 },
  listHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  track: { width: 64, height: 8, borderRadius: 4, backgroundColor: '#E4E8F0', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#087A4A' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20 },
  row: { minHeight: 54, paddingVertical: 8, paddingLeft: 12, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  done: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#087A4A', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
