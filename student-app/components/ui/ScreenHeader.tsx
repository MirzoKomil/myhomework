import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

type ScreenHeaderProps = {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  // 2-vazifa: Speaking Battle kabi o'yin ekranlarida orqaga tugmasi
  // to'g'ridan-to'g'ri chiqib ketishdan oldin tasdiqlash so'rashi kerak —
  // shu sabab standart router.back() ni ixtiyoriy ravishda almashtirish
  // imkoniyati qo'shildi (berilmasa, avvalgi xatti-harakat saqlanadi).
  onBack?: () => void;
};

export function ScreenHeader({ title, showBack = false, rightAction, onBack }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      {showBack ? (
        <Pressable onPress={onBack ?? (() => router.back())} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
      ) : (
        <View style={styles.backPlaceholder} />
      )}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{rightAction ?? <View style={styles.backPlaceholder} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  backPlaceholder: {
    width: 40,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: theme.fonts.bold,
    fontSize: 18,
    color: theme.colors.text,
    marginHorizontal: 8,
  },
  right: {
    width: 40,
    alignItems: 'flex-end',
  },
});
