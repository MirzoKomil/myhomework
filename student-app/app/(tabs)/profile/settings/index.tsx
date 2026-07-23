import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { invalidateCache } from '@/services/contentApi';
import { clearAuth, useAuth } from '@/services/studentAuthStore';
import { useLang } from '@/i18n/LanguageContext';

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
  const { student } = useAuth();
  const { t } = useLang();

  const handleLogout = async () => {
    await clearAuth();
    invalidateCache();
    router.replace('/');
  };

  const group1: Row[] = [
    { icon: 'globe-outline', label: t('settings_app_language'), onPress: () => router.push('/profile/settings/language' as never), right: 'chevron' },
    {
      icon: 'videocam-outline',
      label: t('settings_active_lessons'),
      onPress: () => router.push('/profile/settings/active-lessons' as never),
      right: 'chevron',
    },
    {
      icon: 'notifications-outline',
      label: t('settings_notifications'),
      onPress: () => router.push('/profile/settings/notifications' as never),
      right: 'chevron',
    },
    {
      icon: 'phone-portrait-outline',
      label: t('settings_active_devices'),
      onPress: () => router.push('/profile/settings/devices' as never),
      right: 'chevron',
    },
    { icon: 'moon-outline', label: t('settings_dark_mode'), right: 'switch' },
  ];

  const group2: Row[] = [
    { icon: 'share-social-outline', label: t('settings_share_friends'), onPress: shareApp, right: 'chevron' },
    { icon: 'information-circle-outline', label: t('settings_about_us'), onPress: () => router.push('/profile/settings/about' as never), right: 'chevron' },
    { icon: 'help-circle-outline', label: t('settings_faq'), onPress: () => router.push('/profile/settings/faq' as never), right: 'chevron' },
    {
      icon: 'shield-checkmark-outline',
      label: t('settings_privacy_policy'),
      onPress: () => router.push('/profile/settings/privacy' as never),
      right: 'chevron',
    },
    { icon: 'call-outline', label: t('settings_contacts'), onPress: () => router.push('/profile/settings/contacts' as never), right: 'chevron' },
  ];

  const renderGroup = (rows: Row[]) => (
    <View style={styles.group}>
      {rows.map((row, i) => (
        <Pressable
          key={row.icon}
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
      <ScreenHeader title={t('profile_settings')} showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {renderGroup(group1)}
        {renderGroup(group2)}

        {student ? (
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
            <Text style={styles.logoutText}>{t('settings_logout')} ({student.name})</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.loginBtn} onPress={() => router.push('/login' as never)}>
            <Ionicons name="log-in-outline" size={20} color={theme.colors.purple} />
            <Text style={styles.loginText}>{t('settings_login')}</Text>
          </Pressable>
        )}
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
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: theme.colors.dangerBg,
    borderRadius: theme.radius.sm,
  },
  logoutText: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.danger },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: theme.colors.purpleLight,
    borderRadius: theme.radius.sm,
  },
  loginText: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.purple },
});
