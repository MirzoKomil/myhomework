import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { SkillProgress } from '@/data/mock';

const BAR_HEIGHT = 110;

type SkillBarsProps = {
  skills: SkillProgress[];
};

const GRADIENTS: Record<SkillProgress['key'], [string, string]> = {
  vocabulary: ['#9B7BFF', '#6B4FE0'],
  speaking: ['#6FA8FF', '#4F8CFF'],
  listening: ['#FB92C6', '#F472B6'],
  grammar: ['#FFCE6B', '#FBBF24'],
  writing: ['#5EE6B0', '#34D399'],
};

export function SkillBars({ skills }: SkillBarsProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {skills.map((skill) => (
          <View key={skill.key} style={styles.col}>
            <Text style={styles.percent}>{skill.progress}%</Text>
            <View style={styles.track}>
              <LinearGradient
                colors={GRADIENTS[skill.key]}
                start={{ x: 0, y: 1 }}
                end={{ x: 0, y: 0 }}
                style={[styles.fill, { height: `${Math.max(6, skill.progress)}%` }]}
              />
            </View>
            <Ionicons name={skill.icon} size={15} color={theme.colors.textMuted} style={styles.icon} />
            <Text style={styles.label}>{skill.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 20,
    marginBottom: 28,
    ...theme.shadow.card,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  col: { alignItems: 'center', flex: 1 },
  percent: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.text, marginBottom: 6 },
  track: {
    width: 22,
    height: BAR_HEIGHT,
    borderRadius: 11,
    backgroundColor: theme.colors.bg,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: { width: '100%', borderRadius: 11 },
  icon: { marginTop: 10, marginBottom: 4 },
  label: { fontFamily: theme.fonts.medium, fontSize: 10, color: theme.colors.textMuted, textAlign: 'center' },
});
