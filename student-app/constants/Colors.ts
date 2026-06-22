import { theme } from './theme';

const tintColorLight = theme.colors.purple;
const tintColorDark = theme.colors.purpleLight;

export default {
  light: {
    text: theme.colors.text,
    background: theme.colors.bg,
    tint: tintColorLight,
    tabIconDefault: theme.colors.tabInactive,
    tabIconSelected: tintColorLight,
    surface: theme.colors.surface,
  },
  dark: {
    text: '#ECEDF3',
    background: '#12141F',
    tint: tintColorDark,
    tabIconDefault: '#6B7085',
    tabIconSelected: tintColorDark,
    surface: '#1E2130',
  },
};
