import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatThreadView } from '@/components/chat/ChatThreadView';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { ChatMessage, chatThreads } from '@/data/mock';
import { addMessage, getMessages, subscribe } from '@/services/chatStore';

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const thread = chatThreads.find((t) => t.id === chatId);
  const [messages, setMessages] = useState<ChatMessage[]>(() => (chatId ? getMessages(chatId) : []));

  useEffect(() => {
    if (!chatId) return;
    return subscribe(() => setMessages(getMessages(chatId)));
  }, [chatId]);

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
