import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { AdminModuleContent } from '@/services/contentApi';

const TYPE_ICON: Record<AdminModuleContent['type'], keyof typeof Ionicons.glyphMap> = {
  pdf: 'document-text-outline',
  word: 'document-outline',
  image: 'image-outline',
  text: 'reader-outline',
  video: 'play-circle-outline',
};

export function MaterialsList({ files }: { files: AdminModuleContent[] }) {
  if (!files.length) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Qo'shimcha materiallar</Text>
      {files.map((f) =>
        f.type === 'text' ? (
          <View key={f.id} style={styles.textCard}>
            {f.name ? <Text style={styles.textCardTitle}>{f.name}</Text> : null}
            <Text style={styles.textCardBody}>{f.text}</Text>
          </View>
        ) : (
          <Pressable key={f.id} style={styles.row} onPress={() => f.url && Linking.openURL(f.url)}>
            <Ionicons name={TYPE_ICON[f.type]} size={20} color={theme.colors.purple} />
            <Text style={styles.rowName} numberOfLines={1}>
              {f.name || f.type}
            </Text>
            <Ionicons name="open-outline" size={16} color={theme.colors.textLight} />
          </Pressable>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  sectionLabel: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.purple, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    ...theme.shadow.card,
  },
  rowName: { flex: 1, fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.text },
  textCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: 14,
    marginBottom: 8,
    ...theme.shadow.card,
  },
  textCardTitle: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.text, marginBottom: 4 },
  textCardBody: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, lineHeight: 22 },
});
