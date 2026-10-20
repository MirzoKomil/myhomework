/**
 * Kompyuter: Mashq (dizayn: D_Practice) — o'yinlar, materiallar va takrorlash.
 *
 * Ma'lumot telefon ekrani (app/v2/mashq/index.tsx) bilan bir xil manbalardan:
 * joriy dars, o'yin rekordlari (qurilmada), kutubxona sonlari, shaxsiy lug'at,
 * uyga vazifa xatolari. Qo'shimcha (faqat shu dizaynda): bugungi takrorlash
 * so'zlari soni (bosh sahifadagi kabi reviewStore) va bugungi grammatika kodi.
 * Onlayn o'quvchilar soni serverda yo'q — 0.
 * Klaviatura: "/" — qidiruv.
 */
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { DesktopPage, Kbd } from '@/components/v2/desktop/Shell';
import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { buildSession, loadReviews } from '@/components/v2/home/reviewStore';
import { loadGrammarRows } from '@/components/v2/library/grammar';
import { fmtTime, getMyWords, useCurrentLesson, useMistakeCount, useRecords } from '@/components/v2/practice/shared';
import { V2_BATTLE_WIN_COINS } from '@/constants/v2/battle';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { fetchMobileContent } from '@/services/contentApi';
import { useCachedState } from '@/services/v2Cache';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

import { H, IArrow, IChevron, ISearch, T } from './ui';

const img = (id: string) => (designImages as Record<string, ImageSourcePropType>)[id];
const go = (href: string) => router.push(href as Href);

function GameTile({ href, bg, image, title, sub, meta }: { href: string; bg: string; image: string; title: string; sub: string; meta: string }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${title}. ${meta}`} onPress={() => go(href)} style={s.tile}>
      <View style={[s.tileIcon, { backgroundColor: bg }]}>
        <Image source={img(image)} style={{ width: 60, height: 60 }} resizeMode="contain" />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T w={800} size={16} lh={22} lines={1}>
          {title}
        </T>
        <T w={600} size={13} color="#4A5468" lh={18} lines={1}>
          {sub}
        </T>
        <T w={800} size={13} color="#1E3FD1" lh={18} style={{ marginTop: 2 }} lines={1}>
          {meta}
        </T>
      </View>
    </Pressable>
  );
}

function Material({
  href,
  bg,
  image,
  title,
  badge,
  sub,
  meta,
}: {
  href: string;
  bg: string;
  image: string;
  title: string;
  badge?: { text: string; bg: string; color: string } | null;
  sub: string;
  meta: string;
}) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${title}. ${meta}`} onPress={() => go(href)} style={s.mat}>
      <View style={[s.matIcon, { backgroundColor: bg }]}>
        <Image source={img(image)} style={{ width: 68, height: 68 }} resizeMode="contain" />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T w={800} size={17} lh={23} lines={1}>
            {title}
          </T>
          {!!badge && (
            <View style={[s.badge, { backgroundColor: badge.bg }]}>
              <T w={800} size={12} color={badge.color} lh={16}>
                {badge.text}
              </T>
            </View>
          )}
        </View>
        <T w={600} size={13} color="#4A5468" lh={18} lines={1}>
          {sub}
        </T>
        <T w={800} size={13} color="#34405A" lh={18} lines={1}>
          {meta}
        </T>
      </View>
      <IChevron />
    </Pressable>
  );
}

function Section({ title, meta, first }: { title: string; meta: string; first?: boolean }) {
  return (
    <View style={[s.section, !first && { marginTop: 12 }]}>
      <Text accessibilityRole="header" style={s.h2}>
        {title}
      </Text>
      <T w={700} size={14} color="#4A5468" lh={19} lines={1} style={{ flexShrink: 1 }}>
        {meta}
      </T>
    </View>
  );
}

