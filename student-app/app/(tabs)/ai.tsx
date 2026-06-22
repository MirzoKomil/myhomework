import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';

type Message = { id: string; role: 'user' | 'assistant'; text: string };

const suggestions = [
  'Present Simple qanday ishlatiladi?',
  'Bu so\'zni talaffuz qiling',
  'Mening xatolarimni tuzating',
];

export default function AIScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      text: "Salom! Men sizning AI yordamchingizman. Ingliz tili bo'yicha savollaringizni berishingiz mumkin.",
    },
  ]);
  const [input, setInput] = useState('');

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: text.trim() };
    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      text: "Bu demo javob. Keyinchalik myhomework.uz API bilan bog'lanadi.",
    };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.aiBadge}>
          <Ionicons name="sparkles" size={20} color={theme.colors.purple} />
        </View>
        <View>
          <Text style={styles.headerTitle}>AI Yordamchi</Text>
          <Text style={styles.headerSub}>Ingliz tili bo'yicha yordam</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              <Text style={[styles.bubbleText, msg.role === 'user' && styles.userText]}>
                {msg.text}
              </Text>
            </View>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestions}>
          {suggestions.map((s) => (
            <Pressable key={s} style={styles.chip} onPress={() => sendMessage(s)}>
              <Text style={styles.chipText}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Savolingizni yozing..."
            placeholderTextColor={theme.colors.textLight}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendMessage(input)}
          />
          <Pressable style={styles.sendBtn} onPress={() => sendMessage(input)}>
            <Ionicons name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  aiBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: theme.fonts.bold, fontSize: 18, color: theme.colors.text },
  headerSub: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted },
  messages: { padding: 20, gap: 12, paddingBottom: 8 },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: theme.radius.sm },
  aiBubble: { backgroundColor: theme.colors.surface, alignSelf: 'flex-start', ...theme.shadow.card },
  userBubble: { backgroundColor: theme.colors.purple, alignSelf: 'flex-end' },
  bubbleText: { fontFamily: theme.fonts.regular, fontSize: 15, color: theme.colors.text, lineHeight: 22 },
  userText: { color: '#fff' },
  suggestions: { paddingHorizontal: 20, maxHeight: 44, marginBottom: 8 },
  chip: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipText: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  input: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
