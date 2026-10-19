/**
 * Mukofotlar guruhi uchun umumiy bo'laklar: orqaga tugmali sarlavha,
 * raqam formati ("1 000"), do'kon mahsulotlari va liga yordamchilari.
 */
import { router, type Href } from 'expo-router';

import { v2Back } from '@/services/v2Nav';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { designImages } from '@/constants/v2/designImages';
import { fonts } from '@/constants/v2/tokens';
import { SHOP_PRODUCTS, type ShopProduct } from '@/data/shopProducts';
import { fetchMobileContent } from '@/services/contentApi';

import { BackIcon } from './icons';

/** Orqaga: tarix bo'lsa ortga, bo'lmasa (to'g'ridan-to'g'ri ochilgan) ota ekranga. */
export function goBack(fallback: string) {
  v2Back(fallback);
}

/** Dizayndagi raqam ko'rinishi: 1 000, 1 014 (ingichka bo'shliq bilan). */
export function fmt(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function ScreenHeader({ title, fallback, right, overline }: { title: string; fallback: string; right?: ReactNode; overline?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
      <View style={styles.column}>
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            onPress={() => goBack(fallback)}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <BackIcon />
          </Pressable>
          {overline ? (
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.overline}>{overline}</Text>
              <Text accessibilityRole="header" style={[styles.title, { lineHeight: 26 }]}>{title}</Text>
            </View>
          ) : (
            <Text accessibilityRole="header" style={[styles.title, { flex: 1 }]} numberOfLines={1}>{title}</Text>
          )}
          {right}
        </View>
      </View>
    </View>
  );
}

export function HeaderPill({ label, icon, onPress }: { label: string; icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
      {icon}
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}

// ---------- Do'kon ----------

/**
 * CRM mahsulotga qo'shimcha maydonlar (tavsif, afzalliklar, sahifalar
 * rasmlari) yozsa ham shu yerda o'qiladi — shopOverrides istalgan maydonni
 * saqlaydi. Bo'lmasa ekran faqat bor ma'lumotni ko'rsatadi.
 */
export type ShopProductV2 = ShopProduct & {
  subtitle?: string;
  description?: string;
  features?: string[];
  images?: string[];
  pages?: number;
  /** Do'kon kartasidagi muqova foni (CRM bersa); bo'lmasa dizayndagi #EAE4DF. */
  coverBg?: string;
};

let cached: ShopProductV2[] | null = null;

/** Eski do'kon kabi: serverdagi (CRM bilan birlashtirilgan) ro'yxat, bo'sh bo'lsa statik baza. */
export async function loadShopProducts(): Promise<ShopProductV2[]> {
  try {
    const mc = await fetchMobileContent();
    cached = mc.shop.length ? (mc.shop as ShopProductV2[]) : SHOP_PRODUCTS;
  } catch {
    cached = cached ?? SHOP_PRODUCTS;
  }
  return cached;
}

export function useShopProducts(): ShopProductV2[] | null {
  const [list, setList] = useState<ShopProductV2[] | null>(cached);
  useEffect(() => {
    let alive = true;
    loadShopProducts().then((l) => alive && setList(l));
    return () => {
      alive = false;
    };
  }, []);
  return list;
}

export function productImages(p: ShopProductV2): string[] {
  if (p.images?.length) return p.images;
  return p.imageUrl ? [p.imageUrl] : [];
}

/** Tavsif: CRM'dagi matn, bo'lmasa bor maydonlardan yig'iladi. */
export function productDescription(p: { description?: string; category: string; pages?: number; delivered?: boolean }) {
  if (p.description) return p.description;
  const parts: string[] = [];
  if (p.pages) parts.push(`${p.pages} bet`);
  if (p.category === 'books') parts.push('bosma kitob');
  if (p.delivered) parts.push('uyga yetkaziladi');
  return parts.join(' · ');
}

/** Coin yetmagan, eng arzon (eng yaqin) mahsulot — "Eng yaqini" belgisi uchun. */
export function nearestProduct(list: ShopProductV2[], coins: number): ShopProductV2 | null {
  const missing = list.filter((p) => p.price > coins).sort((a, b) => a.price - b.price);
  return missing[0] ?? null;
}

/**
 * Taxminan necha dars kerak — oraliq ("2–3"). Bir dars ≈ vazifa (+1 har
 * to'g'ri javob, odatda 30–50 ta) + dars yakuni +10 → 40–60 coin.
 */
const LESSON_COINS_MIN = 40;
const LESSON_COINS_MAX = 60;
export function lessonsFor(coins: number) {
  const lo = Math.max(1, Math.ceil(coins / LESSON_COINS_MAX));
  const hi = Math.max(1, Math.ceil(coins / LESSON_COINS_MIN));
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}

/** Dizayndagi "Qanday yig'iladi" stavkalari (Do'kon, Buyurtmalar va Checkout'da bir xil). */
export const EARN_HOMEWORK = '+1 / toʻgʻri javob';
export const EARN_LESSON_DONE = 10;
export const EARN_BONUS_LESSON = 10;
export const EARN_LEAGUE_TOP5 = 50;
export const EARN_REFERRAL = 100;

// ---------- Liga ----------

/** Avatar rasmi yo'q o'quvchiga ismiga qarab barqaror dizayn avatari. */
const ANIMALS = [
  '5dbf25e6051b77b37c2186bb3b063150',
  '6fbb4a0364e41f76fd238e0c91d0228b',
  '8e0b816fbe0129a37398f3ed492a0505',
  '93faebd4826b1da6adaee5d0dcda6209',
  'a3708508c0cbf5ab86162c4a6d6cd5e2',
  '1f74e7895823b5bffaf1b36a54ee7fd8',
] as const;

export function fallbackAvatar(name: string): ImageSourcePropType {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return designImages[ANIMALS[h % ANIMALS.length]];
}

/** Server haftani Toshkent vaqti bo'yicha Dushanbadan hisoblaydi (UTC+5). */
const TASHKENT_MS = 5 * 3600 * 1000;

export function weekEnd(now = new Date()): Date {
  const t = new Date(now.getTime() + TASHKENT_MS);
  const dow = t.getUTCDay();
  const daysToSunday = dow === 0 ? 0 : 7 - dow;
  const end = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + daysToSunday, 23, 59, 59);
  return new Date(end - TASHKENT_MS);
}

