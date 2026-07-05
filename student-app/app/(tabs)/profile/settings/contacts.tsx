import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { profileStats } from '@/data/mock';

const SUPPORT_EMAIL = 'support@myhomework.uz';

const SOCIALS: { icon: keyof typeof Ionicons.glyphMap; label: string; url: string }[] = [
  { icon: 'paper-plane-outline', label: 'Telegram', url: 'https://t.me/myhomeworkuz' },
  { icon: 'logo-instagram', label: 'Instagram', url: 'https://instagram.com/myhomework.uz' },
  { icon: 'logo-facebook', label: 'Facebook', url: 'https://facebook.com/myhomeworkuz' },
  { icon: 'logo-tiktok', label: 'Tik Tok', url: 'https://tiktok.com/@myhomeworkuz' },
  { icon: 'logo-youtube', label: 'YouTube', url: 'https://youtube.com/@myhomeworkuz' },
];

export default function ContactsScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const submit = () => {
    if (!name.trim() || !message.trim()) return;
    Alert.alert('Rahmat!', "Xabaringiz qabul qilindi, tez orada javob beramiz.");
    setName('');
    setEmail('');
    setMessage('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Kontaktlar" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.group}>
          <Pressable style={[styles.row, styles.rowBorder]} onPress={() => Linking.openURL(`tel:${profileStats.phone}`)}>
            <Ionicons name="call-outline" size={20} color={theme.colors.purple} />
            <Text style={styles.rowLabel}>{profileStats.phone}</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
            <Ionicons name="mail-outline" size={20} color={theme.colors.purple} />
            <Text style={styles.rowLabel}>{SUPPORT_EMAIL}</Text>
          </Pressable>
        </View>

        <View style={styles.group}>
          {SOCIALS.map((s, i) => (
            <Pressable
              key={s.label}
              style={[styles.row, i < SOCIALS.length - 1 && styles.rowBorder]}
              onPress={() => Linking.openURL(s.url)}>
              <Ionicons name={s.icon} size={20} color={theme.colors.purple} />
              <Text style={styles.rowLabel}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.formGroup}>
          <TextInput
            style={styles.input}
            placeholder="Ism"
            placeholderTextColor={theme.colors.textLight}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Elektron pochta"
            placeholderTextColor={theme.colors.textLight}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Message"
            placeholderTextColor={theme.colors.textLight}
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <Pressable style={styles.submitBtn} onPress={submit}>
            <Text style={styles.submitText}>Yuborish</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  group: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    marginBottom: 16,
    ...theme.shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowLabel: { flex: 1, fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.text },
  formGroup: { gap: 12 },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});
