import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';

type NotificationItem = {
  id: string;
  icon: 'school-outline' | 'trophy-outline' | 'megaphone-outline';
  title: string;
  message: string;
  time: string;
  unread: boolean;
};

const notifications: NotificationItem[] = [
  {
    id: '1',
    icon: 'school-outline',
    title: "Yangi dars qo'shildi",
    message: "Elementary 1 kursiga yangi dars yuklandi",
    time: '2 soat oldin',
    unread: true,
  },
  {
    id: '2',
    icon: 'trophy-outline',
    title: 'Tabriklaymiz!',
    message: "Siz 5 kunlik streak'ni ushladingiz",
    time: 'Kecha',
    unread: true,
  },
  {
    id: '3',
    icon: 'megaphone-outline',
    title: 'Live dars eslatmasi',
    message: 'Speaking Club darsi ertaga soat 19:00 da',
    time: '2 kun oldin',
    unread: false,
  },
];

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Bildirishnomalar" showBack />
      <View style={styles.list}>
        {notifications.map((n) => (
          <View key={n.id} style={styles.row}>
            <View style={[styles.iconWrap, n.unread && styles.iconWrapUnread]}>
              <Ionicons name={n.icon} size={20} color={n.unread ? theme.colors.purple : theme.colors.textMuted} />
            </View>
            <View style={styles.info}>
              <Text style={styles.title}>{n.title}</Text>
              <Text style={styles.message}>{n.message}</Text>
              <Text style={styles.time}>{n.time}</Text>
            </View>
            {n.unread && <View style={styles.dot} />}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  list: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    gap: 12,
    ...theme.shadow.card,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnread: { backgroundColor: theme.colors.purpleLight },
  info: { flex: 1 },
  title: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text, marginBottom: 2 },
  message: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginBottom: 4 },
  time: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textLight },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.danger,
    marginTop: 6,
  },
});
