import { Ionicons } from '@expo/vector-icons';
import {
  AudioPlayer,
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
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
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    if (!chatId) return;
    return subscribe(() => setMessages(getMessages(chatId)));
  }, [chatId]);

  useEffect(() => {
    return () => {
      playerRef.current?.remove();
    };
  }, []);

  const sendText = () => {
    if (!inputText.trim() || !chatId) return;
    addMessage({
      id: `msg-${Date.now()}`,
      chatId,
      from: 'me',
      type: 'text',
      text: inputText.trim(),
      time: nowTime(),
    });
    setInputText('');
  };

  const pickImage = async () => {
    if (!chatId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    addMessage({
      id: `msg-${Date.now()}`,
      chatId,
      from: 'me',
      type: 'image',
      imageUri: result.assets[0].uri,
      time: nowTime(),
    });
  };

  const toggleRecording = async () => {
    if (!chatId) return;

    if (isRecording) {
      setIsRecording(false);
      const durationSeconds = recorder.currentTime;
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        addMessage({
          id: `msg-${Date.now()}`,
          chatId,
          from: 'me',
          type: 'voice',
          voiceUri: uri,
          voiceDuration: durationSeconds ? Math.round(durationSeconds) : undefined,
          time: nowTime(),
        });
      }
      return;
    }

    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setIsRecording(true);
  };

  const playVoice = (msg: ChatMessage) => {
    if (!msg.voiceUri) return;
    if (playingId === msg.id) {
      playerRef.current?.pause();
      setPlayingId(null);
      return;
    }
    playerRef.current?.remove();
    const player = createAudioPlayer(msg.voiceUri);
    playerRef.current = player;
    setPlayingId(msg.id);
    player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) setPlayingId(null);
    });
    player.play();
  };

  if (!thread) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Chat" showBack />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={thread.name} showBack />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
          {messages.map((msg) => (
            <View key={msg.id} style={[styles.bubbleRow, msg.from === 'me' && styles.bubbleRowMe]}>
              <View style={[styles.bubble, msg.from === 'me' ? styles.bubbleMe : styles.bubbleThem]}>
                {msg.type === 'text' && (
                  <Text style={[styles.bubbleText, msg.from === 'me' && styles.bubbleTextMe]}>{msg.text}</Text>
                )}
                {msg.type === 'image' && msg.imageUri && <Image source={{ uri: msg.imageUri }} style={styles.bubbleImage} />}
                {msg.type === 'voice' && (
                  <Pressable style={styles.voiceRow} onPress={() => playVoice(msg)}>
                    <Ionicons
                      name={playingId === msg.id ? 'pause-circle' : 'play-circle'}
                      size={28}
                      color={msg.from === 'me' ? '#fff' : theme.colors.purple}
                    />
                    <Text style={[styles.bubbleText, msg.from === 'me' && styles.bubbleTextMe]}>
                      {msg.voiceDuration ? `${msg.voiceDuration}s` : 'Ovozli xabar'}
                    </Text>
                  </Pressable>
                )}
                <Text style={[styles.bubbleTime, msg.from === 'me' && styles.bubbleTimeMe]}>{msg.time}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.inputBar}>
          <Pressable style={styles.iconBtn} onPress={pickImage}>
            <Ionicons name="image-outline" size={22} color={theme.colors.purple} />
          </Pressable>
          <TextInput
            style={styles.textInput}
            placeholder="Xabar yozing..."
            placeholderTextColor={theme.colors.textLight}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          {inputText.trim() ? (
            <Pressable style={styles.sendBtn} onPress={sendText}>
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          ) : (
            <Pressable style={[styles.iconBtn, isRecording && styles.iconBtnRecording]} onPress={toggleRecording}>
              <Ionicons name={isRecording ? 'stop' : 'mic-outline'} size={22} color={isRecording ? '#fff' : theme.colors.purple} />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  flex: { flex: 1 },
  messages: { padding: 16, gap: 10 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: 16, padding: 12 },
  bubbleThem: { backgroundColor: theme.colors.surface, ...theme.shadow.card },
  bubbleMe: { backgroundColor: theme.colors.purple },
  bubbleText: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.text },
  bubbleTextMe: { color: '#fff' },
  bubbleImage: { width: 180, height: 180, borderRadius: 12 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bubbleTime: { fontFamily: theme.fonts.regular, fontSize: 10, color: theme.colors.textLight, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.75)' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnRecording: { backgroundColor: theme.colors.danger },
  textInput: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
