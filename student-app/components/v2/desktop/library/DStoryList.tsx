/**
 * Kompyuter: Audiohikoyalar (dizayn: D_StoryList.dc.html).
 *
 * Ma'lumot mobil ekran bilan aynan bir xil: CRM kutubxonasidagi kitoblar
 * (mc.library.books), daraja a1/a2/b1 → Oson/Oʻrta/Qiyin, davomiylik — matn
 * hajmidan taxminiy, foiz — Book ekranida saqlangan tinglash joyi. Boshlangan
 * (0–100%) hikoya kartasi ajratiladi va "Davom ettirish" yozuvi chiqadi.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { getStoryPositions } from '@/components/v2/library/data';
import { storyMinutes } from '@/components/v2/library/stories';
import { go } from '@/components/v2/library/shared';
import { R } from '@/constants/v2/routes';
import type { BookLevel, BookStory } from '@/data/bookStories';
import { fetchMobileContent } from '@/services/contentApi';

import { DesktopPage } from '../Shell';
import { DTabs, IChevron, T } from './ui';

type Story = BookStory & { coverUrl?: string };
type Filter = 'all' | BookLevel;
const TABS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: 'a1', label: 'Oson' },
  { key: 'a2', label: 'Oʻrta' },
  { key: 'b1', label: 'Qiyin' },
];
// Kompyuter dizaynidagi daraja yorliqlari (Oʻrta — #6A3CF0); Qiyin — mobil LEVEL_CHIP bilan bir xil.
export const D_LEVEL: Record<BookLevel, { label: string; bg: string; fg: string }> = {
  a1: { label: 'Oson', bg: '#E3F7EE', fg: '#075E3A' },
  a2: { label: 'Oʻrta', bg: '#F0EBFF', fg: '#6A3CF0' },
  b1: { label: 'Qiyin', bg: '#FDECEC', fg: '#5B2FD6' },
};

export function DStoryList() {
  const [filter, setFilter] = useState<Filter>('all');
  const [stories, setStories] = useState<Story[]>([]);
  const [pos, setPos] = useState<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchMobileContent()
        .then((mc) => alive && setStories(mc.library.books))
        .catch(() => {});
      getStoryPositions().then((p) => alive && setPos(p));
      return () => {
        alive = false;
      };
    }, []),
  );

  const shown = stories.filter((x) => filter === 'all' || x.level === filter);

  return (
    <DesktopPage title="Audiohikoyalar" subtitle={`${stories.length} ta hikoya · soʻzma-soʻz oʻqish`} back={R.practice} contentStyle={{ paddingBottom: 32, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <DTabs
          tabs={TABS.map((t) => {
            const cnt = t.key === 'all' ? stories.length : stories.filter((x) => x.level === t.key).length;
            // Ma'lumot yuklanmaguncha tablar o'chirilmaydi (mobil bilan bir xil).
            return stories.length && !cnt ? { ...t, label: `${t.label} · 0`, disabled: true, hint: `Hozircha ${t.label.toLowerCase()} hikoya yoʻq` } : t;
          })}
          value={filter}
          onChange={setFilter}
          label="Qiyinlik"
        />
        <T w={700} size={14} color="#4A5468">
          Tarjima uchun soʻzga bosing · audio bilan
        </T>
      </View>

      <View style={s.grid}>
        {shown.map((st) => {
          const p = Math.round((pos[st.id] ?? 0) * 100);
          const going = p > 0 && p < 100;
          const chip = D_LEVEL[st.level];
          return (
            <Pressable
              key={st.id}
              accessibilityRole="link"
              onPress={() => go(R.book(st.id))}
              style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.card, going ? s.cardOn : hovered && ({ boxShadow: 'inset 0 0 0 2px #D4DEFF' } as object)]}
            >
              <View style={[s.cover, { backgroundColor: st.colors?.[0] ?? '#E8EEFF' }]}>
                {st.coverUrl ? (
                  <Image source={{ uri: st.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
                ) : (
                  <Text style={{ fontSize: 72 }}>{st.emoji}</Text>
                )}
                {going && (
                  <>
                    <View style={s.pct}>
                      <T size={14} color="#FFFFFF">
                        {p}%
                      </T>
                    </View>
                    <View style={s.coverTrack}>
                      <View style={[s.coverFill, { width: `${p}%` }]} />
                    </View>
                  </>
                )}
              </View>
              <View style={s.info}>
                <T size={19} lh={23.75} lines={2}>
                  {st.title}
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[s.chip, { backgroundColor: chip.bg }]}>
                    <T size={14} color={chip.fg}>
                      {chip.label}
                    </T>
                  </View>
                  <T w={700} size={14} color="#4A5468">
                    {storyMinutes(st)} daq
                  </T>
                  {going && (
                    <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <T size={14} color="#1E3FD1">
                        Davom ettirish
                      </T>
                      <IChevron size={15} />
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
        {Array.from({ length: (3 - (shown.length % 3)) % 3 }, (_, k) => (
          <View key={`f${k}`} style={[s.card, { height: 0, padding: 0, backgroundColor: 'transparent' }]} />
        ))}
      </View>
    </DesktopPage>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  card: { flexGrow: 1, flexBasis: '30%', minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 24, paddingTop: 10, paddingHorizontal: 10, paddingBottom: 14, gap: 10 },
  cardOn: { boxShadow: 'inset 0 0 0 2px #2F5BFF' } as object,
  cover: { position: 'relative', height: 236, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pct: { position: 'absolute', right: 12, top: 12, height: 30, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#2F5BFF', justifyContent: 'center' },
  coverTrack: { position: 'absolute', left: 16, right: 16, bottom: 14, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.85)', overflow: 'hidden' },
  coverFill: { height: 7, borderRadius: 4, backgroundColor: '#2F5BFF' },
  info: { paddingTop: 4, paddingHorizontal: 6, paddingBottom: 2, gap: 10 },
  chip: { height: 28, paddingHorizontal: 10, borderRadius: 9, justifyContent: 'center' },
});
