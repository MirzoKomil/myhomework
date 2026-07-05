import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatThreadView } from '@/components/chat/ChatThreadView';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { celebrityPersonas, ChatMessage } from '@/data/mock';
import { addPersonaMessage, getPersonaMessages, pickDemoReply, subscribePersona } from '@/services/personaChatStore';

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function PersonaChatScreen() {
  const { personaId } = useLocalSearchParams<{ personaId: string }>();
  const persona = celebrityPersonas.find((p) => p.id === personaId);
  const [messages, setMessages] = useState<ChatMessage[]>(() => (personaId ? getPersonaMessages(personaId) : []));

  useEffect(() => {
    if (!personaId) return;
    return subscribePersona(() => setMessages(getPersonaMessages(personaId)));
  }, [personaId]);

  if (!persona || !personaId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Chat" showBack />
      </SafeAreaView>
    );
  }

  const replyAsPersona = () => {
    setTimeout(() => {
      addPersonaMessage({
        id: `reply-${Date.now()}`,
        chatId: personaId,
        from: 'them',
        type: 'text',
        text: pickDemoReply(),
        time: nowTime(),
      });
    }, 500);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={persona.name} showBack />
      <ChatThreadView
        messages={messages}
        onSendText={(text) => {
          addPersonaMessage({ id: `msg-${Date.now()}`, chatId: personaId, from: 'me', type: 'text', text, time: nowTime() });
          replyAsPersona();
        }}
        onSendImage={(uri) => {
          addPersonaMessage({
            id: `msg-${Date.now()}`,
            chatId: personaId,
            from: 'me',
            type: 'image',
            imageUri: uri,
            time: nowTime(),
          });
          replyAsPersona();
        }}
        onSendVoice={(uri, duration) => {
          addPersonaMessage({
            id: `msg-${Date.now()}`,
            chatId: personaId,
            from: 'me',
            type: 'voice',
            voiceUri: uri,
            voiceDuration: duration,
            time: nowTime(),
          });
          replyAsPersona();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
});
