import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Sozlamalar" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <SettingRow icon="notifications" label="Bildirishnomalar" toggle defaultValue />
          <SettingRow icon="volume-high" label="Ovoz effektlari" toggle defaultValue />
          <SettingRow icon="moon" label="Qorong'u rejim" toggle />
          <SettingRow icon="language" label="Til" value="O'zbek" />
          <SettingRow icon="shield-checkmark" label="Maxfiylik" chevron />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({
  icon,
  label,
  value,
  toggle,
  defaultValue,
  chevron,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  toggle?: boolean;
  defaultValue?: boolean;
  chevron?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={theme.colors.purple} />
      <Text style={styles.label}>{label}</Text>
      {toggle && <Switch value={defaultValue} trackColor={{ true: theme.colors.purple }} />}
      {value && <Text style={styles.value}>{value}</Text>}
      {chevron && <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  label: { flex: 1, fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.text },
  value: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted },
});
