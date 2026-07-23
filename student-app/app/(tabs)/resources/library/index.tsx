import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import type { TranslationKey } from '@/i18n/translations';

const libraryItems = [
  { icon: 'book' as const, titleKey: 'res_lib_item_grammar_title' as TranslationKey, countKey: 'res_lib_item_grammar_count' as TranslationKey, color: theme.colors.blue, bg: theme.colors.blueLight, route: '/resources/library/grammar' },
  { icon: 'list' as const, titleKey: 'res_lib_item_words_title' as TranslationKey, countKey: 'res_lib_item_words_count' as TranslationKey, color: theme.colors.purple, bg: theme.colors.purpleLight, route: '/resources/library/words' },
  { icon: 'mic' as const, titleKey: 'res_lib_item_pron_title' as TranslationKey, countKey: 'res_lib_item_pron_count' as TranslationKey, color: theme.colors.pink, bg: theme.colors.pinkBg, route: '/resources/pronunciation' },
  { icon: 'chatbubbles' as const, titleKey: 'res_lib_item_speaking_title' as TranslationKey, countKey: 'res_lib_item_speaking_count' as TranslationKey, color: theme.colors.warning, bg: theme.colors.warningBg, route: '/resources/speaking' },
  { icon: 'headset' as const, titleKey: 'res_lib_item_podcasts_title' as TranslationKey, countKey: 'res_lib_item_podcasts_count' as TranslationKey, color: theme.colors.success, bg: theme.colors.successBg, route: '/resources/podcasts' },
  { icon: 'library' as const, titleKey: 'res_lib_item_books_title' as TranslationKey, countKey: 'res_lib_item_books_count' as TranslationKey, color: theme.colors.blue, bg: theme.colors.blueLight, route: '/resources/books' },
];

export default function LibraryScreen() {
  const { t } = useLang();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('res_library_title')} showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{t('res_library_subtitle')}</Text>
        {libraryItems.map((item) => {
          const content = (
            <View style={styles.resourceRow}>
              <View style={[styles.iconWrap, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <View style={styles.resourceInfo}>
                <Text style={styles.resourceTitle}>{t(item.titleKey)}</Text>
                <Text style={styles.resourceCount}>{t(item.countKey)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
            </View>
          );
          if (item.route) {
            return (
              <Pressable key={item.route} onPress={() => router.push(item.route as never)}>
                <Card style={styles.resourceCard}>{content}</Card>
              </Pressable>
            );
          }
          return (
            <Card key={item.route} style={styles.resourceCard}>
              {content}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 32, gap: 12 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginBottom: 4 },
  resourceCard: {},
  resourceRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  resourceInfo: { flex: 1 },
  resourceTitle: { fontFamily: theme.fonts.semiBold, fontSize: 16, color: theme.colors.text },
  resourceCount: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
});
