/**
 * Kompyuter: Do'kon (dizayn: D_Shop).
 *
 * Mahsulotlar mobil do'kondagi bilan bir xil: useShopProducts — faqat
 * o'quvchining kursiga tegishli kitoblar (mobile-content `shop`, bo'sh bo'lsa
 * statik baza). Balans — coinsStore. "Eng yaqini" — coin yetmagan eng arzon
 * kitob. Streak himoyasi: StreakConfirm → OrderSuccess (mobil kabi, coin yechilmaydi).
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
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
  useShopProducts,
  type ShopProductV2,
} from '@/components/v2/rewards/parts';
import { ProductCover } from '@/components/v2/rewards/shopParts';
import { V2_BATTLE_WIN_COINS } from '@/constants/v2/battle';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { localizeCourseWording, useLang } from '@/i18n/LanguageContext';
import { useCoins } from '@/services/coinsStore';

import { HeadTitle, HeaderButton, IBag, IChevron, ICoin, ITruck, T } from './ui';

// Streak himoyasi narxi — dizayndagi qiymat (mobil kabi; bonus serverda yo'q).
const STREAK_SHIELD_PRICE = 150;

// "Qanday yig'iladi" — dizayndagi tartib (2 ustun, chapdan o'ngga).
const EARN_ROWS: { label: string; note?: string; value: string }[] = [
  { label: 'Uyga vazifa', value: EARN_HOMEWORK },
  { label: 'Dars yakuni', value: `+${EARN_LESSON_DONE}` },
  { label: 'Yuzma-yuz gʻalaba', value: `+${V2_BATTLE_WIN_COINS}` },
  { label: 'Bonus dars', note: '(oxirigacha)', value: `+${EARN_BONUS_LESSON}` },
  {
    label: 'Liga top-5',
    note: '(hafta oxirida)',
    value: `+${EARN_LEAGUE_TOP5}`,
  },
  { label: 'Doʻst taklifi', value: `+${EARN_REFERRAL}` },
];

const go = (href: string) => router.push(href as Href);

type Popup = null | 'streak-confirm' | 'order-success';

export function DShop() {
  const coins = useCoins();
  const params = useLocalSearchParams<{ popup?: string }>();
  const [popup, setPopup] = useState<Popup>(null);
  useEffect(() => {
    if (params.popup === 'streak-confirm' || params.popup === 'order-success') setPopup(params.popup);
  }, [params.popup]);
  const products = useShopProducts();
  const { lang, courseLang } = useLang();
  const nearest = products ? nearestProduct(products, coins) : null;
  const brand = localizeCourseWording('Homework', lang, courseLang);
  // Dizayndagi tartib: arzonidan qimmatiga.
  const books = (products ?? []).slice().sort((a, b) => a.price - b.price);
  const missing = nearest ? Math.max(0, nearest.price - coins) : 0;

  return (
    <DesktopPage
      title="Doʻkon"
      titleSlot={<HeadTitle over={brand} title="Doʻkon" />}
      actions={<HeaderButton label="Buyurtmalarim" icon={<IBag />} onPress={() => go(R.orders)} />}
      contentStyle={{ paddingBottom: 32, gap: 22 }}
    >
      <View style={s.balance}>
        <View style={{ width: 250, gap: 4 }}>
          <T size={14} color="#B8C1D6">
            Balansingiz
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ICoin size={42} />
            <T f="display" size={52} lh={55} color="#FFFFFF" style={{ letterSpacing: -0.52 }}>
              {fmt(coins)}
            </T>
          </View>
          {nearest ? (
            <>
              <T size={14} color="#B8C1D6">
                coin · eng yaqin kitobgacha{' '}
                <T f="bodyHeavy" size={14} color="#FFC93C">
                  {fmt(missing)}
                </T>
              </T>
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
                {fmt(coins)} / {fmt(nearest.price)} · «{nearest.name}» · ~{lessonsFor(missing)} dars
              </T>
            </>
          ) : (
            <T size={14} color="#B8C1D6">
              coin
            </T>
          )}
        </View>
        <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: '#263048' }} />
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <T f="bodyHeavy" size={15} color="#FFFFFF">
            Qanday yigʻiladi
          </T>
          <View style={{ flexDirection: 'row', gap: 28 }}>
            {[0, 1].map((c) => (
              <View key={c} style={{ flex: 1, minWidth: 0 }}>
                {EARN_ROWS.filter((_, i) => i % 2 === c).map((r) => (
                  <View key={r.label} style={s.earnRow}>
                    <T size={14} color="#C9D0DE" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {r.label}
                      {r.note ? (
                        <T f="body" size={14} color="#A9B3C8">
                          {' '}
                          {r.note}
                        </T>
                      ) : null}
                    </T>
                    <T f="bodyHeavy" size={14} color="#FFC93C" numberOfLines={1}>
                      {r.value}
                    </T>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
        <Image
          source={designImages['4c789e89b37702b538b456ab2b9310fa']}
          style={{
            width: 150,
            height: 150,
            marginVertical: -12,
            marginRight: -6,
          }}
          resizeMode="contain"
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>

      {books.length > 0 && (
        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <T f="bodyHeavy" size={19} accessibilityRole="header">
              Qoʻshimcha kitoblar
            </T>
            {books.every((p) => p.delivered) && (
              <T size={14} color="#4A5468">
                Bosma · uyga bepul yetkaziladi
              </T>
            )}
          </View>
          <View style={s.grid}>
            {books.map((p) => (
              <View key={p.id} style={s.cell}>
                <BookCard p={p} coins={coins} nearest={nearest?.id === p.id} />
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <T f="bodyHeavy" size={19} accessibilityRole="header" style={{ flex: 1 }}>
            Ilova bonusi
          </T>
          <T f="bodyHeavy" size={19} accessibilityRole="header" style={{ flex: 1 }}>
            Yetkazib berish
          </T>
        </View>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <View style={[s.wide, { paddingRight: 14 }]}>
            <View style={[s.wideIcon, { backgroundColor: '#E8EEFF' }]}>
              <Image
                source={designImages.f1f2b5015be3aab0bfaac974e1e01af0}
                style={{ width: 58, height: 58 }}
                resizeMode="contain"
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <T f="bodyHeavy" size={16}>
                Streak himoyasi
              </T>
              <T f="body" size={14} color="#4A5468">
                Dars qoldirgan kuni seriya saqlanadi
              </T>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Streak himoyasini ${STREAK_SHIELD_PRICE} coinga olish`}
              onPress={() => setPopup('streak-confirm')}
              style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.buy, hovered && { backgroundColor: '#076B40' }]}
            >
              <ICoin size={18} />
              <T f="bodyHeavy" size={15} color="#FFFFFF">
                {STREAK_SHIELD_PRICE} · Olish
              </T>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="link"
            onPress={() => go(R.orders)}
            style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.wide, { paddingRight: 18 }, hovered && { backgroundColor: '#FAFBFD' }]}
          >
            <View style={[s.wideIcon, { backgroundColor: '#FFF4D1' }]}>
              <ITruck size={28} color="#7A5300" />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <T f="bodyHeavy" size={16}>
                Buyurtmalarim
              </T>
              <T f="body" size={14} color="#4A5468">
                Kitob yetkazilishi va bonuslar tarixi
              </T>
            </View>
            <IChevron />
          </Pressable>
        </View>
      </View>

      <StreakConfirmPopup visible={popup === 'streak-confirm'} price={STREAK_SHIELD_PRICE} onClose={() => setPopup(null)} onConfirm={() => setPopup('order-success')} />
      <OrderSuccessPopup visible={popup === 'order-success'} price={STREAK_SHIELD_PRICE} onClose={() => setPopup(null)} />
    </DesktopPage>
  );
}

function BookCard({ p, coins, nearest }: { p: ShopProductV2; coins: number; nearest: boolean }) {
  const missing = Math.max(0, p.price - coins);
  const pct = Math.round(Math.max(0, Math.min(1, coins / Math.max(1, p.price))) * 100);
  const bg = p.coverBg ?? '#EAE4DF';
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${p.name}, ${fmt(p.price)} coin`}
      onPress={() => go(R.shopItem(p.id))}
      style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.card, nearest && { borderColor: '#087A4A' }, hovered && !nearest && { borderColor: '#E4E8F0' }]}
    >
      <View style={[s.cover, { backgroundColor: bg }]}>
        <ProductCover product={p} size={210} bg={bg} fade={0.14} iconSize={72} />
        {nearest && (
          <View style={s.nearest}>
            <T f="bodyHeavy" size={12} color="#FFFFFF">
              Eng yaqini
            </T>
          </View>
        )}
      </View>
      <View style={{ paddingHorizontal: 8, gap: 8 }}>
        <View style={{ gap: 1 }}>
          <T f="bodyHeavy" size={17} lh={21} numberOfLines={2}>
            {p.name}
          </T>
          {!!(p.subtitle || p.delivered) && (
            <T f="body" size={13} color="#4A5468" numberOfLines={1}>
              {p.subtitle ?? 'Yetkazib beriladi'}
            </T>
          )}
        </View>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} style={s.bar}>
          <View style={[s.barFill, { width: `${pct}%` }]} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ICoin size={18} />
          <T f="bodyHeavy" size={16}>
            {fmt(p.price)}
          </T>
          <View style={{ flex: 1 }} />
          <T size={14} color="#4A5468">
            {missing > 0 ? `yana ${fmt(missing)}` : 'yetadi'}
          </T>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  balance: {
    backgroundColor: '#0B1220',
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
    overflow: 'hidden',
  },
  balTrack: {
    width: 220,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#263048',
    overflow: 'hidden',
    marginTop: 8,
  },
  balFill: { height: 8, borderRadius: 4, backgroundColor: '#F5B70A' },
  earnRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2940',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -9,
    rowGap: 18,
  },
  cell: { width: '25%', paddingHorizontal: 9 },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 26,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 16,
    gap: 12,
  },
  cover: {
    height: 210,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  nearest: {
    position: 'absolute',
    top: 12,
    left: 12,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: '#087A4A',
    justifyContent: 'center',
  },
  bar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EEF1F7',
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#F5B70A' },
  wide: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 12,
    paddingLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  wideIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buy: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#087A4A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
});
