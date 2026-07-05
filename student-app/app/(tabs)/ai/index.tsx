import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
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
import { celebrityPersonas, PERSONA_CATEGORY_LABELS, PersonaCategory } from '@/data/mock';

type Message = { id: string; role: 'user' | 'assistant'; text: string };

const suggestions = [
  'Present Simple qanday ishlatiladi?',
  "Bu so'zni talaffuz qiling",
  'Mening xatolarimni tuzating',
];

const CATEGORY_FILTERS: ('all' | PersonaCategory)[] = [
  'all',
  'general',
  'business',
  'sports',
  'politics',
  'film',
  'medicine',
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
  const [showLegends, setShowLegends] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | PersonaCategory>('all');
  const [search, setSearch] = useState('');

  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const shimmerTranslate = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-240, 400] });

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

  const filteredPersonas = celebrityPersonas.filter((p) => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (search.trim() && !p.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const openPersona = (personaId: string) => {
    setShowLegends(false);
    router.push(`/ai/persona/${personaId}` as never);
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

      <Pressable style={styles.legendsWrap} onPress={() => setShowLegends(true)}>
        <LinearGradient
          colors={['#7B61FF', '#4F46E5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.legendsBar}>
          <View style={styles.shimmerClip} pointerEvents="none">
            <Animated.View style={[styles.shimmerSweep, { transform: [{ translateX: shimmerTranslate }] }]}>
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
          <Text style={styles.legendsText}>💡 Afsonalar bilan suhbat qiling — YANGI!</Text>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </LinearGradient>
      </Pressable>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
          {messages.map((msg) => (
            <View key={msg.id} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              <Text style={[styles.bubbleText, msg.role === 'user' && styles.userText]}>{msg.text}</Text>
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

      <Modal visible={showLegends} animationType="slide" transparent onRequestClose={() => setShowLegends(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropTap} onPress={() => setShowLegends(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>Afsonalar bilan suhbat</Text>
              <Text style={styles.sheetIntro}>
                Mashhur shaxslardan birini tanlang va u bilan ingliz tilida, o'sha shaxsning sohasiga oid
                mavzularda suhbatlashing. Matn yoki ovozli xabar yuborishingiz mumkin.
              </Text>

              <TextInput
                style={styles.searchInput}
                placeholder="Kim bilan suhbatlashmoqchisiz?"
                placeholderTextColor={theme.colors.textLight}
                value={search}
                onChangeText={setSearch}
              />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                {CATEGORY_FILTERS.map((cat) => (
                  <Pressable
                    key={cat}
                    style={[styles.filterChip, categoryFilter === cat && styles.filterChipActive]}
                    onPress={() => setCategoryFilter(cat)}>
                    <Text style={[styles.filterChipText, categoryFilter === cat && styles.filterChipTextActive]}>
                      {cat === 'all' ? 'Barchasi' : PERSONA_CATEGORY_LABELS[cat]}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.personaList}>
                {filteredPersonas.map((p) => (
                  <Pressable key={p.id} onPress={() => openPersona(p.id)}>
                    <LinearGradient
                      colors={p.colors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.personaRow}>
                      <View style={styles.personaAvatar}>
                        <Text style={styles.personaEmoji}>{p.emoji}</Text>
                      </View>
                      <View style={styles.personaInfo}>
                        <Text style={styles.personaName}>{p.name}</Text>
                        <View style={styles.personaTag}>
                          <Text style={styles.personaTagText}>{PERSONA_CATEGORY_LABELS[p.category]}</Text>
                        </View>
                      </View>
                      <View style={styles.personaArrow}>
                        <Ionicons name="chevron-forward" size={16} color={theme.colors.text} />
                      </View>
                    </LinearGradient>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingTop: 16,
    paddingBottom: 12,
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
  legendsWrap: { paddingHorizontal: 20, marginBottom: 12 },
  legendsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  shimmerClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  shimmerSweep: { position: 'absolute', top: 0, bottom: 0, width: 120 },
  legendsText: { flex: 1, fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBackdropTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 32 },
  sheetTitle: { fontFamily: theme.fonts.extraBold, fontSize: 20, color: theme.colors.text, marginBottom: 8 },
  sheetIntro: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 19,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 12,
    ...theme.shadow.card,
  },
  filterRow: { marginBottom: 16, maxHeight: 40 },
  filterChip: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: { backgroundColor: theme.colors.purple, borderColor: theme.colors.purple },
  filterChipText: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.textMuted },
  filterChipTextActive: { color: '#fff' },
  personaList: { gap: 10 },
  personaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.md,
    padding: 12,
    gap: 12,
  },
  personaAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personaEmoji: { fontSize: 24 },
  personaInfo: { flex: 1, gap: 4 },
  personaName: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
  personaTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  personaTagText: { fontFamily: theme.fonts.semiBold, fontSize: 10, color: '#fff' },
  personaArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
