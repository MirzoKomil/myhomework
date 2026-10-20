/**
 * Kompyuter qobig'i (dizayn: D_*.dc.html, 1440×900).
 *
 * - DesktopSidebar — chap menyu (248px): logo, 6 bo'lim, coin/seriya/chaqmoq
 *   kartasi, daraja va "Ustozga yozish". app/v2/_layout.tsx uni bir marta
 *   chizadi, shuning uchun ekran almashganda qayta yuklanmaydi.
 * - DesktopPage — o'ng tomondagi sahifa: 84px sarlavha (orqaga, nom,
 *   bildirishnoma, profil) va aylantiriladigan kontent (4/40/28 chekka).
 * - FocusFrame — dars ichidagi "fokus" ekranlar: menyusiz, 76px yuqori
 *   panel (Esc — yopish), o'rtada progress, pastda ixtiyoriy tugmalar paneli.
 */
import { router, usePathname, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View, type StyleProp, type ViewStyle } from 'react-native';

import { ContactSheetPopup } from '@/components/v2/popups/ContactSheet';
import { levelName } from '@/components/v2/popups/LevelUp';
import { designImages } from '@/constants/v2/designImages';
import { useV2Level } from '@/constants/v2/levels';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';
import { useAvatarUri } from '@/services/avatarStore';
import { useCoins } from '@/services/coinsStore';
import { v2Back } from '@/services/v2Nav';

import {
  DBackIcon,
  DBagIcon,
  DBellIcon,
  DBoltIcon,
  DCloseIcon,
  DCoinIcon,
  DFlameIcon,
  DHomeIcon,
  DPathIcon,
  DStarIcon,
  DTelegramIcon,
  DTrophyIcon,
  DUserIcon,
} from './icons';
import { useShellInfo } from './shellData';
import { useDesktopKeys } from './useDesktop';

export const SIDEBAR_W = 248;

/** Raqam — dizayndagi kabi minglar bo'sh joy bilan ("2 846"). */
export const fmtNum = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export type NavKey = 'home' | 'lessons' | 'practice' | 'league' | 'shop' | 'profile';

/** Qaysi manzilda menyuning qaysi bandi tanlangan (dizayndagi aria-current). */
export function navKeyFor(path: string): NavKey | null {
  const p = path.replace(/^\/student/, '').replace(/\/$/, '') || '/';
  if (p === '/v2') return 'home';
  const seg = p.split('/')[2] ?? '';
  if (['darslar', 'dars', 'imtihonlar', 'bonus'].includes(seg)) return 'lessons';
  if (['mashq', 'grammatika', 'audiolar', 'dialoglar', 'hikoyalar', 'lugat', 'tarjimon', 'qidiruv', 'takrorlash'].includes(seg)) return 'practice';
  if (seg === 'liga') return 'league';
  if (['dokon', 'buyurtmalar'].includes(seg)) return 'shop';
  if (
    ['profil', 'sertifikatlar', 'shartnoma', 'kurs-tugadi', 'sozlamalar', 'darajalar', 'natijalar', 'jadval', 'ustozlar', 'tolovlar', 'oflayn'].includes(seg)
  )
    return 'profile';
  return null;
}

/**
 * Menyusiz (fokus) ekranlar — dizaynda chap menyu yo'q artboard'lar.
 * Popup artboard'lari (D_LevelUp va h.k.) menyuli ekran ustida ochiladi.
 */
export function isFocusPath(path: string): boolean {
  const p = path.replace(/^\/student/, '').replace(/\/$/, '');
  return [
    /^\/v2\/(login|onboarding|takrorlash|holatlar)$/,
    /^\/v2\/dars\/[^/]+\/(sozlar|audio|slaydlar|slaydlar-toliq|tugadi|tekshiruv|xatolar)$/,
    /^\/v2\/dars\/[^/]+\/vazifa\/[^/]+$/,
    /^\/v2\/mashq\/[^/]+$/,
    /^\/v2\/(bonus|hikoyalar|dialoglar|audiolar)\/[^/]+$/,
    /^\/v2\/dokon\/[^/]+\/rasm$/,
  ].some((re) => re.test(p));
}

/**
 * Kompyuter versiyasi bosqichma-bosqich chiqadi: menyu faqat kompyuter dizayni
 * tayyor bo'lgan sahifalarda chiziladi. Qolgan sahifalar hozircha avvalgidek
 * (telefon ko'rinishi, markazda) ochiladi — menyu ichida mobil ekran chiqmasin.
 */
