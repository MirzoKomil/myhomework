import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { getLessonContent } from '@/data/lessonContent';
import { fetchMobileContent } from '@/services/contentApi';

type LessonFolder = {
  id: string;
  name: string;
  locked: boolean;
  wordCount: number;
};

const TOTAL_LESSONS = 72;
const UNLOCKED_COUNT = 3;
const BONUS_TOTAL = 18;
const BONUS_UNLOCKED = 1;

export default function VocabularyHubScreen() {
  const [folders, setFolders] = useState<LessonFolder[]>([]);
  const [bonusFolders, setBonusFolders] = useState<LessonFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLockedNotice, setShowLockedNotice] = useState(false);

  useEffect(() => {
    fetchMobileContent()
      .then((mc) => {
        const course = mc.courses[0];
        const adminLessons = course ? mc.lessons.filter((l) => l.courseId === course.id) : [];
        const mapped: LessonFolder[] = Array.from({ length: TOTAL_LESSONS }, (_, i) => {
          const l = adminLessons[i];
          const id = l?.id ?? String(i + 1);
          return {
            id,
            name: l?.name ?? `${i + 1}-dars`,
            locked: i >= UNLOCKED_COUNT,
            wordCount: getLessonContent(id, i).vocabulary.length,
          };
        });
        setFolders(mapped);

        const bonus: LessonFolder[] = Array.from({ length: BONUS_TOTAL }, (_, i) => {
          const id = `bonus-${i + 1}`;
          return {
            id,
            name: `${i + 1}-Yakshanba bonus dars`,
            locked: i >= BONUS_UNLOCKED,
            wordCount: getLessonContent(id, i).vocabulary.length,
          };
        });
        setBonusFolders(bonus);
      })
      .finally(() => setLoading(false));
  }, []);

  const openFolder = (folder: LessonFolder) => {
    if (folder.locked) {
      setShowLockedNotice(true);
      return;
    }
    router.push(`/vocabulary/${folder.id}?name=${encodeURIComponent(folder.name)}` as never);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="So'zlar" showBack />

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      )}

      {!loading && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>Darsdan darsga to'plangan lug'atingiz</Text>
          {folders.map((folder, index) => (
            <Pressable key={folder.id} onPress={() => openFolder(folder)}>
              <Card style={folder.locked ? styles.cardLocked : undefined}>
                <View style={styles.row}>
                  <View style={[styles.iconWrap, folder.locked && styles.iconWrapLocked]}>
                    <Ionicons
                      name={folder.locked ? 'lock-closed' : 'folder-open-outline'}
                      size={22}
                      color={folder.locked ? theme.colors.textLight : theme.colors.purple}
                    />
                  </View>
                  <View style={styles.info}>
                    <Text style={[styles.title, folder.locked && styles.titleLocked]} numberOfLines={1}>
                      {index + 1}-dars — {folder.name}
                    </Text>
                    <Text style={styles.subtitleSmall}>
                      {folder.locked ? 'Hali ochilmagan' : `${folder.wordCount} ta so'z`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
                </View>
              </Card>
            </Pressable>
          ))}

          <Text style={[styles.subtitle, styles.bonusSectionTitle]}>Yakshanba bonus darslar lug'ati</Text>
          {bonusFolders.map((folder) => (
            <Pressable key={folder.id} onPress={() => openFolder(folder)}>
              <Card style={folder.locked ? styles.cardLocked : undefined}>
                <View style={styles.row}>
                  <View style={[styles.iconWrap, folder.locked && styles.iconWrapLocked]}>
                    <Ionicons
                      name={folder.locked ? 'lock-closed' : 'folder-open-outline'}
                      size={22}
                      color={folder.locked ? theme.colors.textLight : theme.colors.purple}
                    />
                  </View>
                  <View style={styles.info}>
                    <Text style={[styles.title, folder.locked && styles.titleLocked]} numberOfLines={1}>
                      {folder.name}
                    </Text>
                    <Text style={styles.subtitleSmall}>
                      {folder.locked ? 'Hali ochilmagan' : `${folder.wordCount} ta so'z`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
                </View>
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal visible={showLockedNotice} animationType="fade" transparent onRequestClose={() => setShowLockedNotice(false)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={styles.dialogBackdropTap} onPress={() => setShowLockedNotice(false)} />
          <View style={styles.dialogCard}>
            <Ionicons name="lock-closed" size={36} color={theme.colors.textMuted} />
            <Text style={styles.dialogTitle}>Hali bu darsga yetib kelmadingiz</Text>
            <Text style={styles.dialogSubtitle}>
              Ushbu darsning so'zlar ro'yxatini ko'rish uchun avval shu darsgacha yetib kelishingiz kerak.
            </Text>
            <Pressable style={styles.dialogBtn} onPress={() => setShowLockedNotice(false)}>
              <Text style={styles.dialogBtnText}>Tushunarli</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted },
  scroll: { padding: 20, paddingBottom: 40, gap: 10 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginBottom: 4 },
  bonusSectionTitle: { marginTop: 20 },
  cardLocked: { opacity: 0.65 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapLocked: { backgroundColor: theme.colors.bg },
  info: { flex: 1 },
  title: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text },
  titleLocked: { color: theme.colors.textMuted },
  subtitleSmall: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  dialogBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialogBackdropTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  dialogCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  dialogTitle: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text, textAlign: 'center' },
  dialogSubtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
  dialogBtn: {
    width: '100%',
    marginTop: 10,
    paddingVertical: 13,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
  },
  dialogBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
});
