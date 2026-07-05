import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { chatThreads } from '@/data/mock';

export default function TeacherScreen() {
  const teacher = chatThreads.find((t) => t.id === 'main-teacher');
  const assistant = chatThreads.find((t) => t.id === 'assistant-teacher');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Mening ustozim" showBack />
      <View style={styles.wrap}>
        {teacher && (
          <LinearGradient colors={teacher.color === '#7B61FF' ? ['#9B7BFF', '#6B4FE0'] : [teacher.color, teacher.color]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarEmoji}>{teacher.emoji}</Text>
            </View>
            <Text style={styles.name}>{teacher.name}</Text>
            <Text style={styles.role}>{teacher.role}</Text>
            <Pressable style={styles.contactBtn} onPress={() => router.push(`/messages/${teacher.id}` as never)}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.purple} />
              <Text style={styles.contactBtnText}>Bog'lanish</Text>
            </Pressable>
          </LinearGradient>
        )}

        {assistant && (
          <View style={styles.assistantCard}>
            <View style={styles.assistantAvatar}>
              <Text style={styles.assistantEmoji}>{assistant.emoji}</Text>
            </View>
            <View style={styles.assistantInfo}>
              <Text style={styles.assistantName}>{assistant.name}</Text>
              <Text style={styles.assistantRole}>{assistant.role}</Text>
            </View>
            <Pressable style={styles.iconBtn} onPress={() => router.push(`/messages/${assistant.id}` as never)}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.colors.purple} />
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  wrap: { padding: 20, gap: 16 },
  card: { borderRadius: theme.radius.lg, padding: 24, alignItems: 'center', ...theme.shadow.card },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarEmoji: { fontSize: 34 },
  name: { fontFamily: theme.fonts.extraBold, fontSize: 20, color: '#fff', marginBottom: 4 },
  role: { fontFamily: theme.fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 18 },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.radius.sm,
  },
  contactBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.purple },
  assistantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    gap: 12,
    ...theme.shadow.card,
  },
  assistantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantEmoji: { fontSize: 22 },
  assistantInfo: { flex: 1 },
  assistantName: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text },
  assistantRole: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
