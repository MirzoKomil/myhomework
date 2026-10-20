/**
 * Kompyuter: Buyurtmalarim (dizayn: D_Orders).
 *
 * Buyurtmalar mobil ekrandagi kabi shopStore.useOrders
 * (/api/state/demo-shop-orders). Streak himoyasi serverda yo'q — qator
 * "0 dona", sanalar "—", holat belgisi yo'q (mobil kabi). Kitob buyurtmasi
 * bo'lmasa — dizayndagi bo'sh holat (eng yaqin kitob). "Sarflash"dagi
 * kitob narxlari oralig'i — do'kondagi haqiqiy kitoblardan.
 */
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { DesktopPage } from '@/components/v2/desktop/Shell';
import { OrderSuccessPopup } from '@/components/v2/popups/OrderSuccess';
import { StreakConfirmPopup } from '@/components/v2/popups/StreakConfirm';
import {
  EARN_BONUS_LESSON,
  EARN_HOMEWORK,
  EARN_LEAGUE_TOP5,
  EARN_LESSON_DONE,
  EARN_REFERRAL,
  fmt,
  lessonsFor,
  nearestProduct,
  productImages,
  useShopProducts,
  type ShopProductV2,
} from '@/components/v2/rewards/parts';
import { V2_BATTLE_WIN_COINS } from '@/constants/v2/battle';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { DELIVERY_STAGE_LABELS } from '@/data/mock';
import { useCoins } from '@/services/coinsStore';
import { useOrders, type ShopOrder } from '@/services/shopStore';

import { caps, DButton, IBag, ICheck, IChevron, ICoin, T } from './ui';

