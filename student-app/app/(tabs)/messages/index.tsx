import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityModal } from '@/components/ActivityModal';
import { CoinPill } from '@/components/ui/CoinIcon';
import { CoinInfoModal } from '@/components/ui/CoinInfoModal';
import { WobbleIcon } from '@/components/ui/WobbleIcon';
import { theme } from '@/constants/theme';
import { celebrityPersonas, chatThreads } from '@/data/mock';
import { useCommunityActivity } from '@/services/communityStore';
import { useCoins } from '@/services/coinsStore';
import { getLastMessage, getMessages, subscribe } from '@/services/chatStore';
import { getPersonaMessages, hasRealExchange, loadPersonaChats, subscribePersona } from '@/services/personaChatStore';
import { useStudentThreads } from '@/services/studentChatStore';

type Folder = 'all' | 'peers' | 'legends' | 'admin';

const FOLDER_ORDER: Folder[] = ['all', 'peers', 'legends', 'admin'];

const FOLDER_LABELS: Record<Folder, string> = {
  all: 'Barchasi',
  peers: 'Maqsaddoshlar',
  legends: 'Afsonalar',
  admin: "Ma'muriyat",
};

function previewText(chatId: string): string {
  const last = getLastMessage(chatId);
  if (!last) return '';
  if (last.type === 'image') return '📷 Rasm';
  if (last.type === 'voice') return '🎤 Ovozli xabar';
  return last.text ?? '';
}