export function timeLeftLabel(ms: number) {
  const h = Math.max(0, Math.floor(ms / 3600000));
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} kun ${h % 24} soat qoldi`;
  const m = Math.max(0, Math.floor(ms / 60000) % 60);
  return `${h} soat ${m} daqiqa qoldi`;
}

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** Joriy hafta oralig'i: "12–18 oktabr". */
export function currentWeekLabel(now = new Date()) {
  return lastWeekLabel(new Date(now.getTime() + 7 * 86400000));
}

/** O'tgan hafta oralig'i: "5–11 oktabr". */
export function lastWeekLabel(now = new Date()) {
  const end = new Date(weekEnd(now).getTime() - 7 * 86400000 + TASHKENT_MS);
  const start = new Date(end.getTime() - 6 * 86400000);
  const s = start.getUTCDate();
  const e = end.getUTCDate();
  if (start.getUTCMonth() === end.getUTCMonth()) return `${s}–${e} ${MONTHS[end.getUTCMonth()]}`;
  return `${s} ${MONTHS[start.getUTCMonth()]} – ${e} ${MONTHS[end.getUTCMonth()]}`;
}

export const TIERS = [
  { name: 'Bronza', color: '#E8C7A8' },
  { name: 'Kumush', color: '#E2E7F0' },
  { name: 'Oltin', color: '#FFD66B' },
  { name: 'Zumrad', color: '#7EE2B8' },
  { name: 'Olmos', color: '#B8C8FF' },
] as const;

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20 },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  overline: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: 'uppercase', color: '#4A5468' },
  title: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 24, lineHeight: 28, letterSpacing: -0.48, color: '#0B1220' },
  pill: { height: 44, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, color: '#0B1220' },
});