const SHIELD_PRICE = 150;
// O'yinlardagi "Maslahat" narxi (mashq/sirli-soz, songgi-harf bilan bir xil).
const HINT_PRICE = 10;
const COLS = { price: 90, date: 230, status: 170 };

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
/** "2026-10-10" / Date → "10.10 · Shanba" (mobil kabi). */
function dayLabel(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} · ${DAYS[d.getDay()]}`;
}

const go = (href: string) => router.push(href as Href);

type Popup = null | 'streak-confirm' | 'order-success';

export function DOrders() {
  const orders = useOrders();
  const coins = useCoins();
  const products = useShopProducts();
  const [popup, setPopup] = useState<Popup>(null);
  const nearest = products ? nearestProduct(products, coins) : null;
  const books = orders.filter((o) => o.category === 'books');
  const others = orders.filter((o) => o.category !== 'books');
  const shelf = (products ?? []).slice().sort((a, b) => a.price - b.price);
  const prices = shelf.map((p) => p.price);
  const bookRange = prices.length ? (prices[0] === prices[prices.length - 1] ? fmt(prices[0]) : `${fmt(prices[0])}–${fmt(prices[prices.length - 1])}`) : '—';
  const missing = nearest ? Math.max(0, nearest.price - coins) : 0;
  const spend: [string, string][] = [
    ['Kitoblar', bookRange],
    ['Streak himoyasi', String(SHIELD_PRICE)],
    ['Oʻyinda «Maslahat»', `−${HINT_PRICE}`],
  ];

  return (
    <DesktopPage
      title="Buyurtmalarim"
      subtitle="Doʻkon · kitoblar va ilova bonuslari"
      back={R.shop}
      contentStyle={{
        flex: 1,
        paddingBottom: 32,
        flexDirection: 'row',
        gap: 24,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 22 }}>
        <View style={{ gap: 12 }}>
          <T f="bodyHeavy" size={19} accessibilityRole="header">
            Ilova bonuslari
          </T>
          <View style={s.table}>
            <TableHead />
            <Pressable
              accessibilityRole="link"
              onPress={() => go(R.streak)}
              style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.row, { backgroundColor: hovered ? '#EEF1F7' : '#F4F6FA' }]}
            >
              <View style={s.prodCol}>
                <View style={[s.thumb, { backgroundColor: '#E8EEFF' }]}>
                  <Image
                    source={designImages.f1f2b5015be3aab0bfaac974e1e01af0}
                    style={{ width: 54, height: 54 }}
                    resizeMode="contain"
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                </View>
                <View style={{ gap: 2 }}>
                  <T f="bodyHeavy" size={16} numberOfLines={1}>
                    Streak himoyasi
                  </T>
                  <T size={14} color="#4A5468" numberOfLines={1}>
                    {SHIELD_PRICE} coin · 0 dona
                  </T>
                </View>
              </View>
              <PriceCell n={SHIELD_PRICE} />
              <View style={{ width: COLS.date, gap: 3 }}>
                <DateLine label="Sotib olindi" value="—" />
                <DateLine label="Ishlatildi" value="—" />
              </View>
              {/* "Ishlatildi" belgisi faqat himoya haqiqatan ishlatilganda — streak himoyasi serverda yo'q. */}
              <View style={[s.statusCol, { justifyContent: 'flex-end' }]}>
                <IChevron />
              </View>
            </Pressable>
          </View>
        </View>

        <View style={{ flex: 1, gap: 12 }}>
          <T f="bodyHeavy" size={19} accessibilityRole="header">
            Kitoblar
          </T>
          <View style={s.books}>
            {books.length ? (
              <View style={{ flex: 1 }}>
                <TableHead />
                <View style={{ gap: 6 }}>
                  {books.map((o) => (
                    <OrderRow key={o.id} o={o} p={products?.find((x) => x.id === o.productId)} />
                  ))}
                </View>
              </View>
            ) : (
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 30,
                }}
              >
                <Image
                  source={designImages.e57b4e5aeb29652a1e91b899a8e24693}
                  accessibilityLabel="Kitob oʻqiyotgan Domik"
                  style={{ width: 210, height: 210 }}
                  resizeMode="contain"
                />
                <View style={{ flex: 1, gap: 12, maxWidth: 470 }}>
                  <T f="display" size={28} lh={32} style={{ letterSpacing: -0.56 }}>
                    Hali kitob buyurtma qilinmagan
                  </T>
                  {nearest ? (
                    <>
                      <T f="body" size={16} lh={24} color="#4A5468">
                        Eng yaqini — «{nearest.name}». Yana{' '}
                        <T f="bodyBold" size={16} color="#7A5300">
                          {fmt(missing)} coin
                        </T>{' '}
                        qoldi, taxminan {lessonsFor(missing)} dars.
                      </T>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <View style={s.bigTrack}>
                          <View
                            style={[
                              s.bigFill,
                              {
                                width: `${Math.round(Math.min(1, coins / Math.max(1, nearest.price)) * 100)}%`,
                              },
                            ]}
                          />
                        </View>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <ICoin size={16} />
                          <T f="bodyHeavy" size={15}>
                            {fmt(coins)} / {fmt(nearest.price)}
                          </T>
                        </View>
                      </View>
                    </>
                  ) : (
                    <T f="body" size={16} lh={24} color="#4A5468">
                      Coiningiz har qanday mahsulotga yetadi.
                    </T>
                  )}
                  <View style={{ flexDirection: 'row', marginTop: 4 }}>
                    <DButton label="Doʻkonga oʻtish" icon={<IBag color="#FFFFFF" sw={2.2} />} onPress={() => go(R.shop)} />
                  </View>
                </View>
              </View>
            )}
            {shelf.length > 0 && (
              <View style={s.shelf}>
                <T f="bodyHeavy" size={12} color="#4A5468" style={caps()}>
                  Doʻkondagi kitoblar
                </T>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {shelf.slice(0, 4).map((p) => (
                    <ShelfBook key={p.id} p={p} coins={coins} />
                  ))}
                  {Array.from({ length: Math.max(0, 4 - shelf.length) }, (_, k) => (
                    <View key={`e${k}`} style={{ flex: 1 }} />
                  ))}
                </View>
              </View>
            )}
          </View>
          {others.length > 0 && (
            <>
              <T f="bodyHeavy" size={19} accessibilityRole="header">
                Boshqa mahsulotlar
              </T>
              <View style={s.table}>
                <TableHead />
                <View style={{ gap: 6 }}>
                  {others.map((o) => (
                    <OrderRow key={o.id} o={o} p={products?.find((x) => x.id === o.productId)} />
                  ))}
                </View>
              </View>
            </>
          )}
        </View>
      </View>

      <View style={{ width: 330, gap: 14 }}>
        <View style={s.balance}>
          <Image source={designImages['4c789e89b37702b538b456ab2b9310fa']} style={s.balImg} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />
          <T size={14} color="#B8C1D6">
            Balansingiz
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ICoin size={32} />
            <T f="display" size={40} lh={42} color="#FFFFFF" style={{ letterSpacing: -0.4 }}>
              {fmt(coins)}
            </T>
          </View>
          {nearest && (
            <>
              <View style={s.balTrack}>
                <View
                  style={[
                    s.balFill,
                    {
                      width: `${Math.round(Math.min(1, coins / Math.max(1, nearest.price)) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <T size={13} color="#B8C1D6">
                {fmt(coins)} / {fmt(nearest.price)} · «{nearest.name}»gacha {fmt(missing)}
              </T>
            </>
          )}
        </View>
        <View style={s.earn}>
          <T f="bodyHeavy" size={19} accessibilityRole="header">
            Coin qanday yigʻiladi
          </T>
          <View style={{ marginTop: 6 }}>
            {EARN.map(([l, v], i) => (
              <ListRow key={l} label={l} value={v} first={i === 0} color="#7A5300" />
            ))}
          </View>
          <T f="bodyHeavy" size={12} color="#4A5468" style={[caps(), { marginTop: 14 }]}>
            Sarflash
          </T>
          <View style={{ marginTop: 4 }}>
            {spend.map(([l, v], i) => (
              <ListRow key={l} label={l} value={v} first={i === 0} color="#0B1220" />
            ))}
          </View>
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => setPopup('streak-confirm')}
          style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.shield, hovered && { backgroundColor: '#FAFBFD' }]}
        >
          <View
            style={[
              s.thumb,
              {
                width: 52,
                height: 52,
                borderRadius: 16,
                backgroundColor: '#E8EEFF',
              },
            ]}
          >
            <Image
              source={designImages.f1f2b5015be3aab0bfaac974e1e01af0}
              style={{ width: 48, height: 48 }}
              resizeMode="contain"
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </View>
          <View style={{ flex: 1 }}>
            <T f="bodyHeavy" size={15}>
              Streak himoyasi
            </T>
            <T size={13} color="#4A5468">
              Faol himoya yoʻq · {SHIELD_PRICE} coin
            </T>
          </View>
          <IChevron />
        </Pressable>
      </View>
      <StreakConfirmPopup visible={popup === 'streak-confirm'} price={SHIELD_PRICE} onClose={() => setPopup(null)} onConfirm={() => setPopup('order-success')} />
      <OrderSuccessPopup visible={popup === 'order-success'} price={SHIELD_PRICE} onClose={() => setPopup(null)} />
    </DesktopPage>
  );
}

