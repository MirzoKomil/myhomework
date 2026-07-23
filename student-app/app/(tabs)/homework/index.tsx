import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import { fetchMobileContent } from '@/services/contentApi';

export default function HomeworkEntryScreen() {
  const { t } = useLang();
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchMobileContent()
        .then((mc) => {
          if (cancelled) return;
          const first = mc.courses[0];
          if (first) {
            router.replace(`/homework/roadmap/${first.id}`);
          } else {
            setError(t('hw_no_courses'));
          }
        })
        .catch(() => {
          if (!cancelled) setError(t('hw_load_failed'));
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.center}>
        {error ? (
          <>
            <Ionicons name="cloud-offline-outline" size={40} color={theme.colors.textMuted} />
            <Text style={styles.errorText}>{error}</Text>
          </>
        ) : (
          <ActivityIndicator size="large" color={theme.colors.purple} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted },
});
