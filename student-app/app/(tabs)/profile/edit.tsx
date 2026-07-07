import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { profileStats } from '@/data/mock';
import { setAvatarUri, useAvatarUri } from '@/services/avatarStore';

const DETAIL_ROWS: { label: string; value: string }[] = [
  { label: 'Ism-familiya', value: profileStats.name },
  { label: 'Student ID', value: profileStats.studentId },
  { label: 'Yoshi', value: `${profileStats.age}` },
  { label: 'Jinsi', value: profileStats.gender },
  { label: 'Manzil', value: profileStats.address },
  { label: 'Telefon raqami', value: profileStats.phone },
  { label: 'Parol', value: '••••••••' },
];

export default function EditProfileScreen() {
  const avatarUri = useAvatarUri();

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: Platform.OS === 'web',
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    // Web'da tanlangan rasm blob: URL beradi — bu vaqtinchalik, sahifa qayta yuklanganda o'chib qoladi.
    // Shu sababli saqlash uchun doimiy base64 data URI ishlatamiz.
    const uri = Platform.OS === 'web' && asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri;
    await setAvatarUri(uri);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Profilni tahrirlash" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={44} color={theme.colors.purple} />
            )}
          </View>
          <Pressable style={styles.cameraBadge} onPress={pickImage} hitSlop={8}>
            <Ionicons name="camera" size={16} color="#fff" />
          </Pressable>
          <Pressable onPress={pickImage}>
            <Text style={styles.changePhotoText}>Rasmni almashtirish</Text>
          </Pressable>
        </View>

        <Card style={styles.noticeCard}>
          <Ionicons name="information-circle" size={22} color={theme.colors.blue} style={{ marginBottom: 8 }} />
          <Text style={styles.noticeText}>
            Ma'lumotlar onlayn maktab bazasida saqlangani sababli, o'quvchi ma'lumotlari faqat ma'muriyat tomonidan
            o'zgartirilishi mumkin. Siz faqat profil rasmingizni o'zgartira olasiz. Agar biror ma'lumot xato bo'lsa,
            bizga murojaat qiling — tez orada to'g'irlab beramiz.
          </Text>
          <View style={styles.noticeActions}>
            <Pressable style={styles.noticeActionBtn} onPress={() => Linking.openURL(`tel:${profileStats.phone}`)}>
              <Ionicons name="call-outline" size={18} color={theme.colors.purple} />
              <Text style={styles.noticeActionText}>Qo'ng'iroq qilish</Text>
            </Pressable>
            <Pressable style={styles.noticeActionBtn} onPress={() => router.push('/messages/support' as never)}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.purple} />
              <Text style={styles.noticeActionText}>Supportga yozish</Text>
            </Pressable>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Shaxsiy ma'lumotlar</Text>
        <Card style={styles.detailsCard}>
          {DETAIL_ROWS.map((row, i) => (
            <View key={row.label} style={[styles.detailRow, i === DETAIL_ROWS.length - 1 && styles.detailRowLast]}>
              <Text style={styles.detailLabel}>{row.label}</Text>
              <Text style={styles.detailValue} numberOfLines={2}>
                {row.value}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },

  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 96, height: 96 },
  cameraBadge: {
    position: 'absolute',
    top: 68,
    left: '50%',
    marginLeft: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.bg,
  },
  changePhotoText: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.purple, marginTop: 10 },

  noticeCard: { marginBottom: 20, backgroundColor: theme.colors.blueLight },
  noticeText: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.text, lineHeight: 19 },
  noticeActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  noticeActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingVertical: 11,
    ...theme.shadow.card,
  },
  noticeActionText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.purple },

  sectionTitle: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.text, marginBottom: 10 },
  detailsCard: {},
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted, flexShrink: 0 },
  detailValue: { flex: 1, textAlign: 'right', fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.text },
});
