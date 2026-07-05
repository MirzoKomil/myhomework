import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';

const LANGUAGES = [
  { code: 'uz', label: "O'zbek" },
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
];

export default function LanguageScreen() {
  const [selected, setSelected] = useState('uz');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Ilova tili" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.group}>
          {LANGUAGES.map((lang, i) => (
            <Pressable
              key={lang.code}
              style={[styles.row, i < LANGUAGES.length - 1 && styles.rowBorder]}
              onPress={() => setSelected(lang.code)}>
              <Text style={styles.rowLabel}>{lang.label}</Text>
              {selected === lang.code && <Ionicons name="checkmark-circle" size={20} color={theme.colors.purple} />}
            </Pressable>
          ))}
        </View>
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
});
