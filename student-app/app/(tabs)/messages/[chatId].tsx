import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatThreadView } from '@/components/chat/ChatThreadView';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import { ChatMessage, celebrityPersonas, chatThreads } from '@/data/mock';
import { addMessage, getMessages, refreshRealMessages, subscribe } from '@/services/chatStore';
import { getStudentProfile } from '@/data/studentProfiles';
import { getThread, sendMessage, subscribe as subscribeStudentChat } from '@/services/studentChatStore';
import {
  addPersonaMessage,
  COIN_PER_MINUTE,
  getPersonaMessages,
  pickDemoReply,
  purchaseMinutes,
  subscribePersona,
  useLegendAccess,
} from '@/services/personaChatStore';
import { useCoins } from '@/services/coinsStore';

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const MINUTE_PRESETS = [5, 10, 15, 30];

function PersonaChatScreen({ personaId }: { personaId: string }) {
  const { t } = useLang();
  const persona = celebrityPersonas.find((p) => p.id === personaId)!;
  const [messages, setMessages] = useState<ChatMessage[]>(() => getPersonaMessages(personaId));
  const coins = useCoins();
  const { remainingSeconds, active } = useLegendAccess(personaId);
  const [buying, setBuying] = useState(false);

  useEffect(() => subscribePersona(() => setMessages(getPersonaMessages(personaId))), [personaId]);

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

  const buy = async (minutes: number) => {
    if (buying) return;
    setBuying(true);
    const ok = await purchaseMinutes(personaId, minutes);
    setBuying(false);
    if (!ok) {
      Alert.alert(
        t('msg_not_enough_coins_title'),
        t('msg_not_enough_coins_body')
          .replace('{minutes}', String(minutes))
          .replace('{cost}', String(minutes * COIN_PER_MINUTE))
          .replace('{coins}', String(coins))
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={persona.name} showBack />
      {active && (
        <View style={[styles.timerBar, remainingSeconds < 30 && styles.timerBarLow]}>
          <Ionicons name="timer-outline" size={15} color={remainingSeconds < 30 ? theme.colors.danger : theme.colors.blue} />
          <Text style={[styles.timerBarText, remainingSeconds < 30 && styles.timerBarTextLow]}>
            {formatClock(remainingSeconds)} {t('msg_timer_remaining_suffix')}
          </Text>
        </View>
      )}

      {active ? (
        <ChatThreadView
          messages={messages}
          onSendText={(text) => {
            addPersonaMessage({ id: `msg-${Date.now()}`, chatId: personaId, from: 'me', type: 'text', text, time: nowTime() });
            replyAsPersona();
          }}
          onSendImage={(uri) => {
            addPersonaMessage({ id: `msg-${Date.now()}`, chatId: personaId, from: 'me', type: 'image', imageUri: uri, time: nowTime() });
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
      ) : (
        <View style={styles.paywall}>
          <Image source={persona.avatarImage} style={styles.paywallAvatar} />
          <Text style={styles.paywallTitle}>{persona.name} {t('msg_paywall_title_suffix')}</Text>
          <Text style={styles.paywallSub}>
            {t('msg_paywall_sub').replace('{rate}', String(COIN_PER_MINUTE)).replace('{coins}', String(coins))}
          </Text>
          <View style={styles.presetRow}>
            {MINUTE_PRESETS.map((m) => (
              <Pressable key={m} style={styles.presetBtn} disabled={buying} onPress={() => buy(m)}>
                <Text style={styles.presetMinutes}>{m} {t('msg_minutes_suffix')}</Text>
                <Text style={styles.presetCost}>{m * COIN_PER_MINUTE} coin</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.paywallWarning}>
            {t('msg_paywall_warning')}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

export default function ChatScreen() {
  const { t } = useLang();
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const isStudentChat = typeof chatId === 'string' && chatId.startsWith('student-');
  const isPersonaChat = typeof chatId === 'string' && chatId.startsWith('persona-');
  const studentProfileId = isStudentChat ? chatId.replace(/^student-/, '') : null;
  const personaId = isPersonaChat ? chatId.replace(/^persona-/, '') : null;

  const thread = chatThreads.find((t) => t.id === chatId);
  const [messages, setMessages] = useState<ChatMessage[]>(() => (chatId && !isStudentChat && !isPersonaChat ? getMessages(chatId) : []));

  useEffect(() => {
    if (!chatId || isStudentChat || isPersonaChat) return;
    refreshRealMessages().then(() => setMessages(getMessages(chatId)));
    return subscribe(() => setMessages(getMessages(chatId)));
  }, [chatId, isStudentChat, isPersonaChat]);

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!isStudentChat) return;
    return subscribeStudentChat(() => forceUpdate((n) => n + 1));
  }, [isStudentChat]);

  if (isPersonaChat && personaId) {
    return <PersonaChatScreen personaId={personaId} />;
  }

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
        <ScreenHeader title={t('msg_chat_title')} showBack />
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

  timerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: theme.colors.blueLight,
  },
  timerBarLow: { backgroundColor: theme.colors.dangerBg },
  timerBarText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.blue },
  timerBarTextLow: { color: theme.colors.danger },

  paywall: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  paywallAvatar: { width: 96, height: 96, borderRadius: 28 },
  paywallTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text, textAlign: 'center' },
  paywallSub: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 8 },
  presetBtn: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.purple,
    minWidth: 90,
    ...theme.shadow.card,
  },
  presetMinutes: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.text },
  presetCost: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.purple, marginTop: 2 },
  paywallWarning: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
});
