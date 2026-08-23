import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

import { theme } from '@/constants/theme';
import { profileStats } from '@/data/mock';
import { addContentComment, ContentComment, fetchContentComments, fetchDemoStudentProfile } from '@/services/contentApi';

// Har bir foydalanuvchi ismidan avatar rangini va bosh harflarini chiqaradi
// — haqiqiy rasm (avatar) o'quvchilar uchun mavjud emas, shu sabab ism
// asosida barqaror (har doim bir xil ismga bir xil rang/harf) doiraviy
// avatar ko'rsatiladi.
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

type Props = {
  visible: boolean;
  onClose: () => void;
  category: string;
  itemId: string;
  itemLabel: string;
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function CommentRow({
  comment,
  isReply,
  isReplying,
  onTapReply,
  replyValue,
  onChangeReply,
  onSendReply,
}: {
  comment: ContentComment;
  isReply: boolean;
  isReplying: boolean;
  onTapReply: () => void;
  replyValue: string;
  onChangeReply: (v: string) => void;
  onSendReply: () => void;
}) {
  return (
    <View style={[styles.row, isReply && styles.rowReply]}>
      {comment.isAdmin ? (
        <View style={styles.avatarAdmin}>
          <Text style={styles.avatarAdminEmoji}>🛠️</Text>
        </View>
      ) : (
        <View style={[styles.avatarCircle, { backgroundColor: avatarColorFor(comment.authorName) }]}>
          <Text style={styles.avatarInitials}>{initialsOf(comment.authorName)}</Text>
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowText}>
          <Text style={styles.rowAuthor}>{comment.authorName}</Text>
          {comment.isAdmin ? <Text style={styles.rowAdminTag}> · admin</Text> : null}
          {'  '}
          {comment.text}
        </Text>
        <Text style={styles.rowTime}>{timeAgo(comment.createdAt)}</Text>
        <Pressable onPress={onTapReply} hitSlop={6}>
          <Text style={styles.replyLink}>Javob yozish</Text>
        </Pressable>
        {isReplying && (
          <View style={styles.replyInputRow}>
            <TextInput
              style={styles.replyInput}
              value={replyValue}
              onChangeText={onChangeReply}
              placeholder="Javob yozing..."
              placeholderTextColor={theme.colors.textLight}
              onSubmitEditing={onSendReply}
            />
            <Pressable onPress={onSendReply} hitSlop={6}>
              <Ionicons name="send" size={18} color={theme.colors.purple} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

// 145-ish: qayta ishlatiluvchi izohlar oynasi — hozircha faqat radio
// stansiyalari (category='radio') uchun ishlatiladi, lekin `category`/
// `itemId`/`itemLabel` orqali istalgan kontent turiga bog'lanishi mumkin.
export function CommentsSheet({ visible, onClose, category, itemId, itemLabel }: Props) {
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  // Ilgari bu doim hardcode qilingan namuna ismi (profileStats.name =
  // "Shahzoda Mavlonova") bilan yuborilardi — har bir o'quvchining izohi
  // bir xil ism bilan chiqardi. Endi haqiqiy (CRM'da tanlangan yoki real
  // login qilgan) o'quvchining o'z ismi yuklanadi.
  const [authorName, setAuthorName] = useState(profileStats.name);
  useEffect(() => {
    fetchDemoStudentProfile()
      .then((p) => { if (p?.name) setAuthorName(p.name); })
      .catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    fetchContentComments(category, itemId)
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (visible) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, category, itemId]);

  const topLevel = [...comments]
    .filter((c) => !c.parentId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const repliesByParent: Record<string, ContentComment[]> = {};
  comments
    .filter((c) => c.parentId)
    .forEach((c) => {
      const key = c.parentId as string;
      if (!repliesByParent[key]) repliesByParent[key] = [];
      repliesByParent[key].push(c);
    });

  const submitTopLevel = () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    addContentComment(category, itemId, itemLabel, authorName, trimmed)
      .then(() => {
        setText('');
        load();
      })
      .catch(() => {})
      .finally(() => setSubmitting(false));
  };

  const submitReply = (parentId: string) => {
    const trimmed = replyText.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    addContentComment(category, itemId, itemLabel, authorName, trimmed, parentId)
      .then(() => {
        setReplyText('');
        setReplyingTo(null);
        load();
      })
      .catch(() => {})
      .finally(() => setSubmitting(false));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdropTap} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Izohlar</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {loading ? (
              <ActivityIndicator color={theme.colors.purple} style={{ marginTop: 24 }} />
            ) : topLevel.length === 0 ? (
              <Text style={styles.empty}>Hali izoh yo'q — birinchi bo'lib yozing!</Text>
            ) : (
              topLevel.map((c) => (
                <View key={c.id}>
                  <CommentRow
                    comment={c}
                    isReply={false}
                    isReplying={replyingTo === c.id}
                    onTapReply={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                    replyValue={replyText}
                    onChangeReply={setReplyText}
                    onSendReply={() => submitReply(c.id)}
                  />
                  {(repliesByParent[c.id] || []).map((r) => (
                    <CommentRow
                      key={r.id}
                      comment={r}
                      isReply
                      isReplying={replyingTo === r.id}
                      onTapReply={() => setReplyingTo(replyingTo === r.id ? null : r.id)}
                      replyValue={replyText}
                      onChangeReply={setReplyText}
                      onSendReply={() => submitReply(r.id)}
                    />
                  ))}
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Izoh yozing..."
              placeholderTextColor={theme.colors.textLight}
              onSubmitEditing={submitTopLevel}
            />
            <Pressable onPress={submitTopLevel} disabled={submitting} hitSlop={8}>
              <Ionicons name="send" size={22} color={theme.colors.purple} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  backdropTap: { flex: 1 },
  sheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    maxHeight: '75%',
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: { fontFamily: theme.fonts.extraBold, fontSize: 16, color: theme.colors.text },
  // 17-vazifa: ScrollView'ga flex berilmagani sabab u butun ro'yxat
  // balandligicha cho'zilib, sarlavha/yozish qatori bilan birga pastga
  // surilib ketardi — endi faqat shu ro'yxat o'zi (sheet'ning maxHeight'i
  // ichida) skrol bo'ladi, sarlavha va pastki yozish qatori joyida qotadi.
  list: { flex: 1, paddingHorizontal: 20 },
  listContent: { paddingVertical: 12, gap: 14 },
  empty: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 24 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  rowReply: { marginLeft: 28, marginTop: 4, marginBottom: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarInitials: { fontFamily: theme.fonts.bold, fontSize: 11, color: '#fff' },
  avatarAdmin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: theme.colors.purpleLight,
  },
  avatarAdminEmoji: { fontSize: 14 },
  rowBody: { flex: 1 },
  rowText: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.text, lineHeight: 19 },
  rowAuthor: { fontFamily: theme.fonts.bold },
  rowAdminTag: { fontFamily: theme.fonts.semiBold, color: theme.colors.purple, fontSize: 11 },
  rowTime: { fontFamily: theme.fonts.regular, fontSize: 10, color: theme.colors.textLight, marginTop: 2 },
  replyLink: { fontFamily: theme.fonts.semiBold, fontSize: 11, color: theme.colors.purple, marginTop: 4 },
  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  replyInput: { flex: 1, fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.text, paddingVertical: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  input: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
