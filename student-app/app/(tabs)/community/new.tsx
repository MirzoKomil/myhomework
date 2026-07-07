import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { addPost, useMyIdentity } from '@/services/communityStore';

export default function NewPostScreen() {
  const { name, avatarUri } = useMyIdentity();
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = text.trim().length > 0 || !!imageUri;

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    setImageUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    await addPost(text.trim(), name, '🙂', imageUri);
    setSubmitting(false);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={26} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.topTitle}>Yangi post</Text>
          <Pressable
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            disabled={!canSubmit || submitting}
            onPress={handleSubmit}>
            <Text style={styles.submitBtnText}>Yuborish</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={20} color={theme.colors.purple} />
              )}
            </View>
            <View>
              <Text style={styles.authorName}>{name}</Text>
              <Text style={styles.authorSub}>Hamjamiyat: 🇬🇧 Ingliz tili</Text>
            </View>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Yozing..."
            placeholderTextColor={theme.colors.textLight}
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
          />

          {imageUri && (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <Pressable style={styles.removeImageBtn} onPress={() => setImageUri(null)} hitSlop={8}>
                <Ionicons name="close" size={16} color="#fff" />
              </Pressable>
            </View>
          )}
        </ScrollView>

        <View style={styles.toolbar}>
          <Pressable style={styles.toolBtn} onPress={pickImage}>
            <Ionicons name="image-outline" size={22} color={theme.colors.purple} />
          </Pressable>
          <Pressable style={styles.toolBtn} onPress={pickImage}>
            <Ionicons name="camera-outline" size={22} color={theme.colors.purple} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  topTitle: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text },
  submitBtn: { backgroundColor: theme.colors.purple, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18 },
  submitBtnDisabled: { backgroundColor: theme.colors.purpleLight },
  submitBtnText: { fontFamily: theme.fonts.bold, fontSize: 13, color: '#fff' },

  scroll: { padding: 20, flexGrow: 1 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 40, height: 40 },
  authorName: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.text },
  authorSub: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },

  input: { fontFamily: theme.fonts.regular, fontSize: 16, color: theme.colors.text, minHeight: 120, textAlignVertical: 'top' },

  imagePreviewWrap: { marginTop: 14, alignSelf: 'flex-start' },
  imagePreview: { width: 160, height: 160, borderRadius: theme.radius.sm },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  toolbar: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  toolBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