export function hasDesktopPage(path: string): boolean {
  const p = path.replace(/^\/student/, '').replace(/\/$/, '') || '/';
  return [
    /^\/v2$/,
    /^\/v2\/(bildirishnomalar|darslar|holatlar)$/,
    /^\/v2\/dars\/[^/]+$/,
    /^\/v2\/dars\/[^/]+\/(video|soz-royxati|vazifa|vazifa-natija)$/,
  ].some((re) => re.test(p));
}

const NAV: { key: NavKey; label: string; href: string; Icon: (p: { color: string; strokeWidth?: number }) => ReactNode }[] = [
  { key: 'home', label: 'Bosh sahifa', href: R.home, Icon: DHomeIcon },
  { key: 'lessons', label: 'Darslar', href: R.path, Icon: DPathIcon },
  { key: 'practice', label: 'Mashq', href: R.practice, Icon: DStarIcon },
  { key: 'league', label: 'Liga', href: R.league, Icon: DTrophyIcon },
  { key: 'shop', label: 'Doʻkon', href: R.shop, Icon: DBagIcon },
  { key: 'profile', label: 'Profil', href: R.profile, Icon: DUserIcon },
];

const go = (href: string) => router.push(href as Href);

export function DesktopSidebar() {
  const pathname = usePathname();
  const active = navKeyFor(pathname);
  const coins = useCoins();
  const info = useShellInfo();
  const level = useV2Level();
  const { courseLang } = useLang();
  const [contactOpen, setContactOpen] = useState(false);
  const lvlName = levelName(level.index, courseLang);
  // Qorong'u rejim (D_DarkMain) — menyu ranglari.
  // Faqat bosh sahifa qorong'u variantga ega (boshqa sahifalar doim yorug').
  const dark = useColorScheme() === 'dark' && active === 'home' && /\/v2\/?$/.test(pathname);
  const D = dark ? dk : null;

  return (
    <View accessibilityLabel="Asosiy menyu" style={[s.aside, D?.aside]}>
      <Pressable accessibilityRole="link" accessibilityLabel="Domwork — bosh sahifa" onPress={() => go(R.home)} style={s.brand}>
        <View style={[s.brandIcon, D?.brandIcon]}>
          <Image source={designImages['b924b8ccc546d63f781f9ea1bd9db221']} style={{ width: 42, height: 44, marginTop: 4 }} resizeMode="contain" />
        </View>
        <View>
          <Text style={[s.brandName, D?.text]}>Domwork</Text>
          <Text style={[s.brandSub, D?.sub]}>Rus tili · onlayn maktab</Text>
        </View>
      </Pressable>

      <View style={{ gap: 4 }}>
        {NAV.map(({ key, label, href, Icon }) => {
          const on = key === active;
          return (
            <Pressable
              key={key}
              accessibilityRole="link"
              accessibilityState={{ selected: on }}
              onPress={() => go(href)}
              style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.navItem, on ? [s.navOn, D?.navOn] : hovered ? [s.navHover, D?.navHover] : null]}
            >
              <Icon color={on ? (dark ? '#A9BCFF' : '#1E3FD1') : dark ? '#C3CBDA' : '#34405A'} strokeWidth={on ? 2.4 : 2} />
              <Text style={[s.navText, D && { color: '#C3CBDA' }, on && s.navTextOn, on && D && { color: '#A9BCFF' }]}>{label}</Text>
              {key === 'league' && info.leagueRank != null && (
                <View style={[s.rankPill, D?.rankPill]}>
                  <Text style={[s.rankText, D?.sub]}>{info.leagueRank}-oʻrin</Text>
                </View>
              )}
              {key === 'shop' && (
                <View style={s.shopCoins}>
                  <DCoinIcon size={14} />
                  <Text style={[s.shopCoinsText, D && { color: '#F4C64E' }]}>{fmtNum(coins)}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <View style={[s.statsCard, D?.statsCard]}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable accessibilityRole="link" accessibilityLabel={`${coins} coin — doʻkon`} onPress={() => go(R.shop)} style={[s.stat, D?.stat]}>
            <View style={s.statRow}>
              <DCoinIcon />
              <Text style={[s.statNum, D?.text]}>{fmtNum(coins)}</Text>
            </View>
            <Text style={[s.statLabel, D?.sub]}>coin</Text>
          </Pressable>
          <Pressable accessibilityRole="link" accessibilityLabel={`Seriya ${info.streak} kun`} onPress={() => go(R.streak)} style={[s.stat, D?.stat]}>
            <View style={[s.statRow, { gap: 3 }]}>
              <DFlameIcon />
              <Text style={[s.statNum, { color: dark ? '#FF9F5A' : '#B34700' }]}>{info.streak}</Text>
            </View>
            <Text style={[s.statLabel, D?.sub]}>kun</Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${fmtNum(level.lightning)} chaqmoq, ${level.index + 1}-daraja ${lvlName}`}
            onPress={() => go(R.levels)}
            style={[s.stat, D?.stat, { paddingHorizontal: 2 }]}
          >
            <View style={[s.statRow, { gap: 2 }]}>
              <DBoltIcon />
              <Text numberOfLines={1} style={[s.statNum, { color: dark ? '#B9A1FF' : '#6A3CF0' }]}>
                {fmtNum(level.lightning)}
              </Text>
            </View>
            <Text style={[s.statLabel, D?.sub]}>chaqmoq</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="link" onPress={() => go(R.levels)} style={s.levelBox}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[s.levelText, D?.text]}>
              {level.index + 1} · {lvlName}
            </Text>
            <Text style={[s.levelText, { color: dark ? '#B9A1FF' : '#6A3CF0' }]}>{level.progressPercent}%</Text>
          </View>
          <View style={[s.levelTrack, D?.levelTrack]}>
            <View style={[s.levelFill, { width: `${level.progressPercent}%` }]} />
          </View>
          <Text style={[s.levelHint, D?.sub]}>
            {level.next ? `${level.index + 2}-darajagacha yana ${fmtNum(level.remaining)}` : 'Eng yuqori daraja'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => setContactOpen(true)}
        style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.teacherBtn, hovered && { opacity: 0.9 }]}
      >
        <DTelegramIcon />
        <Text style={s.teacherText}>Ustozga yozish</Text>
      </Pressable>
      <ContactSheetPopup visible={contactOpen} onClose={() => setContactOpen(false)} />
    </View>
  );
}

type PageProps = {
  /** Sarlavha (h1). */
  title: string;
  /** Sarlavha ostidagi kulrang qator (D_Lesson) — yoki `subtitleAbove` bilan ustida (D_Main). */
  subtitle?: string;
  subtitleAbove?: boolean;
  /** "‹" tugmasi: bosilganda v2 tarixida orqaga, bo'lmasa shu manzilga. */
  back?: string;
  /** Bildirishnoma tugmasidan oldingi qo'shimcha tugmalar. */
  actions?: ReactNode;
  /** Sarlavha matni o'rniga to'liq boshqa element (masalan qidiruv maydoni). */
  titleSlot?: ReactNode;
  children: ReactNode;
  /** Kontent bloki uslubi (standart: 4/40/28 chekka). */
  contentStyle?: StyleProp<ViewStyle>;
  /** false — kontent aylantirilmaydi (ekran o'zi boshqaradi). */
  scroll?: boolean;
};

export function DesktopHeaderRight() {
  const info = useShellInfo();
  const avatar = useAvatarUri();
  return (
    <>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={info.unread ? `Bildirishnomalar, ${info.unread} ta yangi` : 'Bildirishnomalar'}
        onPress={() => go(R.notifications)}
        style={s.bell}
      >
        <DBellIcon />
        {info.unread > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{info.unread > 99 ? '99+' : info.unread}</Text>
          </View>
        )}
      </Pressable>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={info.firstName ? `Profil — ${info.firstName}` : 'Profil'}
        onPress={() => go(R.profile)}
        style={s.profileChip}
      >
        <Image source={avatar ? { uri: avatar } : designImages['93faebd4826b1da6adaee5d0dcda6209']} style={s.profileImg} />
        {!!info.firstName && <Text style={s.profileName}>{info.firstName}</Text>}
      </Pressable>
    </>
  );
}

export function DesktopPage({ title, subtitle, subtitleAbove, back, actions, titleSlot, children, contentStyle, scroll = true }: PageProps) {
  // Aylanmaydigan sahifada ichki ScrollView sig'ishi uchun balandlik cheklanadi.
  const body = <View style={[s.content, !scroll && { flex: 1, minHeight: 0 }, contentStyle]}>{children}</View>;
  return (
    <View style={s.page}>
      <View style={s.header}>
        {back && (
          <Pressable accessibilityRole="button" accessibilityLabel="Orqaga" onPress={() => v2Back(back)} style={s.backBtn}>
            <DBackIcon />
          </Pressable>
        )}
        {titleSlot ?? (
          <View style={{ gap: 2, minWidth: 0, flexShrink: 1 }}>
            {subtitleAbove && !!subtitle && <Text style={s.sub}>{subtitle}</Text>}
            <Text accessibilityRole="header" numberOfLines={1} style={[s.h1, back ? { fontSize: 28 } : null]}>
              {title}
            </Text>
            {!subtitleAbove && !!subtitle && <Text style={s.sub}>{subtitle}</Text>}
          </View>
        )}
        <View style={{ flex: 1 }} />
        {actions}
        <DesktopHeaderRight />
      </View>
      {scroll ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, minHeight: 0 }}>{body}</View>
      )}
    </View>
  );
}

/** Dizayndagi <kbd> yorlig'i. `dark` — ko'k tugma ichidagi variant. */
export function Kbd({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <View style={dark ? s.kbdDark : s.kbd}>
      <Text style={dark ? s.kbdDarkText : s.kbdText}>{children}</Text>
    </View>
  );
}

/** Pastki paneldagi "← → soʻzlar" kabi yorliq. */
export function KbdHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
      <Text style={s.kbdHint}>{label}</Text>
    </View>
  );
}

type FocusProps = {
  /** Yopish (Esc) — v2 tarixida orqaga, bo'lmasa shu manzilga. */
  closeTo: string;
  closeLabel?: string;
  /** Yopishdan oldin tasdiq kerak bo'lsa (o'yin davomida) — o'zi boshqaradi. */
  onClose?: () => void;
  title: string;
  subtitle?: string;
  /** O'rtadagi progress bloki. */
  center?: ReactNode;
  /** O'ngdagi 360px blok (coin, "Slaydlar" va h.k.). */
  right?: ReactNode;
  /** Pastki panel (dizaynda 100–112px, oq, ustida chiziq). */
  footer?: ReactNode;
  footerHeight?: number;
  /** Ichki kenglik (dizaynda 1100–1120px). */
  footerWidth?: number;
  dark?: boolean;
  bg?: string;
  children: ReactNode;
  scroll?: boolean;
};

export function FocusFrame({
  closeTo,
  closeLabel = 'Yopish (Esc)',
  onClose,
  title,
  subtitle,
  center,
  right,
  footer,
  footerHeight = 112,
  footerWidth = 1120,
  dark,
  bg,
  children,
  scroll = true,
}: FocusProps) {
  const close = onClose ?? (() => v2Back(closeTo));
  useDesktopKeys({ Escape: close });
  return (
    <View style={[s.focus, { backgroundColor: bg ?? (dark ? '#0B1220' : '#F4F6FA') }]}>
      <View style={[s.focusHeader, dark && { backgroundColor: '#0B1220', borderBottomColor: '#1F2940' }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={close} style={[s.focusClose, dark && { backgroundColor: '#1B2438' }]}>
          <DCloseIcon color={dark ? '#FFFFFF' : '#0B1220'} />
        </Pressable>
        <View style={{ width: 300, gap: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[s.focusTitle, dark && { color: '#FFFFFF' }]}>
            {title}
          </Text>
          {!!subtitle && (
            <Text numberOfLines={1} style={[s.focusSub, dark && { color: '#B8C1D6' }]}>
              {subtitle}
            </Text>
          )}
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>{center}</View>
        <View style={{ width: 360, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>{right}</View>
      </View>
      {scroll ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
      )}
      {footer && (
        <View style={[s.footer, { height: footerHeight }, dark && { backgroundColor: '#0B1220', borderTopColor: '#1F2940' }]}>
          <View style={{ width: footerWidth, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 16 }}>{footer}</View>
        </View>
      )}
    </View>
  );
}

/** Fokus sarlavhasidagi bo'lakli progress (D_Vocab, D_Exercise: 10px, oraliq 4). */
export function FocusProgress({
  left,
  right,
  rightColor = '#4A5468',
  segments,
  width = 460,
  height = 10,
  gap = 4,
  label,
}: {
  left: string;
  right?: string;
  rightColor?: string;
  segments: string[];
  width?: number;
  height?: number;
  gap?: number;
  label?: string;
}) {
  return (
    <View style={{ width, gap: 7 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={s.progLeft}>{left}</Text>
        {!!right && <Text style={[s.progLeft, { color: rightColor }]}>{right}</Text>}
      </View>
      <View accessibilityLabel={label} style={{ flexDirection: 'row', gap }}>
        {segments.map((c, i) => (
          <View key={i} style={{ flex: 1, height, borderRadius: height / 2, backgroundColor: c }} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  aside: {
    width: SIDEBAR_W,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E4E8F0',
    paddingTop: 22,
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 22,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6 },
  brandIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  brandName: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 23, lineHeight: 24, letterSpacing: -0.46, color: '#0B1220' },
  brandSub: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, color: '#4A5468' },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 48, paddingHorizontal: 14, borderRadius: 14 },
  navOn: { backgroundColor: '#E8EEFF' },
  navHover: { backgroundColor: '#F4F6FA' },
  navText: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 15, color: '#34405A' },
  navTextOn: { fontFamily: fonts.bodyHeavy, color: '#1E3FD1' },
  rankPill: { marginLeft: 'auto', height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#EEF1F7', justifyContent: 'center' },
  rankText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#4A5468' },
  shopCoins: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 },
  shopCoinsText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, color: '#7A5300' },
  statsCard: { backgroundColor: '#F4F6FA', borderRadius: 20, padding: 10, gap: 8 },
  stat: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 14, paddingTop: 9, paddingBottom: 8, paddingHorizontal: 4, alignItems: 'center', gap: 3 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statNum: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#0B1220' },
  statLabel: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, color: '#4A5468' },
  levelBox: { gap: 6, paddingTop: 4, paddingHorizontal: 6, paddingBottom: 2 },
  levelText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, color: '#0B1220' },
  levelTrack: { height: 6, borderRadius: 3, backgroundColor: '#E2E6EE', overflow: 'hidden' },
  levelFill: { height: 6, borderRadius: 3, backgroundColor: '#7C4DFF' },
  levelHint: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, color: '#4A5468' },
  teacherBtn: { height: 48, borderRadius: 15, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  teacherText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#0B1220' },

  page: { flex: 1, minWidth: 0, backgroundColor: '#F4F6FA' },
  header: { height: 84, paddingHorizontal: 40, flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E8F0', alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 30, lineHeight: 33, letterSpacing: -0.6, color: '#0B1220' },
  sub: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 14, color: '#4A5468' },
  bell: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E8F0', alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#D92D20',
    borderWidth: 2,
    borderColor: '#F4F6FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 14, color: '#FFFFFF' },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingLeft: 3,
    paddingRight: 14,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E8F0',
  },
  profileImg: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF1E6' },
  profileName: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, color: '#0B1220' },
  content: { flexGrow: 1, paddingTop: 4, paddingHorizontal: 40, paddingBottom: 28 },

  focus: { flex: 1 },
  focusHeader: {
    height: 76,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E8F0',
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  focusClose: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center' },
  focusTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, color: '#0B1220' },
  focusSub: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, color: '#4A5468' },
  progLeft: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, color: '#34405A' },
  footer: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E4E8F0', alignItems: 'center', justifyContent: 'center' },
  kbd: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderBottomWidth: 2,
    borderColor: '#D5DBE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kbdText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#34405A' },
  kbdDark: { height: 24, paddingHorizontal: 7, borderRadius: 7, backgroundColor: '#1E3FD1', justifyContent: 'center' },
  kbdDarkText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#DCE5FF' },
  kbdHint: { marginLeft: 2, fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, color: '#4A5468' },
});

// D_DarkMain menyusi ranglari.
const dk = StyleSheet.create({
  aside: { backgroundColor: '#141C2E', borderRightColor: '#232C42' },
  brandIcon: { backgroundColor: '#1F2D5E' },
  text: { color: '#EEF2F8' },
  sub: { color: '#A9B3C6' },
  navOn: { backgroundColor: '#1F2D5E' },
  navHover: { backgroundColor: '#1A2338' },
  rankPill: { backgroundColor: '#222B40' },
  statsCard: { backgroundColor: '#0B1220' },
  stat: { backgroundColor: '#141C2E' },
  levelTrack: { backgroundColor: '#2A3450' },
});
