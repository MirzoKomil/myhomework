import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import { useAuth } from '@/services/studentAuthStore';
import { cancelTelegramLink, confirmTelegramLink, createTelegramLink, telegramLinkStatus, TelegramLinkStatus } from '@/services/telegramLinkApi';

export default function TelegramScreen() {
  const { student, token } = useAuth();
  const { lang } = useLang();
  const ru = lang === 'ru';
  const [status, setStatus] = useState<TelegramLinkStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const active = useRef(true), locked = useRef(false), generation = useRef(0);
  const allowed = !!token && student?.lang === 'russian';
  const load = useCallback(async () => {
    const current = generation.current;
    const result = await telegramLinkStatus();
    if (active.current && current === generation.current) setStatus(result);
  }, []);
  const run = useCallback(async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await action(); } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Telegram ulanishida xatolik'); }
    finally { locked.current = false; if (active.current) setBusy(false); }
  }, []);
  useEffect(() => {
    active.current = true; generation.current += 1; setStatus(null); setUrl(''); setError('');
    if (allowed) void run(load);
    const subscription = AppState.addEventListener('change', value => { if (value === 'active' && allowed) void run(load); });
    return () => { active.current = false; generation.current += 1; subscription.remove(); };
  }, [allowed, student?.id, token, load, run]);
  const pending = status?.request;
  const live = pending && !pending.expired && ['pending', 'claimed'].includes(pending.state);
  const button = (label: string, action: () => Promise<void>, secondary = false) => (
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(action)}
      style={[styles.button, secondary && styles.secondary, busy && styles.disabled]}>
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <ScreenHeader title={ru ? 'Подключить Telegram-бота' : 'Telegram botga ulash'} showBack />
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card><Ionicons name="paper-plane" size={36} color={theme.colors.blue} />
        <Text style={styles.title}>@Domworkuz_bot</Text>
        <Text style={styles.text}>{ru ? 'Номера в CRM и Telegram могут отличаться. Номер телефона, результаты и платежи в CRM не изменятся.' : 'CRM va Telegram raqamlaringiz boshqa bo‘lishi mumkin. CRMdagi telefon raqami, natijalar va to‘lovlar o‘zgarmaydi.'}</Text>
        <Text style={styles.text}>{ru ? '1. Откройте бота по кнопке и нажмите Start.\n2. Вернитесь в это окно и проверьте статус.\n3. Проверьте свой Telegram-аккаунт и подтвердите.' : '1. Tugma orqali botni ochib, Start bosing.\n2. Shu oynaga qaytib, holatni tekshiring.\n3. O‘z Telegram hisobingiz ekanini tekshirib, tasdiqlang.'}</Text>
      </Card>
      {busy && <ActivityIndicator accessibilityLabel="Tekshirilmoqda" color={theme.colors.purple} />}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!allowed ? <Card><Text style={styles.text}>{ru ? 'Войдите в свой активный аккаунт ученика русского языка.' : 'O‘zingizning faol rus tili o‘quvchi akkauntingiz bilan kiring.'}</Text>
        {!token && button(ru ? 'Войти' : 'Tizimga kirish', async () => { router.push('/login' as never); })}</Card> :
        status?.linked ? <Card><Text style={styles.title}>{ru ? 'Telegram подключён' : 'Telegram ulangan'}</Text>
          <Text style={styles.text}>{ru ? 'Меню ученика доступно в боте. Для замены существующей привязки обратитесь к администратору.' : 'Botda o‘quvchi menyusi ochiladi. Mavjud bog‘lanishni almashtirish uchun admin bilan bog‘laning.'}</Text>
          {button(ru ? 'Открыть бота' : 'Botni ochish', async () => { await Linking.openURL('https://t.me/Domworkuz_bot'); })}</Card> : <Card>
          {live ? <>
            <Text style={styles.text}>{ru ? 'Ссылка одноразовая и действует 5 минут.' : 'Havola bir martalik, 5 daqiqa amal qiladi.'}</Text>
            {pending?.state === 'claimed' && pending.telegram ? <>
              <Text style={styles.title}>{pending.telegram.name || 'Telegram'}</Text>
              {!!pending.telegram.username && <Text style={styles.text}>@{pending.telegram.username}</Text>}
              <Text style={styles.text}>Telegram ID: {pending.telegram.id}</Text>
              <Text style={styles.text}>{ru ? 'Подтверждайте только свой аккаунт. Если это не вы — отмените запрос.' : 'Faqat o‘z hisobingiz bo‘lsa tasdiqlang. Bu siz bo‘lmasangiz, so‘rovni bekor qiling.'}</Text>
              {button(ru ? 'Да, это мой Telegram — подтвердить' : 'Ha, bu mening Telegramim — tasdiqlash', async () => { await confirmTelegramLink(pending); setUrl(''); await load(); })}
            </> : <Text style={styles.text}>{ru ? 'Ожидается Start в Telegram. Затем вернитесь сюда.' : 'Telegramda Start bosilishi kutilmoqda. Keyin shu oynaga qayting.'}</Text>}
            {!!url && button(ru ? 'Открыть ссылку в Telegram' : 'Ulash havolasini Telegramda ochish', async () => { await Linking.openURL(url); })}
            {button(ru ? 'Отменить запрос' : 'So‘rovni bekor qilish', async () => { if (pending) await cancelTelegramLink(pending); setUrl(''); await load(); }, true)}
          </> : <>
            {!!pending?.expired && <Text style={styles.text}>{ru ? 'Срок ссылки истёк. Создайте новую.' : 'Havola muddati tugagan. Yangi havola oling.'}</Text>}
            {button(ru ? 'Получить ссылку для подключения' : 'Telegram botga ulash', async () => {
              const result = await createTelegramLink(); setUrl(result.url); await load();
            })}
          </>}
          {button(ru ? 'Проверить статус' : 'Holatni tekshirish', load, true)}
        </Card>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg }, scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontFamily: theme.fonts.bold, fontSize: 18, color: theme.colors.text, marginVertical: 8 },
  text: { fontFamily: theme.fonts.regular, fontSize: 14, lineHeight: 22, color: theme.colors.textMuted, marginBottom: 12 },
  button: { backgroundColor: theme.colors.purple, borderRadius: 14, minHeight: 48, padding: 14, marginTop: 10, justifyContent: 'center' },
  buttonText: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: '#fff', textAlign: 'center' },
  secondary: { backgroundColor: theme.colors.purpleLight }, secondaryText: { color: theme.colors.purple }, disabled: { opacity: 0.5 },
  error: { fontFamily: theme.fonts.medium, fontSize: 14, color: '#B42318' },
});