function TableHead() {
  return (
    <View style={s.thead} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <T f="bodyHeavy" size={12} color="#4A5468" style={[caps(), { flex: 1 }]}>
        Mahsulot
      </T>
      <T f="bodyHeavy" size={12} color="#4A5468" style={[caps(), { width: COLS.price }]}>
        Narxi
      </T>
      <T f="bodyHeavy" size={12} color="#4A5468" style={[caps(), { width: COLS.date }]}>
        Sana
      </T>
      <T f="bodyHeavy" size={12} color="#4A5468" style={[caps(), { width: COLS.status }]}>
        Holati
      </T>
    </View>
  );
}

function PriceCell({ n }: { n: number }) {
  return (
    <View
      style={{
        width: COLS.price,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <ICoin size={16} />
      <T f="bodyHeavy" size={16}>
        {fmt(n)}
      </T>
    </View>
  );
}

function DateLine({ label, value }: { label: string; value: string }) {
  return (
    <T size={14} color="#4A5468" numberOfLines={1}>
      {label} ·{' '}
      <T f="bodyBold" size={14}>
        {value}
      </T>
    </T>
  );
}

function OrderRow({ o, p }: { o: ShopOrder; p?: ShopProductV2 }) {
  const delivered = o.stage === 'delivered';
  const stage = DELIVERY_STAGE_LABELS[o.stage] ?? o.stage;
  const cover = p ? productImages(p)[0] : undefined;
  return (
    <View style={[s.row, { backgroundColor: '#F4F6FA' }]}>
      <View style={s.prodCol}>
        <View style={[s.thumb, { backgroundColor: p?.coverBg ?? '#EAE4DF' }]}>
          {cover ? <Image source={{ uri: cover }} style={{ width: 60, height: 60 }} resizeMode="contain" /> : null}
        </View>
        <View style={{ gap: 2, minWidth: 0, flexShrink: 1 }}>
          <T f="bodyHeavy" size={16} numberOfLines={1}>
            {o.productName}
          </T>
          <T size={14} color="#4A5468" numberOfLines={1}>
            {fmt(o.price)} coin · 1 dona
          </T>
        </View>
      </View>
      <PriceCell n={o.price} />
      <View style={{ width: COLS.date, gap: 3 }}>
        <DateLine label="Buyurtma qilindi" value={dayLabel(o.date)} />
        <DateLine label={stage} value={dayLabel(o.deliveredAt ?? o.dispatchedAt ?? null)} />
      </View>
      <View style={s.statusCol}>
        <View style={[s.chip, { backgroundColor: delivered ? '#E3F7EE' : '#E8EEFF' }]}>
          {delivered && <ICheck size={14} color="#075E3A" sw={3} />}
          <T f="bodyHeavy" size={13} color={delivered ? '#075E3A' : '#1E3FD1'}>
            {stage}
          </T>
        </View>
      </View>
    </View>
  );
}

function ShelfBook({ p, coins }: { p: ShopProductV2; coins: number }) {
  const uri = productImages(p)[0];
  const pct = Math.round(Math.max(0, Math.min(1, coins / Math.max(1, p.price))) * 100);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${p.name}, ${fmt(p.price)} coin`}
      onPress={() => go(R.shopItem(p.id))}
      style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.shelfCard, hovered && { backgroundColor: '#EEF1F7' }]}
    >
      <View style={s.shelfImg}>{uri ? <Image source={{ uri }} style={{ width: 56, height: 56 }} resizeMode="contain" /> : null}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <T f="bodyHeavy" size={13} numberOfLines={1}>
          {p.name}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <ICoin size={13} />
          <T f="bodyHeavy" size={13} color="#4A5468">
            {fmt(p.price)}
          </T>
        </View>
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: '#E2E6EE',
            overflow: 'hidden',
          }}
        >
          <View style={{ width: `${pct}%`, height: 4, backgroundColor: '#F5B70A' }} />
        </View>
      </View>
    </Pressable>
  );
}

function ListRow({ label, value, first, color }: { label: string; value: string; first: boolean; color: string }) {
  return (
    <View style={[s.listRow, !first && { borderTopWidth: 1, borderTopColor: '#EEF1F7' }]}>
      <T size={15} color="#34405A">
        {label}
      </T>
      <T f="bodyHeavy" size={15} color={color} numberOfLines={1}>
        {value}
      </T>
    </View>
  );
}

const s = StyleSheet.create({
  table: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  thead: {
    height: 36,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  prodCol: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  statusCol: {
    width: COLS.status,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chip: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  books: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 28,
    gap: 20,
  },
  bigTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EEF1F7',
    overflow: 'hidden',
  },
  bigFill: { height: 10, borderRadius: 5, backgroundColor: '#F5B70A' },
  shelf: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F7',
    paddingTop: 16,
  },
  shelfCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#F4F6FA',
    borderRadius: 18,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    overflow: 'hidden',
  },
  shelfImg: {
    width: 48,
    height: 56,
    borderRadius: 13,
    backgroundColor: '#EAE4DF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balance: {
    backgroundColor: '#0B1220',
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 22,
    overflow: 'hidden',
    gap: 6,
  },
  balImg: { position: 'absolute', right: -8, top: -4, width: 104, height: 104 },
  balTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#263048',
    overflow: 'hidden',
    marginTop: 10,
  },
  balFill: { height: 8, borderRadius: 4, backgroundColor: '#F5B70A' },
  earn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 22,
    paddingBottom: 8,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
  },
  shield: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
