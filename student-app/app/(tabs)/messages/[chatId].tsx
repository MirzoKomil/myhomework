import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatThreadView } from '@/components/chat/ChatThreadView';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { ChatMessage, chatThreads } from '@/data/mock';
import { addMessage, getMessages, subscribe } from '@/services/chatStore';
import { getStudentProfile } from '@/data/studentProfiles';
import { getThread, sendMessage, subscribe as subscribeStudentChat } from '@/services/studentChatStore';

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const isStudentChat = typeof chatId === 'string' && chatId.startsWith('student-');
  const studentProfileId = isStudentChat ? chatId.replace(/^student-/, '') : null;

  const thread = chatThreads.find((t) => t.id === chatId);
  const [messages, setMessages] = useState<ChatMessage[]>(() => (chatId && !isStudentChat ? getMessages(chatId) : []));

  useEffect(() => {
    if (!chatId || isStudentChat) return;
    return subscribe(() => setMessages(getMessages(chatId)));
  }, [chatId, isStudentChat]);

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!isStudentChat) return;
    return subscribeStudentChat(() => forceUpdate((n) => n + 1));
  }, [isStudentChat]);

  if (isStudentChat && studentProfileId) {
    const studentThread = getThread(studentProfileId);
    const profile = getStudentProfile(studentThread?.name ?? studentProfileId.replace(/-/g, ' '));
    const studentMessages: ChatMessage[] = (studentThread?.messages ?? []).map((m) => ({
      id: m.id,
      chatId: chatId as string,
      from: m.from,
      type: 'text',
      text: m.text,
      time: m.time,
    }));

    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title={studentThread?.name ?? profile.name} showBack />
        <ChatThreadView
          messages={studentMessages}
          onSendText={(text) => sendMessage(profile, text)}
          onSendImage={() => {}}
          onSendVoice={() => {}}
        />
      </SafeAreaView>
    );
  }

  if (!thread || !chatId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Chat" showBack />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={thread.name} showBack />
      <ChatThreadView
        messages={messages}
        onSendText={(text) =>
          addMessage({ id: `msg-${Date.now()}`, chatId, from: 'me', type: 'text', text, time: nowTime() })
        }
        onSendImage={(uri) =>
          addMessage({ id: `msg-${Date.now()}`, chatId, from: 'me', type: 'image', imageUri: uri, time: nowTime() })
        }
        onSendVoice={(uri, duration) =>
          addMessage({
            id: `msg-${Date.now()}`,
            chatId,
            from: 'me',
            type: 'voice',
            voiceUri: uri,
            voiceDuration: duration,
            time: nowTime(),
          })
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
});