function ShimmerRow({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const shimmerTranslate = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-260, 400] });

  return (
    <Pressable style={rowStyles.legendRow} onPress={onPress}>
      <View style={rowStyles.shimmerClip} pointerEvents="none">
        <Animated.View style={[rowStyles.shimmerSweep, { transform: [{ translateX: shimmerTranslate }] }]}>
          <LinearGradient
            colors={['transparent', 'rgba(123,97,255,0.18)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      {children}
    </Pressable>
  );
}

export default function MessagesScreen() {
  const [, forceUpdate] = useState(0);
  const studentThreads = useStudentThreads();
  const coins = useCoins();
  const [folder, setFolder] = useState<Folder>('all');
  const [showActivity, setShowActivity] = useState(false);
  const [showCoinInfo, setShowCoinInfo] = useState(false);
  const { hasActivity } = useCommunityActivity();
  const { width } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);

  useEffect(() => subscribe(() => forceUpdate((n) => n + 1)), []);
  useEffect(() => {
    loadPersonaChats();
    return subscribePersona(() => forceUpdate((n) => n + 1));
  }, []);

  const adminItems = chatThreads.map((chat) => ({
    key: `admin-${chat.id}`,
    route: `/messages/${chat.id}`,
    name: chat.name,
    sub: chat.role,
    emoji: chat.emoji,
    avatarImage: null as ImageSourcePropType | null,
    color: chat.color,
    preview: previewText(chat.id),
    time: getLastMessage(chat.id)?.time ?? '',
    started: getMessages(chat.id).length > 0,
    isLegend: false,
  }));

  const peerItems = studentThreads.map((thread) => {
    const lastMsg = thread.messages[thread.messages.length - 1];
    return {
      key: `peer-${thread.id}`,
      route: `/messages/student-${thread.id}`,
      name: thread.name,
      sub: "O'quvchi hamkursingiz",
      emoji: thread.avatarEmoji,
      avatarImage: null as ImageSourcePropType | null,
      color: theme.colors.purpleLight,
      preview: lastMsg ? lastMsg.text : '',
      time: lastMsg ? lastMsg.time : '',
      started: thread.messages.length > 0,
      isLegend: false,
    };
  });

  const legendItems = celebrityPersonas.map((p) => {
    const msgs = getPersonaMessages(p.id);
    const last = msgs[msgs.length - 1];
    return {
      key: `legend-${p.id}`,
      route: `/messages/persona-${p.id}`,
      name: p.name,
      sub: 'Afsona bilan suhbat',
      emoji: p.emoji,
      avatarImage: p.avatarImage as ImageSourcePropType | null,
      color: p.colors[0],
      preview: last?.text ?? '',
      time: last?.time ?? '',
      started: hasRealExchange(p.id),
      isLegend: true,
    };
  });

  const allItems = [...adminItems, ...peerItems, ...legendItems].filter((item) => item.started);

  const itemsForFolder = (f: Folder) =>
    f === 'admin' ? adminItems : f === 'peers' ? peerItems : f === 'legends' ? legendItems : allItems;

  const goToFolder = (f: Folder, animated = true) => {
    setFolder(f);
    pagerRef.current?.scrollTo({ x: FOLDER_ORDER.indexOf(f) * width, animated });
  };

  const handlePagerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    const f = FOLDER_ORDER[idx];
    if (f && f !== folder) setFolder(f);
  };

  const renderRow = (item: ReturnType<typeof itemsForFolder>[number]) => {
    const rowContent = (
      <>
        <View style={[styles.avatar, { backgroundColor: item.isLegend ? theme.colors.purpleLight : item.color }]}>
          {item.avatarImage ? (
            <Image source={item.avatarImage} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarEmoji}>{item.emoji}</Text>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.preview} numberOfLines={1}>
            {item.preview || item.sub}
          </Text>
        </View>
        {item.time ? <Text style={styles.time}>{item.time}</Text> : null}
      </>
    );

    if (item.isLegend) {
      return (
        <ShimmerRow key={item.key} onPress={() => router.push(item.route as never)}>
          {rowContent}
        </ShimmerRow>
      );
    }

    return (
      <Pressable key={item.key} style={styles.row} onPress={() => router.push(item.route as never)}>
        {rowContent}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Muloqot</Text>
        <View style={styles.headerRight}>
          <Pressable style={styles.heartBtn} onPress={() => setShowActivity(true)} hitSlop={8}>
            <WobbleIcon active={hasActivity}>
              <Ionicons name="heart-outline" size={20} color={theme.colors.danger} />
            </WobbleIcon>
          </Pressable>
          <Pressable onPress={() => setShowCoinInfo(true)}>
            <CoinPill amount={coins} />
          </Pressable>
        </View>
      </View>

      <CoinInfoModal visible={showCoinInfo} onClose={() => setShowCoinInfo(false)} />

      <View style={styles.folderRow}>
        {FOLDER_ORDER.map((f) => (
          <Pressable
            key={f}
            style={[styles.folderChip, folder === f && styles.folderChipActive]}
            onPress={() => goToFolder(f)}>
            <Text style={[styles.folderChipText, folder === f && styles.folderChipTextActive]}>{FOLDER_LABELS[f]}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        ref={pagerRef}
        style={styles.pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handlePagerScroll}
        scrollEventThrottle={16}
        contentOffset={{ x: FOLDER_ORDER.indexOf(folder) * width, y: 0 }}>
        {FOLDER_ORDER.map((f) => {
          const pageItems = itemsForFolder(f);
          return (
            <ScrollView
              key={f}
              style={[styles.pagerPage, { width }]}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}>
              {pageItems.length === 0 ? (
                <Text style={styles.emptyText}>Bu bo'limda hali chat yo'q.</Text>
              ) : (
                pageItems.map(renderRow)
              )}
            </ScrollView>
          );
        })}
      </ScrollView>

      <ActivityModal visible={showActivity} onClose={() => setShowActivity(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontFamily: theme.fonts.extraBold, fontSize: 22, color: theme.colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heartBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },

  folderRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  pager: { flex: 1 },
  pagerPage: { flex: 1 },
  folderChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  folderChipActive: { backgroundColor: theme.colors.purple, borderColor: theme.colors.purple },
  folderChipText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.textMuted },
  folderChipTextActive: { color: '#fff' },
  emptyText: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

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
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 48, height: 48 },
  avatarEmoji: { fontSize: 22 },
  info: { flex: 1 },
  name: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text, marginBottom: 3 },
  preview: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted },
  time: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textLight },
});

const rowStyles = StyleSheet.create({
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  shimmerClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  shimmerSweep: { position: 'absolute', top: 0, bottom: 0, width: 140 },
});
