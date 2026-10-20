/**
 * v2 Grammatika ro'yxati (dizayn: 31 GrammarList).
 *
 * Mavzular — CRM'dagi kutubxona grammatikasi (mc.library.grammar, eski
 * resources/library/grammar bilan bir xil manba). Mavzuda darsga havola
 * yo'q, shuning uchun darslar nom bo'yicha topiladi; "o'rganilgan" — o'sha
 * darslar videosi ko'rilganmi (lessonProgressStore), bir qismi ko'rilgan
 * bo'lsa — "Qisman oʻrganilgan" halqasi. O'rganilmagan qatorda belgi yo'q
 * (dizayndagidek); qator bosilsa mavzu ochiladi.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

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
import { loadGrammarRows, type GrammarRow as Row } from '@/components/v2/library/grammar';
import type { LessonRef } from '@/components/v2/library/shared';
import { DGrammarList } from '@/components/v2/desktop/library/DGrammarList';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';

// Kompyuterda (keng oyna) — dizayndagi D_ versiya; telefonda mobil ekran o'zgarmaydi.
export default function GrammarListScreen() {
  return useIsDesktop() ? <DGrammarList /> : <GrammarListScreenMobile />;
}

function GrammarListScreenMobile() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Row[]>([]);
  const [related, setRelated] = useState<Row | null>(null);
  const [today, setToday] = useState<LessonRef | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadGrammarRows()
        .then((d) => {
          if (!alive) return;
          setRows(d.rows);
          setRelated(d.related);
          setToday(d.today);
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
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: Math.max(insets.top, 44) + 10, paddingBottom: insets.bottom + 34 }} showsVerticalScrollIndicator={false}>
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
                  {today ? `${today.lesson.name} · ${today.number}-dars` : related.topic.title}
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
                <View style={[styles.code, { backgroundColor: r.learned ? '#E3F7EE' : r.part > 0 ? '#FFF4D1' : '#EEF1F7' }]}>
                  <T w={800} size={13} color={r.learned ? '#075E3A' : r.part > 0 ? '#7A5300' : '#4A5468'}>{r.code}</T>
                </View>
                <T w={800} size={15} lh={1.3} style={{ flex: 1, minWidth: 0 }}>{r.topic.title}</T>
                <T w={700} size={12} color="#5B6478" numberOfLines={1} style={{ flexShrink: 0 }}>{r.where}</T>
                {r.learned ? (
                  <View accessibilityLabel="Oʻrganilgan" style={styles.done}>
                    <Check />
                  </View>
                ) : r.part > 0 ? (
                  <PartRing part={r.part} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Column>
    </ScrollView>
  );
}

/** "Qisman oʻrganilgan": kulrang halqada yashil ulush (dizayndagi conic-gradient). */
function PartRing({ part }: { part: number }) {
  const a = Math.min(0.999, part) * 2 * Math.PI;
  const x = 13 + 13 * Math.sin(a);
  const y = 13 - 13 * Math.cos(a);
  return (
    <View accessibilityLabel="Qisman oʻrganilgan" style={{ width: 26, height: 26, flexShrink: 0 }}>
      <Svg width={26} height={26} viewBox="0 0 26 26">
        <Circle cx={13} cy={13} r={13} fill="#E4E8F0" />
        <Path d={`M13 13 L13 0 A13 13 0 ${a > Math.PI ? 1 : 0} 1 ${x} ${y} Z`} fill="#087A4A" />
        <Circle cx={13} cy={13} r={8} fill="#FFFFFF" />
      </Svg>
    </View>
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
