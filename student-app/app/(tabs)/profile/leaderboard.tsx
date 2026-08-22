import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { CoinIcon } from '@/components/ui/CoinIcon';
import { CoinInfoModal } from '@/components/ui/CoinInfoModal';
import { LightningInfoModal } from '@/components/ui/LightningInfoModal';
import { LightningIcon, LightningPill } from '@/components/ui/LightningIcon';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { fetchLeaderboard, LeaderboardEntryResponse, LeaderboardPeriod, sendDemoPeerMessage } from '@/services/contentApi';
import { useAvatarUri } from '@/services/avatarStore';
import { useCoins } from '@/services/coinsStore';
import { checkLeaderboardClimb } from '@/services/leaderboardTracker';
import { useLightning } from '@/services/lightningStore';

// 12-vazifa: o'quvchining o'zi qo'ygan haqiqiy rasmi (avatarUrl) bo'lmasa,
// hammaga bir xil 🙂 emoji o'rniga ism asosida barqaror rang/bosh
// harflardan iborat shaxsiy avatar ko'rsatiladi (CommentsSheet'dagi bilan
// bir xil naqsh).
const AVATAR_COLORS = ['#7B61FF', '#2563EB', '#DB2777', '#059669', '#D97706', '#DC2626', '#0EA5E9', '#9333EA'];
function avatarColorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0]).join('');
  return (initials || '?').toUpperCase();
}

function EntryAvatar({
  entry,
  myAvatarUri,
  size,
  fontSize,
}: {
  entry: LeaderboardEntryResponse;
  myAvatarUri: string | null;
  size: number;
  fontSize: number;
}) {
  const uri = entry.isMe && myAvatarUri ? myAvatarUri : entry.avatarUrl;
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />;
  }
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: avatarColorFor(entry.name), alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ fontFamily: theme.fonts.bold, fontSize, color: '#fff' }}>{initialsOf(entry.name)}</Text>
    </View>
  );
}

