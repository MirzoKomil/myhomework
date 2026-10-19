/**
 * v2 Mashq (dizayn: 25 · Practice) — o'yinlar va materiallar markazi.
 *
 * Ma'lumot: joriy dars (oxirgi ochilgan / faol dars) mobile-content'dan,
 * o'yin rekordlari shu qurilmadagi o'yinlardan, materiallar soni
 * kutubxonadan. Onlayn o'quvchilar soni serverda yo'q — 0 ko'rsatiladi.
 * Lug'atim: so'zlar soni — shu qurilmadagi shaxsiy lug'at (getMyWords);
 * xatolar — uyga vazifa natijalaridan (scoreStore, useMistakeCount).
 */
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArrowIcon, SearchIcon } from '@/components/v2/practice/icons';
import { PracticeNav, fmtTime, getMyWords, reset, useCurrentLesson, useMistakeCount, useRecords } from '@/components/v2/practice/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { BATTLE_WIN_COINS } from '@/data/mock';
import { fetchMobileContent } from '@/services/contentApi';

const img = (id: string) => (designImages as Record<string, ImageSourcePropType>)[id];

function Tile({
  href,
  bg,
  image,
  title,
  sub,
  titleLh = 17.5,
  nowrap,
}: {
  href: string;
  bg: string;
  image: string;
  title: string;
  sub: string;
  titleLh?: number;
  nowrap?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${title}. ${sub}`}
      onPress={() => router.push(href as Href)}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={[styles.tileIcon, { backgroundColor: bg }]}>
        <Image source={img(image)} style={styles.tileImg} resizeMode="contain" />
      </View>
      <View style={styles.tileText}>
        <Text style={[styles.tileTitle, { lineHeight: titleLh }]} numberOfLines={nowrap ? 1 : undefined}>{title}</Text>
        <Text style={styles.tileSub} numberOfLines={nowrap ? 1 : undefined}>{sub}</Text>
      </View>
    </Pressable>
  );
}

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const lesson = useCurrentLesson();
  const { rec, reload } = useRecords();
  const [counts, setCounts] = useState<{ grammar: number; stories: number; dialogs: number }>({ grammar: 0, stories: 0, dialogs: 0 });
  const [myWords, setMyWords] = useState(0);
  // Uyga vazifa xatolari (scoreStore) — barcha darslar bo'yicha.
  const mistakes = useMistakeCount();

  // O'yindan/tarjimondan qaytganda rekord va lug'at soni darhol yangilansin.
  useFocusEffect(useCallback(() => {
    reload();
    getMyWords().then((l) => setMyWords(l.length));
  }, [reload]));

  useEffect(() => {
    fetchMobileContent()
      .then((mc) => setCounts({
        grammar: mc.library.grammar.length,
        stories: mc.library.books.length,
        dialogs: mc.library.speaking.length,
      }))
      .catch(() => {});
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 44) + 10 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          <View style={styles.headRow}>
            <Text accessibilityRole="header" style={styles.h1}>Mashq</Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Qidirish"
              onPress={() => router.push(R.search as Href)}
              style={styles.searchBtn}
            >
              <SearchIcon />
            </Pressable>
          </View>

          <View style={styles.sectionRow}>
            <Text accessibilityRole="header" style={styles.h2}>Oʻyinlar</Text>
            <Text style={styles.sectionMeta} numberOfLines={1}>{lesson ? `Mavzu: ${lesson.name}` : 'Mavzu: —'}</Text>
          </View>

          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Yuzma-yuz. Raqib topish"
            onPress={() => router.push(R.battle as Href)}
            style={({ pressed }) => [styles.battle, pressed && styles.pressed]}
          >
            <Image source={img('11ac32c8e5b061e3779348e3afc56d83')} style={styles.battleImg} resizeMode="contain" />
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>0 kishi onlayn</Text>
            </View>
            <Text style={styles.battleTitle}>Yuzma-yuz</Text>
            <Text style={styles.battleSub}>
              {lesson ? `${lesson.number}-dars soʻzlari` : 'Dars soʻzlari'} · gʻolib +{BATTLE_WIN_COINS} coin
            </Text>
            <View style={styles.findBtn}>
              <Text style={styles.findText}>Raqib topish</Text>
              <ArrowIcon />
            </View>
          </Pressable>

          <View style={styles.grid}>
            <Tile href={R.wordChain} bg="#E8EEFF" image="557efc668fa6b22df51bb9270eeb827b" title="Soʻnggi harf" sub={`Rekord: ${rec.wordChain}`} />
            <Tile
              href={R.memory}
              bg="#FFF1E6"
              image="f7ed25f8b468b4cb6172a58adcd09f1f"
              title="Esla-mosla"
              sub={`Rekord: ${rec.memorySeconds == null ? '0:00' : fmtTime(rec.memorySeconds)}`}
            />
            <Tile
              href={R.wordSearch}
              bg="#F0EBFF"
              image="6e82364b2d0800a1b04099cc5d172f63"
              title="Soʻztopar"
              sub={`${rec.wordSearch.found} / ${rec.wordSearch.total} topildi`}
            />
            <Tile
              href={R.mystery}
              bg="#E3F7EE"
              image="7776361bb82c98efcd4c31c51e6331f1"
              title="Sirli soʻz"
              sub={`${rec.mystery.tries} / ${rec.mystery.max} urinish`}
            />
          </View>

          <View style={[styles.sectionRow, { marginTop: 4 }]}>
            <Text accessibilityRole="header" style={styles.h2}>Materiallar</Text>
            <Text style={styles.sectionMeta}>Kitob va maʼlumotnoma</Text>
          </View>

          <View style={styles.grid}>
            <Tile href={R.dialogList} bg="#F0EBFF" image="2770f303e2a36a9ec52c3a0b44e9b032" title="Dialoglar" sub={`${counts.dialogs} mavzu`} titleLh={16.8} nowrap />
            <Tile href={R.lugat} bg="#FFF1E6" image="41f0bc38557c05d400bc4af482b8ae13" title="Lugʻatim" sub={`${myWords} soʻz · ${mistakes} xato`} titleLh={16.8} nowrap />
            <Tile href={R.grammarList} bg="#E3F7EE" image="f639c30e1400761df83230b833ba42b2" title="Grammatika" sub={`${counts.grammar} mavzu`} titleLh={16.8} nowrap />
            <Tile href={R.audioList} bg="#FDECEC" image="32eee84d436da97eb104c837c0065230" title="Audiolar" sub="Kitob treklari" titleLh={16.8} nowrap />
            <Tile href={R.storyList} bg="#FFF4D1" image="e57b4e5aeb29652a1e91b899a8e24693" title="Hikoyalar" sub={`${counts.stories} ta audiohikoya`} titleLh={16.8} nowrap />
            <Tile href={R.translator} bg="#E8EEFF" image="cc0d95446730f059d25d989e2c9845ad" title="Tarjimon" sub="rus ↔ oʻzbek" titleLh={16.8} nowrap />
          </View>
        </View>
      </ScrollView>
      <PracticeNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 16 },
  column: { maxWidth: 480, alignSelf: 'center', width: '100%', gap: 10 },
  pressed: { opacity: 0.85 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontFamily: fonts.display, fontSize: 28, lineHeight: 38, letterSpacing: -0.56, color: '#0B1220', ...reset },
  searchBtn: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  h2: { fontFamily: fonts.bodyHeavy, fontSize: 17, lineHeight: 23, color: '#0B1220', ...reset },
  sectionMeta: { flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18, color: '#4A5468', ...reset },

  battle: {
    minHeight: 112,
    backgroundColor: '#0B1220',
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  battleImg: { position: 'absolute', right: 8, top: '50%', marginTop: -49, width: 104, height: 98 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3DDC97' },
  onlineText: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: '#3DDC97', ...reset },
  battleTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.22, color: '#FFFFFF', ...reset },
  battleSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: '#B8C1D6', paddingRight: 110, ...reset },
  findBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#2F5BFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  findText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#FFFFFF', ...reset },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    // Dizayn renderida kartalar 76px (min-height 60 + to'r qatorining cho'zilishi).
    minHeight: 76,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tileIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tileImg: { width: 42, height: 42 },
  tileText: { flex: 1, minWidth: 0, gap: 1 },
  tileTitle: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#0B1220', ...reset },
  tileSub: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 15, color: '#4A5468', ...reset },
});
