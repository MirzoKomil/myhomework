/**
 * v2 Do'kon (dizayn: 43 · Shop).
 *
 * Mahsulotlar eski shop/index.tsx dagi manbadan: mobile-content `shop`
 * (CRM bilan birlashtirilgan), bo'sh bo'lsa statik SHOP_PRODUCTS. Balans —
 * coinsStore. Dizayndagi "Qo'shimcha kitoblar" bo'limi `books`
 * kategoriyasi; boshqa kategoriyalar ham (eski do'konda bor edi) xuddi shu
 * ko'rinishda pastroqda chiqadi. "Streak himoyasi" bonusi serverda yo'q.
 */
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BagIcon, CoinFill } from '@/components/v2/rewards/icons';
import { fmt, HeaderPill, nearestProduct, ScreenHeader, useShopProducts, type ShopProductV2 } from '@/components/v2/rewards/parts';
import { CoinBar, ProductImage } from '@/components/v2/rewards/shopParts';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { BATTLE_WIN_COINS } from '@/data/mock';
import { SHOP_CATEGORY_LABELS, type ShopCategory } from '@/data/shopProducts';
import { useLang, localizeCourseWording } from '@/i18n/LanguageContext';
import { useCoins } from '@/services/coinsStore';

const ORDER: ShopCategory[] = ['books', 'merch', 'gadgets', 'stationery'];
// Streak himoyasi narxi — dizayndagi qiymat (bonus hali sotilmaydi).
const STREAK_SHIELD_PRICE = 150;

function ProductCard({ p, coins, nearest }: { p: ShopProductV2; coins: number; nearest: boolean }) {
  const missing = Math.max(0, p.price - coins);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${p.name}, ${fmt(p.price)} coin`}
      onPress={() => router.push(R.shopItem(p.id) as never)}
      style={({ pressed }) => [styles.card, nearest && { borderColor: '#087A4A' }, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.cardImgWrap}>
        <ProductImage product={p} style={StyleSheet.absoluteFill} />
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

export default function V2Shop() {
  const coins = useCoins();
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
        right={<HeaderPill label="Buyurtmalar" icon={<BagIcon />} onPress={() => router.push(R.orders as never)} />}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <View style={styles.balance}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.balLabel}>Balansingiz</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CoinFill size={26} />
                <Text style={styles.balValue}>{fmt(coins)}</Text>
              </View>
              <Text style={styles.balLabelSm}>coin</Text>
            </View>
            <View style={styles.howTo}>
              <Text style={[styles.howText, { color: '#FFFFFF', fontFamily: fonts.bodyHeavy }]}>Qanday yigʻiladi:</Text>
              <Text style={styles.howText}>Uyga vazifa <Text style={styles.howNum}>+60</Text></Text>
              <Text style={styles.howText}>Yuzma-yuz oʻyin <Text style={styles.howNum}>+{BATTLE_WIN_COINS}</Text></Text>
              <Text style={styles.howText}>Doʻst taklifi <Text style={styles.howNum}>+100</Text></Text>
            </View>
          </View>

          {groups.map((g, gi) => (
            <View key={g.cat} style={{ gap: 10, marginTop: gi === 0 ? 4 : 6 }}>
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
              onPress={() => router.push(R.orders as never)}
              style={({ pressed }) => [styles.bonusBtn, pressed && { opacity: 0.85 }]}
            >
              <CoinFill size={16} />
              <Text style={styles.bonusBtnText}>{STREAK_SHIELD_PRICE}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
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
  howTo: { gap: 3, borderLeftWidth: 1, borderLeftColor: '#263048', paddingLeft: 12 },
  howText: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 17, color: '#C9D0DE' },
  howNum: { fontFamily: fonts.bodyHeavy, color: '#FFC93C' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 2 },
  h2: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 17, color: '#0B1220' },
  sectionNote: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, color: '#4A5468' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, rowGap: 10 },
  gridCell: { width: '50%', paddingHorizontal: 5 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 22, paddingTop: 6, paddingHorizontal: 6, paddingBottom: 10, gap: 7, flex: 1 },
  cardImgWrap: { height: 112, borderRadius: 17, overflow: 'hidden', backgroundColor: '#ECECEE' },
  nearest: { position: 'absolute', bottom: 8, left: 8, height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: '#087A4A', justifyContent: 'center' },
  nearestText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 11, color: '#FFFFFF' },
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
