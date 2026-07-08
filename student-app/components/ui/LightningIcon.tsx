import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

export function LightningIcon({ size = 16 }: { size?: number }) {
  return <Ionicons name="flash" size={size} color={theme.colors.blue} />;
}

export function LightningPill({ amount, size = 14 }: { amount: number; size?: number }) {
  return (
    <View style={styles.pill}>
      <LightningIcon size={size} />
      <Text style={styles.pillText}>{amount.toLocaleString('uz-UZ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: theme.colors.blueLight,
  },
  pillText: {
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    color: theme.colors.blue,
  },
});
