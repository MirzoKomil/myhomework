/**
 * v2 Dialoglar (dizayn: 38 DialogList).
 *
 * Mavzular — CRM kutubxonasidagi speaking dialoglari (mc.library.speaking,
 * eski resources/speaking bilan bir xil manba). Har bir mavzuda bitta
 * dialog (replikalar ro'yxati) bor — shuning uchun "1 dialog". "Bugungi
 * dars bilan bog'liq" — joriy dars nomiga mos mavzu. Eshitilgan/davom
 * etayotgan holat — AudioDialogLib ekranida qurilmada saqlangan progress.
 * Dizayndagi kabi avval 7 ta mavzu, qolgani "Yana N ta mavzu" bosilganda.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dialogCount, getDialogProgress } from '@/components/v2/library/data';
import { BackButton, Column, currentLesson, Display, FilterTabs, go, T, titlesMatch } from '@/components/v2/library/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import type { SpeakingLevel, SpeakingTopic } from '@/data/speakingTopics';
import { fetchMobileContent } from '@/services/contentApi';

type Topic = SpeakingTopic & { coverUrl?: string };
type Filter = 'all' | SpeakingLevel;

const TABS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: 'easy', label: 'Oson' },
  { key: 'medium', label: 'Oʻrta' },
  { key: 'hard', label: 'Qiyin' },
];
const LEVEL: Record<SpeakingLevel, string> = { easy: 'Oson', medium: 'Oʻrta', hard: 'Qiyin' };
// Dizayndagi plitka fon ranglari — navbat bilan.
const TILE_BG = ['#E8EEFF', '#FFF4D1', '#E3F7EE', '#FDECEC', '#F0EBFF', '#FFF1E6', '#E1F3FC'];

const openTopic = (id: string) => go(R.dialog(id));
// Dizayndagi birinchi ko'rinish: 7 ta plitka + "Yana N ta mavzu".
const FIRST = 7;
type Prog = Record<string, { heard?: boolean; frac?: number }>;

export default function DialogListScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [related, setRelated] = useState<Topic | null>(null);
  const [prog, setProg] = useState<Prog>({});
  const [all, setAll] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const mc = await fetchMobileContent();
        const cur = await currentLesson(mc);
        const p = await getDialogProgress();
        if (!alive) return;
        const list = mc.library.speaking;
        setTopics(list);
        setProg(p);
        setRelated(cur ? list.find((t) => titlesMatch(t.title, cur.lesson.name)) ?? null : null);
      })().catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  const matching = topics.filter((t) => t !== related && (filter === 'all' || t.level === filter));
  const shown = all ? matching : matching.slice(0, FIRST);
  const more = matching.length - shown.length;
  const heardOf = (t: Topic) => (prog[t.id]?.heard ? dialogCount(t) : 0);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: Math.max(insets.top, 44) + 10, paddingBottom: insets.bottom + 34 }} showsVerticalScrollIndicator={false}>
      <Column>
        <View style={styles.header}>
          <BackButton fallback={R.practice} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Display size={24}>Dialoglar</Display>
            <T w={700} size={13} color="#4A5468">{topics.length} ta hayotiy mavzu · audio + matn + tarjima</T>
          </View>
        </View>

        <FilterTabs
          tabs={TABS}
          value={filter}
          onChange={setFilter}
          label="Qiyinlik"
          style={{ marginTop: 14, paddingHorizontal: 20 }}
          look={{ height: 44, padX: 18, gap: 6, inactiveColor: '#26304A', inactiveWeight: 800 }}
        />

        <View style={styles.body}>
          {related && (() => {
            const n = dialogCount(related);
            const h = heardOf(related);
            const going = !prog[related.id]?.heard && (prog[related.id]?.frac ?? 0) > 0;
            const f = n ? (h + (going ? prog[related.id]?.frac ?? 0 : 0)) / n : 0;
            return (
              <Pressable accessibilityRole="link" onPress={() => openTopic(related.id)} style={({ pressed }) => [styles.hero, pressed && { opacity: 0.9 }]}>
                <Image source={designImages['c04932e65803a7f5c40ff5868fd21516']} style={styles.heroImg} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
                <View style={styles.heroTag}>
                  <T w={800} size={11} color="#1E3FD1" style={{ textTransform: 'uppercase', letterSpacing: 0.55 }}>Bugungi dars bilan bogʻliq</T>
                </View>
                <Display size={22} ls={-0.01} lh={1.36} color="#FFFFFF">{related.title}</Display>
                <T w={700} size={13} color="#F0F3FF" lh={1.35}>
                  {LEVEL[related.level]} · {h} / {n} eshitilgan{going ? `\n${h + 1}-dialog davom etmoqda` : ''}
                </T>
                <View style={styles.heroTrack}>
                  <View style={[styles.heroFill, { width: `${f * 100}%` }]} />
                </View>
              </Pressable>
            );
          })()}

          <View style={styles.secHead}>
            <T w={800} size={16}>Barcha mavzular</T>
            <T w={700} size={13} color="#4A5468">{topics.length} ta</T>
          </View>
          <View style={styles.grid}>
            {shown.map((t, i) => {
              const n = dialogCount(t);
              const h = heardOf(t);
              const done = n > 0 && h === n;
              return (
                <Pressable key={t.id} accessibilityRole="link" onPress={() => openTopic(t.id)} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}>
                  <View style={[styles.thumb, { backgroundColor: TILE_BG[i % TILE_BG.length] }]}>
                    {t.coverUrl ? (
                      <Image source={{ uri: t.coverUrl }} style={{ width: 44, height: 44 }} resizeMode="contain" accessibilityIgnoresInvertColors />
                    ) : (
                      <Text style={styles.emoji}>{t.emoji}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <T w={800} size={14} lh={1.2}>{t.title}</T>
                    <T w={700} size={12} color="#4A5468">{LEVEL[t.level]} · {n} dialog</T>
                    <View style={styles.tileProg}>
                      <View accessibilityRole="progressbar" accessibilityLabel="Eshitilgan" accessibilityValue={{ min: 0, max: n, now: h }} style={styles.tileTrack}>
                        <View style={[styles.tileFill, { width: `${n ? (h / n) * 100 : 0}%`, backgroundColor: done ? '#087A4A' : '#2F5BFF' }]} />
                      </View>
                      <T w={800} size={12} color={done ? '#087A4A' : '#4A5468'}>{done ? `✓ ${h}/${n}` : `${h}/${n}`}</T>
                    </View>
                  </View>
                </Pressable>
              );
            })}
            {more > 0 && (
              <Pressable accessibilityRole="button" onPress={() => setAll(true)} style={styles.more}>
                <T w={700} size={13} color="#4A5468" style={{ textAlign: 'center' }}>Yana {more} ta mavzu</T>
              </Pressable>
            )}
          </View>
        </View>
      </Column>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6FA' },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  body: { paddingTop: 14, paddingHorizontal: 20, gap: 10 },
  hero: { backgroundColor: '#2F5BFF', borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, gap: 6, overflow: 'hidden' },
  heroImg: { position: 'absolute', right: 4, top: '50%', marginTop: -56, width: 112, height: 112 },
  heroTag: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 },
  heroTrack: { width: 200, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  heroFill: { height: 6, backgroundColor: '#FFFFFF' },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  tile: { width: '48.9%', minHeight: 80, backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 8, paddingLeft: 8, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emoji: { fontSize: 26 },
  tileProg: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#E7EBF3', overflow: 'hidden' },
  tileFill: { height: 5, borderRadius: 3 },
  more: { width: '48.9%', minHeight: 80, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
