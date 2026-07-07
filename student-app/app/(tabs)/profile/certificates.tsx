import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { Certificate, CERTIFICATES, CertificateType } from '@/data/certificates';
import { courses, profileStats } from '@/data/mock';
import { generateScheduleDays } from '@/data/scheduleCalendar';

const TYPE_CONFIG: Record<CertificateType, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  interval: { icon: 'ribbon', color: theme.colors.purple, bg: theme.colors.purpleLight },
  bonus: { icon: 'gift', color: '#D97706', bg: '#FEF3C7' },
  course: { icon: 'trophy', color: '#B45309', bg: '#FEF3C7' },
};

export default function CertificatesScreen() {
  const activeCourse = courses[0];
  const [selected, setSelected] = useState<Certificate | null>(null);
  const [lockedNotice, setLockedNotice] = useState<Certificate | null>(null);

  const scheduleDays = useMemo(() => generateScheduleDays(), []);
  const bonusAttended = useMemo(
    () => scheduleDays.filter((d) => d.type === 'bonus' && d.isPast && !d.missed).length,
    [scheduleDays]
  );

  const isUnlocked = (cert: Certificate) =>
    cert.type === 'bonus' ? bonusAttended >= cert.requiredLessons : activeCourse.lessonsDone >= cert.requiredLessons;

  const openCertificate = (cert: Certificate) => {
    if (isUnlocked(cert)) setSelected(cert);
    else setLockedNotice(cert);
  };

  const exportPdf = (cert: Certificate) => {
    if (Platform.OS === 'web') {
      window.print();
    } else {
      Share.share({
        message: `${cert.title}\n${profileStats.name}\n${cert.rangeLabel}\n${cert.points} ball\n${cert.dateRangeLabel}`,
      });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Sertifikatlarim" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Har 12 ta darsni yakunlaganingizda yangi sertifikat, kurs oxirida esa to'liq kurs sertifikati beriladi.
        </Text>
        {CERTIFICATES.map((cert) => {
          const unlocked = isUnlocked(cert);
          const cfg = TYPE_CONFIG[cert.type];
          return (
            <Pressable key={cert.id} onPress={() => openCertificate(cert)}>
              <Card style={StyleSheet.flatten([styles.card, !unlocked && styles.cardLocked])}>
                <View style={[styles.iconWrap, { backgroundColor: unlocked ? cfg.bg : theme.colors.bg }]}>
                  <Ionicons name={unlocked ? cfg.icon : 'lock-closed'} size={24} color={unlocked ? cfg.color : theme.colors.textLight} />
                </View>
                <View style={styles.info}>
                  <Text style={[styles.title, !unlocked && styles.titleLocked]}>{cert.title}</Text>
                  <Text style={styles.meta}>{unlocked ? cert.dateRangeLabel : `${cert.requiredLessons} ta dars talab qilinadi`}</Text>
                </View>
                {unlocked && (
                  <View style={styles.doneBadge}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                )}
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Sertifikat oynasi */}
      <Modal visible={selected !== null} animationType="fade" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={styles.dialogBackdropTap} onPress={() => setSelected(null)} />
          {selected && (
            <View style={styles.certModalCard}>
              <View style={[styles.certPaper, { borderColor: TYPE_CONFIG[selected.type].color }]}>
                <Ionicons name={TYPE_CONFIG[selected.type].icon} size={40} color={TYPE_CONFIG[selected.type].color} />
                <Text style={styles.certKicker}>SERTIFIKAT</Text>
                <Text style={styles.certStudentName}>{profileStats.name}</Text>
                <Text style={styles.certBody}>quyidagi darslarni muvaffaqiyatli yakunladi:</Text>
                <Text style={[styles.certRange, { color: TYPE_CONFIG[selected.type].color }]}>{selected.rangeLabel}</Text>
                <View style={styles.certDivider} />
                <View style={styles.certStatsRow}>
                  <View style={styles.certStatItem}>
                    <Text style={styles.certStatValue}>{selected.points}</Text>
                    <Text style={styles.certStatLabel}>to'plagan ball</Text>
                  </View>
                  <View style={styles.certStatItem}>
                    <Text style={styles.certStatValue}>{selected.dateRangeLabel}</Text>
                    <Text style={styles.certStatLabel}>o'qigan davr</Text>
                  </View>
                </View>
                <Text style={styles.certFooter}>myhomework.uz</Text>
              </View>

              <Pressable style={styles.exportBtn} onPress={() => exportPdf(selected)}>
                <Ionicons name="download-outline" size={18} color="#fff" />
                <Text style={styles.exportBtnText}>PDF sifatida yuklab olish</Text>
              </Pressable>
              <Pressable style={styles.closeBtn} onPress={() => setSelected(null)}>
                <Text style={styles.closeBtnText}>Yopish</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      {/* Qulflangan sertifikat ogohlantirishi */}
      <Modal visible={lockedNotice !== null} animationType="fade" transparent onRequestClose={() => setLockedNotice(null)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={styles.dialogBackdropTap} onPress={() => setLockedNotice(null)} />
          {lockedNotice && (
            <View style={styles.dialogCard}>
              <View style={styles.dialogIconWrap}>
                <Ionicons name="lock-closed" size={30} color={theme.colors.textMuted} />
              </View>
              <Text style={styles.dialogTitle}>Bu sertifikat hali qulflangan</Text>
              <Text style={styles.dialogSubtitle}>
                Ushbu sertifikatni olish uchun {lockedNotice.requiredLessons} ta darsni yakunlashingiz kerak.
              </Text>
              <Pressable style={styles.dialogConfirmBtn} onPress={() => setLockedNotice(null)}>
                <Text style={styles.dialogConfirmText}>Tushunarli</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 40, gap: 12 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginBottom: 4, lineHeight: 19 },

  card: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardLocked: { opacity: 0.65 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1 },
  title: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text },
  titleLocked: { color: theme.colors.textMuted },
  meta: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  doneBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dialogBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
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
  dialogIconWrap: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg, marginBottom: 4 },
  dialogTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text, textAlign: 'center' },
  dialogSubtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
  dialogConfirmBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    marginTop: 10,
  },
  dialogConfirmText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },

  certModalCard: { width: '100%', maxWidth: 360, gap: 12 },
  certPaper: {
    backgroundColor: '#fff',
    borderRadius: theme.radius.lg,
    borderWidth: 3,
    padding: 26,
    alignItems: 'center',
    gap: 6,
    ...theme.shadow.card,
  },
  certKicker: { fontFamily: theme.fonts.bold, fontSize: 12, letterSpacing: 3, color: theme.colors.textMuted, marginTop: 4 },
  certStudentName: { fontFamily: theme.fonts.extraBold, fontSize: 22, color: theme.colors.text, marginTop: 4, textAlign: 'center' },
  certBody: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
  certRange: { fontFamily: theme.fonts.bold, fontSize: 17, textAlign: 'center' },
  certDivider: { width: '60%', height: 1, backgroundColor: theme.colors.border, marginVertical: 10 },
  certStatsRow: { flexDirection: 'row', gap: 28 },
  certStatItem: { alignItems: 'center' },
  certStatValue: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.text },
  certStatLabel: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  certFooter: { fontFamily: theme.fonts.medium, fontSize: 11, color: theme.colors.textLight, marginTop: 14 },

  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
  },
  exportBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
  closeBtn: { alignItems: 'center', paddingVertical: 10 },
  closeBtnText: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.textMuted },
});
