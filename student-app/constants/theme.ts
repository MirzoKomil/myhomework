/** Myhomework.uz platforma dizayn tizimi */
export const theme = {
  colors: {
    purple: '#7B61FF',
    purpleDark: '#6B4FE0',
    purpleLight: '#EDE9FE',
    blue: '#4F8CFF',
    blueLight: '#E8F0FF',
    bg: '#F0F2F8',
    surface: '#FFFFFF',
    text: '#1A1D2E',
    textMuted: '#8B90A5',
    textLight: '#B0B5C9',
    border: '#ECEEF4',
    success: '#34D399',
    successBg: '#D1FAE5',
    danger: '#F87171',
    dangerBg: '#FEE2E2',
    warning: '#FBBF24',
    warningBg: '#FEF3C7',
    pink: '#F472B6',
    pinkBg: '#FCE7F3',
    tabInactive: '#B0B5C9',
  },
  radius: {
    sm: 12,
    md: 20,
    lg: 28,
  },
  shadow: {
    card: {
      shadowColor: '#1A1D2E',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 32,
      elevation: 4,
    },
  },
  fonts: {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semiBold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
    extraBold: 'PlusJakartaSans_800ExtraBold',
  },
} as const;

export type Theme = typeof theme;
