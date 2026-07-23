import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';

export function ShopEntryCard({ onPress }: { onPress: () => void }) {
  const { t } = useLang();
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name="storefront-outline" size={26} color="#D97706" />
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{t('home_shop_title')}</Text>
        <Text style={styles.subtitle}>{t('home_shop_subtitle')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    marginTop: 16,
    ...theme.shadow.card,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  title: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
});