export function DPractice() {
  const lesson = useCurrentLesson();
  const { rec, reload } = useRecords();
  const [counts, setCounts] = useCachedState<{ grammar: number; stories: number; dialogs: number }>('mashq.counts', { grammar: 0, stories: 0, dialogs: 0 });
  const [myWords, setMyWords] = useCachedState('mashq.myWords', 0);
  const mistakes = useMistakeCount();
  // Bosh sahifadagi "So'zlarni takrorlash" bilan bir xil hisob.
  const [wordCount, setWordCount] = useCachedState<number>('dmashq.wordCount', 0);
  const [grammarCode, setGrammarCode] = useCachedState<string | null>('dmashq.grammarCode', null);

  // O'yindan/tarjimondan qaytganda rekord va lug'at soni darhol yangilansin.
  useFocusEffect(
    useCallback(() => {
      reload();
      getMyWords().then((l) => setMyWords(l.length));
      Promise.all([getAccumulatedVocabulary(), loadReviews()])
        .then(([w, r]) => setWordCount(buildSession(w, r).length))
        .catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reload]),
  );

  useEffect(() => {
    fetchMobileContent()
      .then((mc) =>
        setCounts({
          grammar: mc.library.grammar.length,
          stories: mc.library.books.length,
          dialogs: mc.library.speaking.length,
        }),
      )
      .catch(() => {});
    loadGrammarRows()
      .then((g) => setGrammarCode(g.related?.code ?? null))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useDesktopKeys({ '/': () => go(R.search) });

  const search = (
    <Pressable accessibilityRole="link" accessibilityLabel="Qidirish" onPress={() => go(R.search)} style={s.search}>
      <ISearch />
      <T w={600} size={14} color="#4A5468" lh={19} style={{ flex: 1 }} lines={1}>
        Soʻz, mavzu yoki dialog qidirish
      </T>
      <Kbd>/</Kbd>
    </Pressable>
  );

  const title = (
    <View style={{ gap: 2, minWidth: 0, flexShrink: 1 }}>
      <H size={28} lh={31}>
        Mashq
      </H>
      <T w={700} size={14} color="#4A5468" lh={19} lines={1}>
        Soʻzlarni oʻyin va materiallar bilan mustahkamlang
      </T>
    </View>
  );

  return (
    <DesktopPage title="Mashq" titleSlot={title} actions={search} contentStyle={s.content}>
      <Section first title="Oʻyinlar" meta={lesson ? `Mavzu: ${lesson.name} · ${lesson.number}-dars soʻzlari` : 'Mavzu: —'} />
      <View style={s.row}>
        <Pressable accessibilityRole="link" accessibilityLabel="Yuzma-yuz. Raqib topish" onPress={() => go(R.battle)} style={s.battle}>
          <View style={s.battleCircle} />
          <Image source={img('11ac32c8e5b061e3779348e3afc56d83')} style={s.battleImg} resizeMode="contain" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={s.dot} />
            <T w={800} size={13} color="#3DDC97" lh={18}>
              0 kishi onlayn
            </T>
          </View>
          <Text style={s.battleTitle}>Yuzma-yuz</Text>
          <T w={600} size={15} color="#B8C1D6" lh={20} style={{ maxWidth: 300 }}>
            {lesson ? `${lesson.number}-dars soʻzlari` : 'Dars soʻzlari'} boʻyicha jonli bellashuv · gʻolib{' '}
            <Text style={{ fontFamily: fonts.bodyBold, color: '#FFC93C' }}>+{V2_BATTLE_WIN_COINS} coin</Text>
          </T>
          <View style={s.findBtn}>
            <T w={800} size={15} color="#FFFFFF" lh={20}>
              Raqib topish
            </T>
            <IArrow size={17} />
          </View>
        </Pressable>
        <View style={s.tiles}>
          <View style={s.tileRow}>
            <GameTile href={R.wordChain} bg="#E8EEFF" image="557efc668fa6b22df51bb9270eeb827b" title="Soʻnggi harf" sub="Soʻz zanjiri" meta={`Rekord: ${rec.wordChain}`} />
            <GameTile
              href={R.memory}
              bg="#FFF1E6"
              image="f7ed25f8b468b4cb6172a58adcd09f1f"
              title="Esla-mosla"
              sub="Juftini toping"
              meta={`Rekord: ${rec.memorySeconds == null ? '0:00' : fmtTime(rec.memorySeconds)}`}
            />
          </View>
          <View style={s.tileRow}>
            <GameTile
              href={R.wordSearch}
              bg="#F0EBFF"
              image="6e82364b2d0800a1b04099cc5d172f63"
              title="Soʻztopar"
              sub="Harflar ichidan"
              meta={`${rec.wordSearch.found} / ${rec.wordSearch.total} topildi`}
            />
            <GameTile href={R.mystery} bg="#E3F7EE" image="7776361bb82c98efcd4c31c51e6331f1" title="Sirli soʻz" sub="Kun soʻzi" meta={`${rec.mystery.tries} / ${rec.mystery.max} urinish`} />
          </View>
        </View>
      </View>

      <Section title="Materiallar" meta="Kitob va maʼlumotnoma" />
      <View style={s.row}>
        <Material href={R.dialogList} bg="#F0EBFF" image="2770f303e2a36a9ec52c3a0b44e9b032" title="Dialoglar" sub="Mavzuli dialoglar + audio" meta={`${counts.dialogs} mavzu`} />
        <Material
          href={R.lugat}
          bg="#FFF1E6"
          image="41f0bc38557c05d400bc4af482b8ae13"
          title="Lugʻatim"
          badge={{ text: `${mistakes} xato`, bg: '#FDECEC', color: '#B42318' }}
          sub="Saqlangan soʻzlar va xatolar"
          meta={`${myWords} soʻz`}
        />
        <Material
          href={R.grammarList}
          bg="#E3F7EE"
          image="f639c30e1400761df83230b833ba42b2"
          title="Grammatika"
          badge={grammarCode ? { text: `Bugun: ${grammarCode}`, bg: '#E3F7EE', color: '#075E3A' } : null}
          sub="Qoidalar, jadvallar va misollar"
          meta={`${counts.grammar} mavzu · Maʼlumotnoma`}
        />
      </View>
      <View style={s.row}>
        <Material href={R.audioList} bg="#FDECEC" image="32eee84d436da97eb104c837c0065230" title="Audiolar" sub="Darslikdagi audio treklar" meta="Kitob treklari · QR" />
        <Material href={R.storyList} bg="#FFF4D1" image="e57b4e5aeb29652a1e91b899a8e24693" title="Hikoyalar" sub="Audio + matn, soʻz tarjimasi" meta={`${counts.stories} ta audiohikoya`} />
        <Material href={R.translator} bg="#E8EEFF" image="cc0d95446730f059d25d989e2c9845ad" title="Tarjimon" sub="Urgʻu va misollar bilan tarjima" meta="rus ↔ oʻzbek" />
      </View>

      <Section title="Takrorlash" meta="Unutmaslik uchun har kuni" />
      <View style={s.row}>
        <Pressable accessibilityRole="link" onPress={() => go(R.wordReview)} style={[s.review, { backgroundColor: '#F0EBFF' }]}>
          <View style={[s.reviewIcon, { backgroundColor: '#FFFFFF' }]}>
            <Image source={img('f7ed25f8b468b4cb6172a58adcd09f1f')} style={{ width: 56, height: 56 }} resizeMode="contain" />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <T w={800} size={17} lh={23} lines={1}>
              Soʻzlarni takrorlash
            </T>
            <T w={600} size={13} color="#4A5468" lh={18} lines={1}>
              {wordCount} ta soʻz bugun takrorlanadi · Lugʻatimdan
            </T>
          </View>
          <View style={[s.reviewBtn, { backgroundColor: '#6A3CF0' }]}>
            <T w={800} size={14} color="#FFFFFF" lh={19}>
              Boshlash
            </T>
            <IArrow size={16} />
          </View>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => go(lesson ? R.mistakes(lesson.id) : R.path)} style={[s.review, { backgroundColor: '#FFFFFF' }]}>
          <View style={[s.reviewIcon, { backgroundColor: '#FDECEC' }]}>
            <Image source={img('cc0d95446730f059d25d989e2c9845ad')} style={{ width: 56, height: 56 }} resizeMode="contain" />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <T w={800} size={17} lh={23} lines={1}>
              Xatolar ustida ishlash
            </T>
            <T w={600} size={13} color="#4A5468" lh={18} lines={1}>
              Uyga vazifadagi xatolarni yana yeching · {mistakes} ta
            </T>
          </View>
          <View style={[s.reviewBtn, { backgroundColor: '#F4F6FA' }]}>
            <T w={800} size={14} lh={19}>
              Ochish
            </T>
            <IArrow size={16} color="#0B1220" />
          </View>
        </Pressable>
      </View>
    </DesktopPage>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: 32, gap: 14 },
  search: {
    width: 340,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 12,
    marginRight: 6,
  },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  h2: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 19, lineHeight: 26, color: '#0B1220' },
  row: { flexDirection: 'row', gap: 16 },

  // Dizayndagi 12 ustunli to'r: 6 + 6 (teng yarim, oraliq 16).
  battle: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'calc(50% - 8px)' as unknown as number,
    minWidth: 0,
    minHeight: 268,
    backgroundColor: '#0B1220',
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 30,
    justifyContent: 'flex-end',
    gap: 6,
    overflow: 'hidden',
  },
  battleCircle: { position: 'absolute', right: -50, top: -60, width: 300, height: 300, borderRadius: 150, backgroundColor: '#18223A' },
  battleImg: { position: 'absolute', right: 22, top: 22, width: 200, height: 188 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3DDC97' },
  battleTitle: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 34, lineHeight: 41, letterSpacing: -0.68, color: '#FFFFFF' },
  findBtn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 15,
    backgroundColor: '#2F5BFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tiles: { flexGrow: 0, flexShrink: 0, flexBasis: 'calc(50% - 8px)' as unknown as number, minWidth: 0, gap: 16 },
  tileRow: { flex: 1, flexDirection: 'row', gap: 16 },
  tile: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  tileIcon: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  mat: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  matIcon: { width: 76, height: 76, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badge: { height: 22, paddingHorizontal: 8, borderRadius: 11, justifyContent: 'center' },

  review: { flex: 1, minWidth: 0, borderRadius: 24, paddingVertical: 14, paddingLeft: 14, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  reviewIcon: { width: 64, height: 64, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  reviewBtn: { height: 44, paddingHorizontal: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