// 12-vazifa: reytingdagi o'quvchi ustiga bosilganda uning HAQIQIY ma'lumoti
// (nom, o'rin, chaqmoq/tanga, yakunlangan darslar) ko'rsatiladi, o'zi
// bo'lmasa — haqiqiy, serverda saqlanadigan xabar yozish imkoni bilan
// (sendDemoPeerMessage — CRM "Maqsaddoshlar" bo'limida ko'rinadi).
function StudentInfoModal({ entry, onClose }: { entry: LeaderboardEntryResponse | null; onClose: () => void }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const myAvatarUri = useAvatarUri();

  const handleClose = () => {
    setText('');
    setSent(false);
    onClose();
  };

  const send = () => {
    if (!entry || !text.trim() || sending) return;
    setSending(true);
    sendDemoPeerMessage(entry.id, entry.name, text.trim())
      .then(() => {
        setText('');
        setSent(true);
      })
      .catch(() => {})
      .finally(() => setSending(false));
  };

  return (
    <Modal visible={entry !== null} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.infoBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.modalBackdropTap} onPress={handleClose} />
        {entry && (
          <View style={styles.infoSheet}>
            <View style={styles.infoHandle} />
            <View style={styles.infoHeaderRow}>
              <View style={styles.infoAvatar}>
                <EntryAvatar entry={entry} myAvatarUri={myAvatarUri} size={56} fontSize={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoName}>{entry.name}</Text>
                <Text style={styles.infoRank}>#{entry.rank} o'rin</Text>
              </View>
            </View>

            <View style={styles.infoStatsRow}>
              <View style={styles.infoStatCard}>
                <LightningIcon size={16} />
                <Text style={styles.infoStatValue}>{entry.lightning.toLocaleString('uz-UZ')}</Text>
                <Text style={styles.infoStatLabel}>Chaqmoq</Text>
              </View>
              <View style={styles.infoStatCard}>
                <CoinIcon size={14} />
                <Text style={styles.infoStatValue}>{entry.coins.toLocaleString('uz-UZ')}</Text>
                <Text style={styles.infoStatLabel}>Tanga</Text>
              </View>
              <View style={styles.infoStatCard}>
                <Ionicons name="book-outline" size={16} color={theme.colors.purple} />
                <Text style={styles.infoStatValue}>{entry.lessonsCompleted}</Text>
                <Text style={styles.infoStatLabel}>Dars</Text>
              </View>
            </View>

            {!entry.isMe && (
              <>
                <Text style={styles.infoSectionTitle}>Xabar yozish</Text>
                {sent && <Text style={styles.infoSentText}>Xabar yuborildi ✓</Text>}
                <View style={styles.infoComposeRow}>
                  <TextInput
                    style={styles.infoComposeInput}
                    value={text}
                    onChangeText={setText}
                    placeholder={`${entry.name}ga xabar yozing...`}
                    placeholderTextColor={theme.colors.textLight}
                    onSubmitEditing={send}
                  />
                  <Pressable onPress={send} disabled={sending || !text.trim()} hitSlop={8}>
                    <Ionicons name="send" size={22} color={sending || !text.trim() ? theme.colors.textLight : theme.colors.purple} />
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// 36-vazifa: Leaderboard ilgari to'liq o'ylab topilgan (fake) o'quvchilar
// ro'yxati edi (davr/hudud bo'yicha sun'iy ko'paytirilgan). Endi FAQAT
// haqiqiy o'quvchilarning haqiqiy tanga/chaqmoq yig'indisidan tuziladi.
// Hudud (O'zbekiston/Viloyat) o'quvchining CRM'dagi haqiqiy "region"
// maydoniga qarab ishlaydi.
// 37-vazifa: Kunlik/Haftalik/Oylik davr tanlovi ham qaytarildi — endi har
// bir kunda to'plangan tanga/chaqmoq alohida (serverda) saqlanadi, shu
// sabab bu davrlar ham haqiqiy hisoblanadi.
type Scope = 'region' | 'country';
const SCOPE_LABELS: Record<Scope, string> = { region: "O'z viloyati", country: "O'zbekiston" };
const PERIODS: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'alltime'];
const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  daily: 'Kunlik',
  weekly: 'Haftalik',
  monthly: 'Oylik',
  alltime: 'Doimiy',
};

const PODIUM_COLORS = ['#C0C6D8', '#F2C14E', '#E2A76F'];

export default function LeaderboardScreen() {
  const coins = useCoins();
  const lightning = useLightning();
  const myAvatarUri = useAvatarUri();
  const [scope, setScope] = useState<Scope>('country');
  const [period, setPeriod] = useState<LeaderboardPeriod>('alltime');
  const [entries, setEntries] = useState<LeaderboardEntryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCoinInfo, setShowCoinInfo] = useState(false);
  const [showLightningInfo, setShowLightningInfo] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<'period' | 'scope' | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntryResponse | null>(null);

  const load = useCallback((s: Scope, p: LeaderboardPeriod) => {
    setLoading(true);
    fetchLeaderboard(s, p)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(scope, period);
    }, [load, scope, period])
  );

  // 142-ish qayta ish 8: reyting o'rni ko'tarilishini faqat standart
  // ko'rinishda (alltime/country) kuzatamiz — aks holda foydalanuvchi
  // filtr almashtirganda soxta "ko'tarildingiz" signali chiqadi.
  useEffect(() => {
    const me = entries.find((e) => e.isMe);
    if (scope === 'country' && period === 'alltime' && me) checkLeaderboardClimb(me.rank);
  }, [entries, scope, period]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  const rank1Shimmer = useRef(new Animated.Value(0)).current;
  const rank2Shimmer = useRef(new Animated.Value(0)).current;
  const rank3Shimmer = useRef(new Animated.Value(0)).current;
  const crownWobble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(rank1Shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(rank1Shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(400),
        Animated.timing(rank2Shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(rank2Shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(400),
        Animated.timing(rank3Shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(rank3Shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(400),
      ])
    );
    shimmerLoop.start();
    const wobbleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(crownWobble, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(crownWobble, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    wobbleLoop.start();
    return () => {
      shimmerLoop.stop();
      wobbleLoop.stop();
    };
  }, [rank1Shimmer, rank2Shimmer, rank3Shimmer, crownWobble]);

  const podiumShimmerByIndex = [rank2Shimmer, rank1Shimmer, rank3Shimmer];
  const shimmerTranslate = (anim: Animated.Value) => anim.interpolate({ inputRange: [0, 1], outputRange: [-70, 70] });
  const crownTranslateX = crownWobble.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -2, 0, 2, 0] });
  const crownTranslateY = crownWobble.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -2, 0, 2, 0] });
  const crownRotate = crownWobble.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['0deg', '-8deg', '0deg', '8deg', '0deg'] });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Leaderboard"
        showBack
        rightAction={
          <View style={styles.headerPillRow}>
            <Pressable style={styles.coinPill} onPress={() => setShowCoinInfo(true)}>
              <CoinIcon size={12} />
              <Text style={styles.coinText}>{coins}</Text>
            </Pressable>
            <Pressable onPress={() => setShowLightningInfo(true)}>
              <LightningPill amount={lightning} size={12} />
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.filterRow}>
          <Pressable style={styles.dropdownBtn} onPress={() => setActiveDropdown('period')}>
            <Ionicons name="calendar-outline" size={15} color={theme.colors.purple} />
            <Text style={styles.dropdownBtnText}>{PERIOD_LABELS[period]}</Text>
            <Ionicons name="chevron-down" size={15} color={theme.colors.textMuted} />
          </Pressable>
          <Pressable style={styles.dropdownBtn} onPress={() => setActiveDropdown('scope')}>
            <Ionicons name="location-outline" size={15} color={theme.colors.purple} />
            <Text style={styles.dropdownBtnText}>{SCOPE_LABELS[scope]}</Text>
            <Ionicons name="chevron-down" size={15} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        {!loading && entries.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>🏆</Text>
            <Text style={styles.emptyText}>
              Hali reytingda hech kim yo'q. Darslarni davom ettirib, birinchi bo'lib chaqmoq to'plang!
            </Text>
          </View>
        )}

        {entries.length > 0 && (
          <>
            <View style={styles.podiumRow}>
              {/* order visually as 2nd, 1st, 3rd */}
              {[top3[1], top3[0], top3[2]].map((entry, i) =>
                entry ? (
                  <Pressable
                    key={entry.id}
                    style={[styles.podiumCol, i === 1 && styles.podiumColCenter]}
                    onPress={() => setSelectedEntry(entry)}>
                    {i === 1 && (
                      <Animated.Text
                        style={[
                          styles.crown,
                          { transform: [{ translateX: crownTranslateX }, { translateY: crownTranslateY }, { rotate: crownRotate }] },
                        ]}>
                        👑
                      </Animated.Text>
                    )}
                    <View
                      style={[
                        styles.podiumAvatar,
                        { backgroundColor: PODIUM_COLORS[i === 1 ? 0 : i === 0 ? 1 : 2] },
                        i === 1 && styles.podiumAvatarCenter,
                      ]}>
                      <EntryAvatar entry={entry} myAvatarUri={myAvatarUri} size={i === 1 ? 72 : 56} fontSize={i === 1 ? 24 : 18} />
                      <View style={styles.podiumShimmerClip} pointerEvents="none">
                        <Animated.View
                          style={[
                            styles.podiumShimmerSweep,
                            { transform: [{ translateX: shimmerTranslate(podiumShimmerByIndex[i]) }, { rotate: '20deg' }] },
                          ]}>
                          <LinearGradient
                            colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={StyleSheet.absoluteFill}
                          />
                        </Animated.View>
                      </View>
                    </View>
                    <View style={[styles.podiumRankBadge, { backgroundColor: PODIUM_COLORS[i] }]}>
                      <Text style={styles.podiumRankText}>{entry.rank}</Text>
                    </View>
                    <Text style={styles.podiumName}>{entry.name}</Text>
                    <View style={styles.podiumXpPill}>
                      <LightningIcon size={11} />
                      <Text style={styles.podiumXpText}>{entry.lightning.toLocaleString('uz-UZ')}</Text>
                    </View>
                    <View style={styles.podiumCoinRow}>
                      <CoinIcon size={9} />
                      <Text style={styles.podiumCoinText}>{entry.coins.toLocaleString('uz-UZ')}</Text>
                    </View>
                  </Pressable>
                ) : (
                  <View key={`empty-${i}`} style={styles.podiumCol} />
                )
              )}
            </View>

            <View style={styles.list}>
              {rest.map((entry) => (
                <Pressable
                  key={entry.id}
                  style={[styles.listRow, entry.isMe && styles.listRowMe]}
                  onPress={() => setSelectedEntry(entry)}>
                  <Text style={[styles.listRank, entry.isMe && styles.listRankMe]}>{entry.rank}</Text>
                  <View style={styles.listAvatar}>
                    <EntryAvatar entry={entry} myAvatarUri={myAvatarUri} size={40} fontSize={14} />
                  </View>
                  <View style={styles.listInfo}>
                    <Text style={[styles.listName, entry.isMe && styles.listNameMe]}>{entry.name}</Text>
                    <Text style={styles.listMeta}>{entry.lessonsCompleted} dars yakunlandi</Text>
                  </View>
                  <View style={styles.listXpCol}>
                    <View style={styles.listXpRow}>
                      <LightningIcon size={12} />
                      <Text style={styles.listXp}>{entry.lightning.toLocaleString('uz-UZ')}</Text>
                    </View>
                    <View style={styles.listXpRow}>
                      <CoinIcon size={10} />
                      <Text style={styles.listCoin}>{entry.coins.toLocaleString('uz-UZ')}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <CoinInfoModal visible={showCoinInfo} onClose={() => setShowCoinInfo(false)} />
      <LightningInfoModal visible={showLightningInfo} onClose={() => setShowLightningInfo(false)} />
      <StudentInfoModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />

      <Modal visible={activeDropdown !== null} transparent animationType="fade" onRequestClose={() => setActiveDropdown(null)}>
        <Pressable style={styles.dropdownBackdrop} onPress={() => setActiveDropdown(null)}>
          <Pressable style={styles.dropdownSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.dropdownSheetTitle}>{activeDropdown === 'period' ? 'Davr' : 'Hudud'}</Text>
            {(activeDropdown === 'period' ? PERIODS : (['country', 'region'] as Scope[])).map((opt) => {
              const label = activeDropdown === 'period' ? PERIOD_LABELS[opt as LeaderboardPeriod] : SCOPE_LABELS[opt as Scope];
              const selected = activeDropdown === 'period' ? period === opt : scope === opt;
              return (
                <Pressable
                  key={opt}
                  style={styles.dropdownOption}
                  onPress={() => {
                    if (activeDropdown === 'period') setPeriod(opt as LeaderboardPeriod);
                    else setScope(opt as Scope);
                    setActiveDropdown(null);
                  }}>
                  <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionTextActive]}>{label}</Text>
                  {selected && <Ionicons name="checkmark" size={18} color={theme.colors.purple} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingTop: 8, paddingBottom: 32 },
  headerPillRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.warningBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  coinEmoji: { fontSize: 14 },
  coinText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#B45309' },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  dropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dropdownBtnText: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.text },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24, gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20 },

  dropdownBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  dropdownSheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  dropdownSheetTitle: { fontFamily: theme.fonts.extraBold, fontSize: 17, color: theme.colors.text, marginBottom: 10 },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dropdownOptionText: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted },
  dropdownOptionTextActive: { fontFamily: theme.fonts.bold, color: theme.colors.purple },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
    marginBottom: 20,
  },
  podiumCol: { alignItems: 'center', flex: 1 },
  podiumColCenter: { marginBottom: 16 },
  crown: { fontSize: 20, marginBottom: 2 },
  podiumAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },
  podiumAvatarCenter: { width: 72, height: 72, borderRadius: 36 },
  podiumShimmerClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  podiumShimmerSweep: { position: 'absolute', top: -20, bottom: -20, width: 30 },
  podiumRankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -14,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: theme.colors.bg,
  },
  podiumRankText: { fontFamily: theme.fonts.extraBold, fontSize: 11, color: '#fff' },
  podiumName: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.text, marginBottom: 4 },
  podiumXpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  podiumXpText: { fontFamily: theme.fonts.semiBold, fontSize: 11, color: theme.colors.text },
  podiumCoinRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  podiumCoinText: { fontFamily: theme.fonts.medium, fontSize: 10, color: theme.colors.textMuted },
  list: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  listRowMe: { backgroundColor: theme.colors.purpleLight },
  listRank: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.textMuted, width: 20 },
  listRankMe: { color: theme.colors.purple },
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  listInfo: { flex: 1 },
  listName: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text },
  listNameMe: { color: theme.colors.purple },
  listMeta: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  listXpCol: { alignItems: 'flex-end', gap: 3 },
  listXpRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listXp: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.text },
  listCoin: { fontFamily: theme.fonts.medium, fontSize: 11, color: theme.colors.textMuted },

  infoBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBackdropTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  infoSheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  infoHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 14 },
  infoHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  infoAvatar: { width: 56, height: 56, borderRadius: 18, overflow: 'hidden' },
  infoName: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text },
  infoRank: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  infoStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  infoStatCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    ...theme.shadow.card,
  },
  infoStatValue: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.text },
  infoStatLabel: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textMuted },
  infoSectionTitle: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.textMuted, marginBottom: 8 },
  infoSentText: { fontFamily: theme.fonts.medium, fontSize: 12, color: theme.colors.success, marginBottom: 8 },
  infoComposeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  infoComposeInput: { flex: 1, fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.text },
});
