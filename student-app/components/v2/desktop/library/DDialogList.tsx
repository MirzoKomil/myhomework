/**
 * Kompyuter: Dialoglar (dizayn: D_DialogList.dc.html).
 *
 * Ma'lumot mobil ekran bilan aynan bir xil: CRM speaking mavzulari
 * (mc.library.speaking), har mavzuda bitta dialog, "Bugungi dars bilan
 * bogʻliq" — joriy dars nomiga mos mavzu, eshitilgan/davom etayotgan holat —
 * qurilmadagi progress. Avval 7 ta plitka, qolgani "Yana N ta mavzu" bosilganda.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { dialogCount, getDialogProgress } from '@/components/v2/library/data';
import { currentLesson, go, titlesMatch } from '@/components/v2/library/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import type { SpeakingLevel, SpeakingTopic } from '@/data/speakingTopics';
import { fetchMobileContent } from '@/services/contentApi';

import { DesktopPage } from '../Shell';
import { DTabs, IArrow, ICheck, T } from './ui';

type Topic = SpeakingTopic & { coverUrl?: string };
type Filter = 'all' | SpeakingLevel;
type Prog = Record<string, { heard?: boolean; frac?: number }>;

const TABS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: 'easy', label: 'Oson' },
  { key: 'medium', label: 'Oʻrta' },
  { key: 'hard', label: 'Qiyin' },
];
const LEVEL: Record<SpeakingLevel, string> = { easy: 'Oson', medium: 'Oʻrta', hard: 'Qiyin' };
const TILE_BG = ['#E8EEFF', '#FFF4D1', '#E3F7EE', '#FDECEC', '#F0EBFF', '#FFF1E6', '#E8EEFF'];
const FIRST = 7;

export function DDialogList() {
  const [filter, setFilter] = useState<Filter>('all');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [related, setRelated] = useState<Topic | null>(null);
  const [prog, setProg] = useState<Prog>({});
  const [all, setAll] = useState(false);
  const [gridH, setGridH] = useState(0);

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
  // Ikki qator ekranga sig'adi (dizayndagi grid-template-rows: repeat(2, 1fr)); ko'proq bo'lsa aylanadi.
  const tileH = gridH > 0 ? Math.max(200, (gridH - 16) / 2) : 217;
  const cells = shown.length + (more > 0 ? 1 : 0);

  return (
    <DesktopPage title="Dialoglar" subtitle={`${topics.length} ta hayotiy mavzu · audio + matn + tarjima`} back={R.practice} scroll={false} contentStyle={{ paddingBottom: 32, gap: 16 }}>
      <DTabs tabs={TABS} value={filter} onChange={setFilter} label="Qiyinlik" />

      {related &&
        (() => {
          const n = dialogCount(related);
          const h = heardOf(related);
          const going = !prog[related.id]?.heard && (prog[related.id]?.frac ?? 0) > 0;
          const f = n ? (h + (going ? prog[related.id]?.frac ?? 0 : 0)) / n : 0;
          return (
            <Pressable accessibilityRole="link" onPress={() => go(R.dialog(related.id))} style={({ pressed }) => [s.hero, pressed && { opacity: 0.94 }]}>
              <View pointerEvents="none" style={s.heroCircle} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={s.heroTag}>
                  <T size={12} color="#1E3FD1" ls={0.72} style={{ textTransform: 'uppercase' }}>
                    Bugungi dars bilan bogʻliq
                  </T>
                </View>
                <T f="display" size={34} lh={35.7} ls={-0.68} color="#FFFFFF">
                  {related.title}
                </T>
                <T w={700} size={15} color="#FFFFFF">
                  {LEVEL[related.level]} · {h} / {n} eshitilgan{going ? ` · ${h + 1}-dialog davom etmoqda` : ''}
                </T>
                <View style={s.heroTrack}>
                  <View style={[s.heroFill, { width: `${f * 100}%` }]} />
                </View>
              </View>
              <View style={s.heroBtn}>
                <T size={15} color="#1E3FD1">
                  Davom ettirish
                </T>
                <IArrow />
              </View>
              <Image
                source={designImages['c04932e65803a7f5c40ff5868fd21516']}
                style={{ width: 190, height: 176, flexShrink: 0 }}
                resizeMode="contain"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            </Pressable>
          );
        })()}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <T size={19} accessibilityRole="header">
          Barcha mavzular
        </T>
        <T w={700} size={14} color="#4A5468">
          {topics.length} ta
        </T>
      </View>

      <View style={{ flex: 1, minHeight: 0 }} onLayout={(e) => setGridH(e.nativeEvent.layout.height)}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
          {shown.map((t, i) => {
            const n = dialogCount(t);
            const h = heardOf(t);
            const done = n > 0 && h === n;
            return (
              <Pressable
                key={t.id}
                accessibilityRole="link"
                onPress={() => go(R.dialog(t.id))}
                style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.tile, { height: tileH }, hovered && { boxShadow: 'inset 0 0 0 2px #D4DEFF' } as object]}
              >
                <View style={[s.thumb, { backgroundColor: TILE_BG[i % TILE_BG.length] }]}>
                  {t.coverUrl ? (
                    <Image source={{ uri: t.coverUrl }} style={{ width: 68, height: 68 }} resizeMode="contain" accessibilityIgnoresInvertColors />
                  ) : (
                    <Text style={{ fontSize: 38 }}>{t.emoji}</Text>
                  )}
                </View>
                <View style={{ gap: 3, marginTop: 'auto' }}>
                  <T size={18} lines={2}>
                    {t.title}
                  </T>
                  <T w={700} size={14} color="#4A5468">
                    {LEVEL[t.level]} · {n} dialog
                  </T>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View accessibilityRole="progressbar" accessibilityLabel="Eshitilgan" accessibilityValue={{ min: 0, max: n, now: h }} style={s.tileTrack}>
                    <View style={[s.tileFill, { width: `${n ? (h / n) * 100 : 0}%`, backgroundColor: done ? '#087A4A' : '#2F5BFF' }]} />
                  </View>
                  {done ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <ICheck color="#075E3A" />
                      <T size={14} color="#075E3A">
                        {h}/{n}
                      </T>
                    </View>
                  ) : (
                    <T size={14} color="#34405A">
                      {h}/{n}
                    </T>
                  )}
                </View>
              </Pressable>
            );
          })}
          {more > 0 && (
            <Pressable accessibilityRole="button" onPress={() => setAll(true)} style={[s.more, { height: tileH }]}>
              <T size={16} color="#4A5468">
                Yana {more} ta mavzu
              </T>
            </Pressable>
          )}
          {/* Oxirgi qatorni chapga tekislash uchun bo'sh kataklar. */}
          {Array.from({ length: (4 - (cells % 4)) % 4 }, (_, k) => (
            <View key={`f${k}`} style={s.filler} />
          ))}
        </ScrollView>
      </View>
    </DesktopPage>
  );
}

const s = StyleSheet.create({
  hero: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#2F5BFF',
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    boxShadow: '0 5px 0 #1E3FD1',
  } as object,
  heroCircle: { position: 'absolute', right: 120, top: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: '#4A70FF' },
  heroTag: { alignSelf: 'flex-start', height: 30, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  heroTrack: { width: 360, height: 8, borderRadius: 4, backgroundColor: '#6D8BFF', marginTop: 4, overflow: 'hidden' },
  heroFill: { height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  heroBtn: { height: 50, paddingHorizontal: 20, borderRadius: 16, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  tile: { flexGrow: 1, flexBasis: '22%', minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 24, paddingTop: 18, paddingHorizontal: 20, paddingBottom: 20, justifyContent: 'space-between', gap: 12 },
  thumb: { width: 76, height: 76, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tileTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#E2E6EE', overflow: 'hidden' },
  tileFill: { height: 6, borderRadius: 3 },
  more: { flexGrow: 1, flexBasis: '22%', minWidth: 0, borderRadius: 24, borderWidth: 2, borderStyle: 'dashed', borderColor: '#D5DBE7', alignItems: 'center', justifyContent: 'center' },
  filler: { flexGrow: 1, flexBasis: '22%', minWidth: 0, height: 0 },
});
