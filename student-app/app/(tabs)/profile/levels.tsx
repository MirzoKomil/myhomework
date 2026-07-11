import { Ionicons } from '@expo/vector-icons';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { getLevelProgress, LEVELS } from '@/data/levels';
import { useLightning } from '@/services/lightningStore';

export default function LevelsScreen() {
  const lightning = useLightning();
  const progress = getLevelProgress(lightning);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Darajalar" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Chaqmoq to'plagan sari darajangiz oshib boradi — chaqmoq hech qachon sarflanmaydi, faqat to'planadi.
        </Text>
        {LEVELS.map((level) => {
          const isCurrent = level.key === progress.level.key;
          const isReached = lightning >= level.min;
          return (
            <Card
              key={level.key}
              style={StyleSheet.flatten([styles.card, !isReached && styles.cardLocked, isCurrent && styles.cardCurrent])}>
              {!isReached && (
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={14} color={theme.colors.textLight} />
                </View>
              )}
              <View style={styles.row}>
                <Image source={level.image} style={[styles.image, !isReached && styles.imageLocked]} />
                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, !isReached && styles.nameLocked]}>{level.name}</Text>
                    {isCurrent ? (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Hozirgi</Text>
                      </View>
                    ) : isReached ? (
                      <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                    ) : null}
                  </View>
                  <Text style={[styles.desc, !isReached && styles.descLocked]}>{level.description}</Text>
                  <Text style={styles.range}>
                    {level.max ? `${level.min} – ${level.max} chaqmoq` : `${level.min}+ chaqmoq`}
                  </Text>
                </View>
              </View>

              {isCurrent && progress.next && (
                <View style={styles.progressBlock}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progress.progressPercent}%` }]} />
                  </View>
                  <Text style={styles.progressHint}>
                    {progress.next.name} darajasiga yetish uchun yana {progress.remaining.toLocaleString('uz-UZ')} ta
                    chaqmoq kerak
                  </Text>
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 40, gap: 12 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginBottom: 4, lineHeight: 19 },

  card: {},
  cardLocked: { opacity: 0.6 },
  cardCurrent: { borderWidth: 1.5, borderColor: theme.colors.blue },
  lockBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  image: { width: 56, height: 56, resizeMode: 'contain' },
  imageLocked: { opacity: 0.5 },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text },
  nameLocked: { color: theme.colors.textMuted },
  currentBadge: { backgroundColor: theme.colors.blueLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  currentBadgeText: { fontFamily: theme.fonts.bold, fontSize: 11, color: theme.colors.blue },
  desc: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  descLocked: { color: theme.colors.textLight },
  range: { fontFamily: theme.fonts.medium, fontSize: 11, color: theme.colors.textLight, marginTop: 3 },

  progressBlock: { marginTop: 14, gap: 6 },
  progressBarBg: { height: 6, borderRadius: 3, backgroundColor: theme.colors.border },
  progressBarFill: { height: 6, borderRadius: 3, backgroundColor: theme.colors.blue },
  progressHint: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted },
});
