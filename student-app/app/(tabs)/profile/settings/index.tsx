import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  right?: 'chevron' | 'switch';
};

function shareApp() {
  Share.share({ message: "Myhomework.uz — ingliz tilini o'rganish uchun ilova! https://myhomework.uz" });
}

export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(false);

  const group1: Row[] = [
    { icon: 'globe-outline', label: 'Ilova tili', onPress: () => router.push('/profile/settings/language' as never), right: 'chevron' },
    {
      icon: 'videocam-outline',
      label: "Faol mashg'ulotlar",
      onPress: () => router.push('/profile/settings/active-lessons' as never),
      right: 'chevron',
    },
    {
      icon: 'notifications-outline',
      label: 'Bildirishnoma',
      onPress: () => router.push('/profile/settings/notifications' as never),
      right: 'chevron',
    },
    {
      icon: 'phone-portrait-outline',
      label: 'Faol qurilmalar',
      onPress: () => router.push('/profile/settings/devices' as never),
      right: 'chevron',
    },
    { icon: 'moon-outline', label: "Qorong'ulik rejimi", right: 'switch' },
  ];

  const group2: Row[] = [
    { icon: 'share-social-outline', label: "Do'stlarga ulashish", onPress: shareApp, right: 'chevron' },
    { icon: 'information-circle-outline', label: 'Biz haqimizda', onPress: () => router.push('/profile/settings/about' as never), right: 'chevron' },
    { icon: 'help-circle-outline', label: 'FAQ', onPress: () => router.push('/profile/settings/faq' as never), right: 'chevron' },
    {
      icon: 'shield-checkmark-outline',
      label: 'Maxfiylik siyosati',
      onPress: () => router.push('/profile/settings/privacy' as never),
      right: 'chevron',
    },
    { icon: 'call-outline', label: 'Kontaktlar', onPress: () => router.push('/profile/settings/contacts' as never), right: 'chevron' },
  ];

  const renderGroup = (rows: Row[]) => (
    <View style={styles.group}>
      {rows.map((row, i) => (
        <Pressable
          key={row.label}
          style={[styles.row, i < rows.length - 1 && styles.rowBorder]}
          onPress={row.onPress}
          disabled={!row.onPress}>
          <Ionicons name={row.icon} size={20} color={theme.colors.purple} />
          <Text style={styles.rowLabel}>{row.label}</Text>
          {row.right === 'switch' ? (
            <Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ true: theme.colors.purple }} />
          ) : row.right === 'chevron' ? (
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Sozlamalar" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {renderGroup(group1)}
        {renderGroup(group2)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, gap: 16 },
  group: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    marginBottom: 16,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowLabel: { flex: 1, fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.text },
});
