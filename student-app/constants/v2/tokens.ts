/**
 * Domwork v2 — yangi dizayn tizimi (redizayn, 2026-oktabr).
 *
 * Qiymatlar "Domwork app redizayn" dizayn kanvasidan olingan. Eski
 * ilova `constants/theme.ts` ishlatishda davom etadi — bu fayl FAQAT
 * `app/v2/*` ekranlari va `components/v2/*` uchun. Ikkalasi
 * aralashtirilmasin: v2 to'liq tayyor bo'lgunicha eski ilovaga ta'sir
 * qilmasligi shart.
 */
import { Platform } from 'react-native';

export const colors = {
  // Asosiy
  cobalt: '#2F5BFF',
  cobaltPressed: '#1E3FD1',
  cobaltTint: '#D4DEFF',
  cobaltSoft: '#F0F3FF',
  sunflower: '#FFC93C',
  ink: '#0B1220',
  inkRaised: '#26304A',

  // Fon va sirtlar
  bg: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceSunken: '#F7F9FC',
  track: '#E7EBF3',
  trackSoft: '#EEF1F7',
  border: '#D5DBE7',
  divider: '#E4E8F0',

  // Matn (oq fonda 4.5:1 dan yuqori kontrast)
  text: '#0B1220',
  textMuted: '#4A5468',
  textSubtle: '#5B6478',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#B8C1D6',

  // Ma'noli ranglar
  success: '#0FA968',
  successText: '#087A4A',
  successSoft: '#E3F7EE',
  successBright: '#3DDC97',
  danger: '#D92D20',
  dangerText: '#B42318',
  dangerSoft: '#FDECEC',
  live: '#FF5A5F',
  liveText: '#FF8A8E',

  // O'yinlashtirish
  streak: '#FF7A1A',
  streakText: '#B34700',
  coin: '#F5B70A',
  coinRim: '#B98500',
  coinText: '#7A5300',
  coinSoft: '#FFF4D1',
  lightning: '#7C4DFF',
  lightningText: '#5A2FD6',
  lightningSoft: '#F0EBFF',
  telegram: '#2AABEE',
} as const;

export const radius = {
  xs: 10,
  sm: 13,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 24,
  hero: 28,
  sheet: 32,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 14,
  xxl: 16,
  screen: 20,
  section: 24,
} as const;

/** Bosiladigan elementlarning eng kichik o'lchami (dizayn qoidasi). */
export const touchTarget = 44;

/**
 * Shriftlar. Bricolage Grotesque'da kirill harflari YO'Q — rus
 * matnli sarlavhalar Manrope'ga tushishi kerak. Webda brauzer har bir
 * harf uchun ro'yxatdagi keyingi shriftga o'tadi, shuning uchun display
 * shrifti ortidan Manrope ExtraBold qo'yilgan. Native'da bunday
 * avtomatik o'tish yo'q — rus tilidagi sarlavha uchun `lang="ru"` yoki
 * `Display` komponentining `cyrillic` propidan foydalaning.
 */
const webStack = (primary: string, fallback: string) =>
  `${primary}, ${fallback}, system-ui, sans-serif`;

export const fontFiles = {
  BricolageGrotesque_600SemiBold: 'BricolageGrotesque_600SemiBold',
  BricolageGrotesque_700Bold: 'BricolageGrotesque_700Bold',
  BricolageGrotesque_800ExtraBold: 'BricolageGrotesque_800ExtraBold',
  Manrope_500Medium: 'Manrope_500Medium',
  Manrope_600SemiBold: 'Manrope_600SemiBold',
  Manrope_700Bold: 'Manrope_700Bold',
  Manrope_800ExtraBold: 'Manrope_800ExtraBold',
} as const;

const isWeb = Platform.OS === 'web';

export const fonts = {
  display: isWeb
    ? webStack('BricolageGrotesque_800ExtraBold', 'Manrope_800ExtraBold')
    : 'BricolageGrotesque_800ExtraBold',
  // Dizayndagi Bricolage 700 (masalan sertifikatdagi imzo).
  display700: isWeb
    ? webStack('BricolageGrotesque_700Bold', 'Manrope_700Bold')
    : 'BricolageGrotesque_700Bold',
  // Webda system-ui zaxira: Manrope'da urg'u belgisi (U+0301) yo'q.
  displayCyrillic: isWeb ? webStack('Manrope_800ExtraBold', 'Manrope_800ExtraBold') : 'Manrope_800ExtraBold',
  body: isWeb ? webStack('Manrope_600SemiBold', 'Manrope_600SemiBold') : 'Manrope_600SemiBold',
  bodyMedium: isWeb ? webStack('Manrope_500Medium', 'Manrope_500Medium') : 'Manrope_500Medium',
  bodyBold: isWeb ? webStack('Manrope_700Bold', 'Manrope_700Bold') : 'Manrope_700Bold',
  bodyHeavy: isWeb ? webStack('Manrope_800ExtraBold', 'Manrope_800ExtraBold') : 'Manrope_800ExtraBold',
} as const;

/** Matn o'lchamlari — dizayndagi qiymatlar. */
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 32, lineHeight: 34, letterSpacing: -0.64 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.display, fontSize: 25, lineHeight: 27, letterSpacing: -0.5 },
  subheading: { fontFamily: fonts.display, fontSize: 20, lineHeight: 23, letterSpacing: -0.2 },
  bodyLarge: { fontFamily: fonts.bodyHeavy, fontSize: 17, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodyHeavy, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 21 },
  bodySmall: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17 },
  overline: { fontFamily: fonts.bodyHeavy, fontSize: 12, lineHeight: 15, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  tab: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 13 },
} as const;

export const shadow = {
  focusCard: Platform.select({
    web: { boxShadow: '0 6px 20px rgba(47, 91, 255, 0.14)' } as object,
    default: {
      shadowColor: colors.cobalt,
      shadowOpacity: 0.14,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
  }),
} as const;

export const v2 = { colors, radius, space, fonts, type, shadow, touchTarget } as const;
export default v2;
