import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { AdminModuleContent, fetchMobileContent } from '@/services/contentApi';

function ytId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function VideoBlock({ content }: { content: AdminModuleContent }) {
  const vid = ytId(content.url ?? '');
  if (Platform.OS === 'web' && vid) {
    return (
      <View style={bs.block}>
        <View style={bs.videoWrap}>
          {/* @ts-ignore — web only iframe */}
          <iframe
            src={`https://www.youtube.com/embed/${vid}`}
            style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 }}
            allowFullScreen
          />
        </View>
        {content.name ? <Text style={bs.blockTitle}>{content.name}</Text> : null}
      </View>
    );
  }
  return (
    <TouchableOpacity style={bs.block} onPress={() => content.url && Linking.openURL(content.url)}>
      <View style={[bs.linkRow, { backgroundColor: '#EDE9FE' }]}>
        <View style={bs.linkIcon}>
          <Ionicons name="play-circle" size={28} color={theme.colors.purple} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={bs.linkTitle}>{content.name || 'Video dars'}</Text>
          <Text style={bs.linkUrl} numberOfLines={1}>{content.url}</Text>
        </View>
        <Ionicons name="open-outline" size={18} color={theme.colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

function FileBlock({ content, icon, bg, color }: { content: AdminModuleContent; icon: keyof typeof Ionicons.glyphMap; bg: string; color: string }) {
  return (
    <TouchableOpacity style={bs.block} onPress={() => content.url && Linking.openURL(content.url)}>
      <View style={[bs.linkRow, { backgroundColor: bg }]}>
        <View style={bs.linkIcon}>
          <Ionicons name={icon} size={26} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={bs.linkTitle}>{content.name || 'Fayl'}</Text>
          <Text style={bs.linkUrl} numberOfLines={1}>{content.url}</Text>
        </View>
        <Ionicons name="open-outline" size={18} color={theme.colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

function TextBlock({ content }: { content: AdminModuleContent }) {
  return (
    <View style={bs.block}>
      <View style={bs.textHeader}>
        <Ionicons name="document-text-outline" size={18} color={theme.colors.textMuted} />
        <Text style={bs.textHeaderLabel}>Matn</Text>
      </View>
      <Text style={bs.textBody}>{content.text ?? ''}</Text>
    </View>
  );
}

function ContentBlock({ content }: { content: AdminModuleContent }) {
  if (content.type === 'video') return <VideoBlock content={content} />;
  if (content.type === 'pdf') return <FileBlock content={content} icon="document-text" bg="#ffe4e6" color="#e11d48" />;
  if (content.type === 'word') return <FileBlock content={content} icon="document" bg="#dbeafe" color="#2563eb" />;
  if (content.type === 'image') return <FileBlock content={content} icon="image" bg="#fef3c7" color="#d97706" />;
  if (content.type === 'text') return <TextBlock content={content} />;
  return null;
}

export default function ModuleContentScreen() {
  const { lessonId, moduleId } = useLocalSearchParams<{ lessonId: string; moduleId: string }>();
  const [modName, setModName] = useState('');
  const [contents, setContents] = useState<AdminModuleContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMobileContent().then((mc) => {
      const mod = mc.modules.find((m) => m.id === moduleId);
      setModName(mod?.name ?? 'Modul');
      setContents(mc.moduleContents.filter((c) => c.moduleId === moduleId));
    }).finally(() => setLoading(false));
  }, [moduleId]);

  return (
    <SafeAreaView style={bs.safe} edges={['top']}>
      <ScreenHeader title={modName || 'Modul'} showBack />
      <ScrollView contentContainerStyle={bs.scroll} showsVerticalScrollIndicator={false}>
        {loading && (
          <View style={bs.center}>
            <ActivityIndicator size="large" color={theme.colors.purple} />
          </View>
        )}

        {!loading && contents.length === 0 && (
          <View style={bs.center}>
            <Ionicons name="file-tray-outline" size={44} color={theme.colors.textMuted} />
            <Text style={bs.emptyText}>Hali kontent qo'shilmagan</Text>
          </View>
        )}

        {contents.map((c) => (
          <ContentBlock key={c.id} content={c} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const bs = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 16, paddingBottom: 48, gap: 14 },
  center: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted },

  block: { borderRadius: 14, overflow: 'hidden', backgroundColor: theme.colors.surface, ...theme.shadow?.card },

  videoWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderRadius: 14,
  },
  linkIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTitle: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text, marginBottom: 2 },
  linkUrl: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted },

  textHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 14, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  textHeaderLabel: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.textMuted },
  textBody: { fontFamily: theme.fonts.regular, fontSize: 15, color: theme.colors.text, lineHeight: 24, padding: 14, paddingTop: 10 },

  blockTitle: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text, padding: 10 },
});
