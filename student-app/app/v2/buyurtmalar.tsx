/**
 * v2 Buyurtmalarim (dizayn: 47 · Orders).
 *
 * Buyurtmalar eski shop/orders.tsx dagi kabi shopStore.useOrders
 * (/api/state/demo-shop-orders) dan — CRM'da bosqich o'zgarsa shu yerda
 * ko'rinadi. "Streak himoyasi" bonusi serverda yo'q — karta 0 dona
 * holatida. Buyurtma bo'lmasa — dizayndagi bo'sh holat (eng yaqin mahsulot).
 */
import { router } from 'expo-router';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChevronRightIcon, CoinFill, LongArrowIcon, TICK2, TickIcon } from '@/components/v2/rewards/icons';
import {
  EARN_BONUS_LESSON,
  EARN_HOMEWORK,
  EARN_LEAGUE_TOP5,
  EARN_LESSON_DONE,
  EARN_REFERRAL,
  fmt,
  lessonsFor,
  nearestProduct,
  ScreenHeader,
  useShopProducts,
} from '@/components/v2/rewards/parts';
import { CoinBar, ProductImage } from '@/components/v2/rewards/shopParts';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { V2_BATTLE_WIN_COINS } from '@/constants/v2/battle';
import { DELIVERY_STAGE_LABELS } from '@/data/mock';
import { useCoins } from '@/services/coinsStore';
import { useOrders, type ShopOrder } from '@/services/shopStore';

// "Coin qanday yig'iladi" katakchalari — dizayndagi tartibda (2 ustun: 1.3fr / 1fr).
const EARN: [string, string][] = [
  ['Uyga vazifa', EARN_HOMEWORK],
  ['Dars yakuni', `+${EARN_LESSON_DONE}`],
  ['Yuzma-yuz gʻalaba', `+${V2_BATTLE_WIN_COINS}`],
  ['Bonus dars', `+${EARN_BONUS_LESSON}`],
  ['Doʻst taklifi', `+${EARN_REFERRAL}`],
  ['Liga top-5', `+${EARN_LEAGUE_TOP5}`],
];

const DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const pad = (n: number) => String(n).padStart(2, '0');
/** "2026-10-10" / Date → "10.10 · Shanba" */
function dayLabel(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} · ${DAYS[d.getDay()]}`;
}

function OrderCard({ o }: { o: ShopOrder & { createdAt?: string } }) {
  const products = useShopProducts();
  const p = products?.find((x) => x.id === o.productId);
  const delivered = o.stage === 'delivered';
  const lastDate = o.deliveredAt ?? o.dispatchedAt ?? null;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {p ? <ProductImage product={p} style={styles.thumb} iconSize={28} /> : <View style={styles.thumb} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.cardTitle} numberOfLines={2}>{o.productName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <CoinFill size={14} />
            <Text style={styles.cardSub}>{fmt(o.price)} coin · 1 dona</Text>
          </View>
        </View>
        <View style={[styles.chip, !delivered && { backgroundColor: '#F0F3FF' }]}>
          {delivered && <TickIcon size={13} color="#075E3A" strokeWidth={3} d={TICK2} />}
          <Text style={[styles.chipText, !delivered && { color: '#1E3FD1' }]}>{DELIVERY_STAGE_LABELS[o.stage] ?? o.stage}</Text>
        </View>
      </View>
      <View style={styles.dates}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dateLabel}>Buyurtma qilindi</Text>
          <Text style={styles.dateVal}>{dayLabel(o.date)}</Text>
        </View>
        <LongArrowIcon />
        <View style={{ flex: 1.2 }}>
          <Text style={styles.dateLabel}>{DELIVERY_STAGE_LABELS[o.stage] ?? o.stage}</Text>
          <Text style={styles.dateVal}>{dayLabel(lastDate)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function V2Orders() {
  const orders = useOrders();
  const coins = useCoins();
  const products = useShopProducts();
  const nearest = products ? nearestProduct(products, coins) : null;
  const books = orders.filter((o) => o.category === 'books');
  const others = orders.filter((o) => o.category !== 'books');

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Buyurtmalarim" fallback={R.shop} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <Text style={styles.section}>Ilova bonuslari</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push(R.streak as never)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
            <View style={styles.cardTop}>
              <View style={styles.bonusImg}>
                <Image source={designImages.f1f2b5015be3aab0bfaac974e1e01af0} style={{ width: 52, height: 52 }} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.cardTitle}>Streak himoyasi</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <CoinFill size={14} />
                  <Text style={styles.cardSub}>150 coin · 0 dona</Text>
                </View>
              </View>
              {/* "✓ Ishlatildi" belgisi faqat himoya haqiqatan ishlatilganda — streak serverda yo'q, shuning uchun belgi yo'q. */}
            </View>
            <View style={styles.dates}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateLabel}>Sotib olindi</Text>
                <Text style={styles.dateVal}>—</Text>
              </View>
              <LongArrowIcon />
              <View style={{ flex: 1.2 }}>
                <Text style={styles.dateLabel}>Ishlatildi</Text>
                <Text style={styles.dateVal}>—</Text>
              </View>
              <ChevronRightIcon size={18} color="#6B7489" strokeWidth={2.2} />
            </View>
          </Pressable>

          <Text style={[styles.section, { marginTop: 8 }]}>Kitoblar</Text>
          {books.length ? (
            books.map((o) => <OrderCard key={o.id} o={o} />)
          ) : (
            <View style={styles.empty}>
              <Image source={designImages.e57b4e5aeb29652a1e91b899a8e24693} accessibilityLabel="Kitob oʻqiyotgan Domik" style={{ width: 104, height: 98 }} resizeMode="contain" />
              <Text style={styles.emptyTitle}>Hali kitob buyurtma qilinmagan</Text>
              {nearest ? (
                <>
                  <Text style={styles.emptyText}>
                    Eng yaqini — «{nearest.name}». Yana <Text style={{ fontFamily: fonts.bodyHeavy, color: '#7A5300' }}>{fmt(nearest.price - coins)} coin</Text> qoldi, taxminan {lessonsFor(nearest.price - coins)} dars.
                  </Text>
                  <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
                    <View style={{ flex: 1 }}><CoinBar value={coins / nearest.price} height={8} /></View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <CoinFill size={15} />
                      <Text style={styles.ratio}>{fmt(coins)} / {fmt(nearest.price)}</Text>
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.emptyText}>Coiningiz har qanday mahsulotga yetadi.</Text>
              )}
              <Pressable accessibilityRole="link" onPress={() => router.push(R.shop as never)} style={({ pressed }) => [styles.cta, pressed && { backgroundColor: '#1E3FD1' }]}>
                <Text style={styles.ctaText}>Doʻkonga oʻtish</Text>
              </Pressable>
            </View>
          )}

          {others.length > 0 && (
            <>
              <Text style={[styles.section, { marginTop: 8 }]}>Boshqa mahsulotlar</Text>
              {others.map((o) => <OrderCard key={o.id} o={o} />)}
            </>
          )}

          <View style={styles.earn}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CoinFill size={18} />
              <Text accessibilityRole="header" style={styles.earnTitle}>Coin qanday yigʻiladi</Text>
              <Text style={styles.earnBal}>Balans: {fmt(coins)}</Text>
            </View>
            {/* Dizayndagi grid (1.3fr / 1fr, matn bir qatorda): ustun matnidan tor bo'lmaydi. */}
            <View style={styles.earnGrid}>
              {[0, 1].map((c) => (
                <View key={c} style={[styles.earnCol, { flexGrow: c === 0 ? 1.3 : 1 }]}>
                  {EARN.filter((_, i) => i % 2 === c).map(([label, value]) => (
                    <View key={label} style={styles.earnCell}>
                      <Text style={styles.earnLabel} numberOfLines={1}>{label}</Text>
                      <Text style={styles.earnValue} numberOfLines={1}>{value}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 32 },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 10 },
  section: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468', letterSpacing: 0.72, textTransform: 'uppercase', paddingLeft: 4 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 14, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#ECECEE' },
  bonusImg: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, lineHeight: 21, color: '#0B1220' },
  cardSub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, color: '#4A5468' },
  chip: { height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: '#E3F7EE', flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#075E3A' },
  dates: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F4F6FA', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 },
  dateLabel: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468' },
  dateVal: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, lineHeight: 19, color: '#0B1220' },
  empty: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingTop: 14, paddingHorizontal: 18, paddingBottom: 18, alignItems: 'center', gap: 8 },
  earn: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 14, gap: 10 },
  earnTitle: { flex: 1, fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#0B1220' },
  earnBal: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, color: '#4A5468' },
  earnGrid: { flexDirection: 'row', gap: 6 },
  earnCol: { flexBasis: 0, gap: 6, ...(Platform.OS === 'web' ? ({ minWidth: 'min-content' } as object) : { minWidth: 0 }) },
  earnCell: { minHeight: 34, paddingHorizontal: 9, borderRadius: 12, backgroundColor: '#F4F6FA', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  earnLabel: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, color: '#26304A', flexShrink: 1 },
  earnValue: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, color: '#7A5300' },
  emptyTitle: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 20, lineHeight: 24, color: '#0B1220', textAlign: 'center' },
  emptyText: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 14, lineHeight: 20.3, color: '#4A5468', textAlign: 'center' },
  ratio: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, color: '#0B1220' },
  cta: { width: '100%', height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  ctaText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, color: '#FFFFFF' },
});
