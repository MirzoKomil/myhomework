/**
 * v2 Do'kon (dizayn: 43 · Shop).
 *
 * Mahsulotlar eski shop/index.tsx dagi manbadan: mobile-content `shop`
 * (CRM bilan birlashtirilgan), bo'sh bo'lsa statik SHOP_PRODUCTS. Balans —
 * coinsStore. Dizayndagi "Qo'shimcha kitoblar" bo'limi `books`
 * kategoriyasi; boshqa kategoriyalar ham (eski do'konda bor edi) xuddi shu
 * ko'rinishda pastroqda chiqadi. "Streak himoyasi" bonusi serverda yo'q.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BagIcon, CoinFill } from '@/components/v2/rewards/icons';
import { OrderSuccessPopup } from '@/components/v2/popups/OrderSuccess';
import { StreakConfirmPopup } from '@/components/v2/popups/StreakConfirm';
import {
  EARN_BONUS_LESSON,
  EARN_HOMEWORK,
  EARN_LEAGUE_TOP5,
  EARN_LESSON_DONE,
  EARN_REFERRAL,
  fmt,
  HeaderPill,
  nearestProduct,
  ScreenHeader,
  useShopProducts,
  type ShopProductV2,
} from '@/components/v2/rewards/parts';
import { CoinBar, ProductCover } from '@/components/v2/rewards/shopParts';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { V2_BATTLE_WIN_COINS } from '@/constants/v2/battle';
import { SHOP_CATEGORY_LABELS, type ShopCategory } from '@/data/shopProducts';
import { useLang, localizeCourseWording } from '@/i18n/LanguageContext';
import { useCoins } from '@/services/coinsStore';

const ORDER: ShopCategory[] = ['books', 'merch', 'gadgets', 'stationery'];
// Streak himoyasi narxi — dizayndagi qiymat (bonus hali sotilmaydi).
const STREAK_SHIELD_PRICE = 150;

// "Qanday yig'iladi" ro'yxati — dizayndagi tartibda; izoh (oxirigacha/hafta) kulrang.
const EARN_ROWS: { label: string; note?: string; value: string }[] = [
  { label: 'Uyga vazifa', value: EARN_HOMEWORK },
  { label: 'Dars yakuni', value: `+${EARN_LESSON_DONE}` },
  { label: 'Yuzma-yuz gʻalaba', value: `+${V2_BATTLE_WIN_COINS}` },
  { label: 'Bonus dars', note: '(oxirigacha)', value: `+${EARN_BONUS_LESSON}` },
  { label: 'Liga top-5', note: '(hafta)', value: `+${EARN_LEAGUE_TOP5}` },
  { label: 'Doʻst taklifi', value: `+${EARN_REFERRAL}` },
];

function ProductCard({ p, coins, nearest }: { p: ShopProductV2; coins: number; nearest: boolean }) {
  const missing = Math.max(0, p.price - coins);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${p.name}, ${fmt(p.price)} coin`}
      onPress={() => router.push(R.shopItem(p.id) as never)}
      style={({ pressed }) => [styles.card, nearest && { borderColor: '#087A4A' }, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.cardImgWrap, { backgroundColor: p.coverBg ?? '#EAE4DF' }]}>
        <ProductCover product={p} size={104} bg={p.coverBg ?? '#EAE4DF'} fade={0.16} />
        {nearest && (
          <View style={styles.nearest}><Text style={styles.nearestText}>Eng yaqini</Text></View>
        )}
      </View>
      <View style={{ paddingHorizontal: 6, gap: 5 }}>
        <View>
          <Text style={styles.cardTitle} numberOfLines={2}>{p.name}</Text>
          {!!(p.subtitle || p.delivered) && (
            <Text style={styles.cardSub} numberOfLines={1}>{p.subtitle ?? 'Yetkazib beriladi'}</Text>
          )}
        </View>
        <CoinBar value={coins / Math.max(1, p.price)} />
        <View style={styles.cardFoot}>
          <CoinFill size={15} />
          <Text style={styles.cardPrice}>{fmt(p.price)}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.cardFootText}>{missing > 0 ? `yana ${fmt(missing)}` : 'yetadi'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

type Popup = null | 'streak-confirm' | 'order-success';

export default function V2Shop() {
  const coins = useCoins();
  // ?popup=streak-confirm | order-success — popup'ni to'g'ridan-to'g'ri ochish (ko'rib chiqish uchun).
  const params = useLocalSearchParams<{ popup?: string }>();
  const [popup, setPopup] = useState<Popup>(null);
  useEffect(() => {
    if (params.popup === 'streak-confirm' || params.popup === 'order-success') setPopup(params.popup);
  }, [params.popup]);
  const products = useShopProducts();
  const { lang, courseLang } = useLang();
  const nearest = products ? nearestProduct(products, coins) : null;
  const brand = localizeCourseWording('Homework', lang, courseLang);

  const groups = ORDER.map((cat) => ({ cat, items: (products ?? []).filter((p) => p.category === cat) })).filter((g) => g.items.length);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Doʻkon"
        overline={brand}
        fallback={R.home}
        right={<HeaderPill label="Buyurtmalarim" icon={<BagIcon />} onPress={() => router.push(R.orders as never)} />}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <View style={styles.balance}>
            <View style={{ width: 104, gap: 2 }}>
              <Text style={styles.balLabel}>Balansingiz</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <CoinFill size={24} />
                <Text style={styles.balValue}>{fmt(coins)}</Text>
              </View>
              <Text style={styles.balLabelSm}>coin</Text>
            </View>
            <View style={styles.howTo}>
              <Text style={[styles.howText, { color: '#FFFFFF', fontFamily: fonts.bodyHeavy }]}>Qanday yigʻiladi:</Text>
              <View style={{ gap: 1 }}>
                {EARN_ROWS.map((r) => (
                  <View key={r.label} style={styles.howRow}>
                    <Text style={styles.howText} numberOfLines={1}>
                      {r.label}
                      {r.note ? <Text style={styles.howNote}> {r.note}</Text> : null}
                    </Text>
                    <Text style={[styles.howText, styles.howNum]} numberOfLines={1}>{r.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {groups.map((g, gi) => (
            <View key={g.cat} style={{ gap: 10, marginTop: gi === 0 ? 0 : 6 }}>
              <View style={styles.sectionHead}>
                <Text accessibilityRole="header" style={styles.h2}>{g.cat === 'books' ? 'Qoʻshimcha kitoblar' : localizeCourseWording(SHOP_CATEGORY_LABELS[g.cat], lang, courseLang)}</Text>
                {g.items.every((p) => p.delivered) && <Text style={styles.sectionNote}>{g.cat === 'books' ? 'Bosma · uyga bepul' : 'Uyga bepul'}</Text>}
              </View>
              <View style={styles.grid}>
                {g.items.map((p) => (
                  <View key={p.id} style={styles.gridCell}>
                    <ProductCard p={p} coins={coins} nearest={nearest?.id === p.id} />
                  </View>
                ))}
              </View>
            </View>
          ))}

          <View style={[styles.sectionHead, { marginTop: 4 }]}>
            <Text accessibilityRole="header" style={[styles.h2, { fontSize: 15 }]}>Ilova bonusi</Text>
          </View>
          <View style={styles.bonus}>
            <View style={styles.bonusImg}>
              <Image source={designImages.f1f2b5015be3aab0bfaac974e1e01af0} style={{ width: 48, height: 48 }} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <Text style={styles.cardTitle}>Streak himoyasi</Text>
              <Text style={[styles.cardSub, { lineHeight: 16 }]}>Dars qoldirgan kuni streak saqlanadi</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Streak himoyasini ${STREAK_SHIELD_PRICE} coinga olish`}
              onPress={() => setPopup('streak-confirm')}
              style={({ pressed }) => [styles.bonusBtn, pressed && { opacity: 0.85 }]}
            >
              <CoinFill size={16} />
              <Text style={styles.bonusBtnText}>{STREAK_SHIELD_PRICE}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <StreakConfirmPopup
        visible={popup === 'streak-confirm'}
        price={STREAK_SHIELD_PRICE}
        onClose={() => setPopup(null)}
        onConfirm={() => setPopup('order-success')}
      />
      <OrderSuccessPopup visible={popup === 'order-success'} price={STREAK_SHIELD_PRICE} onClose={() => setPopup(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { paddingTop: 14, paddingHorizontal: 20, paddingBottom: 32 },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 10 },
  balance: { backgroundColor: '#0B1220', borderRadius: 24, paddingVertical: 14, paddingLeft: 18, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  balLabel: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#B8C1D6' },
  balLabelSm: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#B8C1D6' },
  balValue: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 32, lineHeight: 35, color: '#FFFFFF' },
  howTo: { flex: 1, minWidth: 0, gap: 3, borderLeftWidth: 1, borderLeftColor: '#263048', paddingLeft: 12 },
  howRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 },
  howText: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 16.2, color: '#C9D0DE', flexShrink: 1 },
  howNote: { fontFamily: fonts.body, color: '#A9B3C8' },
  howNum: { fontFamily: fonts.bodyHeavy, color: '#FFC93C', flexShrink: 0 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 2 },
  h2: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 17, color: '#0B1220' },
  sectionNote: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, color: '#4A5468' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, rowGap: 10 },
  gridCell: { width: '50%', paddingHorizontal: 5 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 22, paddingTop: 6, paddingHorizontal: 6, paddingBottom: 10, gap: 7, flex: 1 },
  cardImgWrap: { height: 104, borderRadius: 17, overflow: 'hidden', backgroundColor: '#EAE4DF' },
  nearest: { position: 'absolute', bottom: 8, left: 8, height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: '#087A4A', justifyContent: 'center' },
  nearestText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#FFFFFF' },
  cardTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, lineHeight: 19, color: '#0B1220' },
  cardSub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 12, lineHeight: 17, color: '#4A5468' },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardPrice: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, color: '#0B1220' },
  cardFootText: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, color: '#4A5468' },
  bonus: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 8, paddingLeft: 8, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bonusImg: { width: 52, height: 52, borderRadius: 15, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  bonusBtn: { height: 44, paddingHorizontal: 12, borderRadius: 13, backgroundColor: '#087A4A', flexDirection: 'row', alignItems: 'center', gap: 5 },
  bonusBtnText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, color: '#FFFFFF' },
});
