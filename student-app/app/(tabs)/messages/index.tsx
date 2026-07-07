import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { chatThreads } from '@/data/mock';
import { getLastMessage, subscribe } from '@/services/chatStore';
import { useStudentThreads } from '@/services/studentChatStore';

function previewText(chatId: string): string {
  const last = getLastMessage(chatId);
  if (!last) return '';
  if (last.type === 'image') return '📷 Rasm';
  if (last.type === 'voice') return '🎤 Ovozli xabar';
  return last.text ?? '';
}

export default function MessagesScreen() {
  const [, forceUpdate] = useState(0);
  const studentThreads = useStudentThreads();

  useEffect(() => subscribe(() => forceUpdate((n) => n + 1)), []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Muloqot" showBack />
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {chatThreads.map((chat) => {
          const last = getLastMessage(chat.id);
          return (
            <Pressable
              key={chat.id}
              style={styles.row}
              onPress={() => router.push(`/messages/${chat.id}` as never)}>
              <View style={[styles.avatar, { backgroundColor: chat.color }]}>
                <Text style={styles.avatarEmoji}>{chat.emoji}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{chat.name}</Text>
                <Text style={styles.preview} numberOfLines={1}>
                  {previewText(chat.id) || chat.role}
                </Text>
              </View>
              {last && <Text style={styles.time}>{last.time}</Text>}
            </Pressable>
          );
        })}

        {studentThreads.map((thread) => {
          const lastMsg = thread.messages[thread.messages.length - 1];
          return (
            <Pressable
              key={thread.id}
              style={styles.row}
              onPress={() => router.push(`/messages/student-${thread.id}` as never)}>
              <View style={[styles.avatar, { backgroundColor: theme.colors.purpleLight }]}>
                <Text style={styles.avatarEmoji}>{thread.avatarEmoji}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{thread.name}</Text>
                <Text style={styles.preview} numberOfLines={1}>
                  {lastMsg ? lastMsg.text : "O'quvchi hamkursingiz"}
                </Text>
              </View>
              {lastMsg && <Text style={styles.time}>{lastMsg.time}</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  list: { paddingHorizontal: 20, paddingTop: 8, gap: 12, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    gap: 12,
    ...theme.shadow.card,
  },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 22 },
  info: { flex: 1 },
  name: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text, marginBottom: 3 },
  preview: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted },
  time: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textLight },
});
