import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import type { AppLang } from '@/i18n/translations';

const LANGUAGES: { code: AppLang; label: string }[] = [
  { code: 'uz', label: "O'zbek" },
  { code: 'ru', label: 'Русский' },
];

export default function LanguageScreen() {
  const { lang, setLang, t } = useLang();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('settings_app_language')} showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.group}>
          {LANGUAGES.map((option, i) => (
            <Pressable
              key={option.code}
              style={[styles.row, i < LANGUAGES.length - 1 && styles.rowBorder]}
              onPress={() => setLang(option.code)}>
              <Text style={styles.rowLabel}>{option.label}</Text>
              {lang === option.code && <Ionicons name="checkmark-circle" size={20} color={theme.colors.purple} />}
            </Pressable>
          ))}
        </View>
        <Text style={styles.note}>{t('lang_screen_note')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20 },
  group: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, overflow: 'hidden', ...theme.shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowLabel: { flex: 1, fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.text },
  note: { marginTop: 14, fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, paddingHorizontal: 4, lineHeight: 18 },
});
