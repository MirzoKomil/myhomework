import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

export function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <LinearGradient
      colors={['#FDE68A', '#F59E0B']}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={[
        styles.coin,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.max(1, size * 0.07),
        },
      ]}>
      <View
        style={[
          styles.ring,
          {
            width: size * 0.56,
            height: size * 0.56,
            borderRadius: size * 0.3,
            borderWidth: Math.max(1, size * 0.06),
          },
        ]}
      />
    </LinearGradient>
  );
}

export function CoinPill({ amount, size = 14 }: { amount: number; size?: number }) {
  return (
    <View style={styles.pill}>
      <CoinIcon size={size} />
      <Text style={styles.pillText}>{amount.toLocaleString('uz-UZ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  coin: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#B45309',
  },
  ring: {
    borderColor: 'rgba(180,83,9,0.5)',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
  },
  pillText: {
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    color: '#B45309',
  },
});
