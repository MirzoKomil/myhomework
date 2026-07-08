import { ImageSourcePropType } from 'react-native';

export type LevelKey = 'spark' | 'apprentice' | 'scholar' | 'master' | 'legend';

export type Level = {
  key: LevelKey;
  name: string;
  nameEn: string;
  description: string;
  min: number;
  max: number | null;
  image: ImageSourcePropType;
};

// "O'quvchi o'sishi" — chaqmoq (yig'ilgan, sarflanmaydigan) soniga qarab
// aniqlanadigan akademik daraja tizimi.
export const LEVELS: Level[] = [
  {
    key: 'spark',
    name: 'Uchqun',
    nameEn: 'Spark',
    description: 'Endi boshlaganlar, asosiy bilimlar',
    min: 0,
    max: 100,
    image: require('@/assets/images/levels/spark.png'),
  },
  {
    key: 'apprentice',
    name: 'Shogird',
    nameEn: 'Apprentice',
    description: 'Tizimli o\'qishni boshlaganlar',
    min: 101,
    max: 300,
    image: require('@/assets/images/levels/apprentice.png'),
  },
  {
    key: 'scholar',
    name: 'Bilimdon',
    nameEn: 'Scholar',
    description: 'Mavzularni yaxshi o\'zlashtirganlar',
    min: 301,
    max: 600,
    image: require('@/assets/images/levels/scholar.png'),
  },
  {
    key: 'master',
    name: 'Usta',
    nameEn: 'Master',
    description: 'Tilni bemalol tushunadiganlar',
    min: 601,
    max: 1000,
    image: require('@/assets/images/levels/master.png'),
  },
  {
    key: 'legend',
    name: 'Homework Afsonasi',
    nameEn: 'Legend',
    description: 'Platformaning eng faol va kuchli o\'quvchisi',
    min: 1001,
    max: null,
    image: require('@/assets/images/levels/legend.png'),
  },
];

export function getLevelForLightning(lightning: number): Level {
  return LEVELS.find((l) => lightning >= l.min && (l.max === null || lightning <= l.max)) ?? LEVELS[0];
}

export type LevelProgress = {
  level: Level;
  next: Level | null;
  remaining: number;
  progressPercent: number;
};

export function getLevelProgress(lightning: number): LevelProgress {
  const level = getLevelForLightning(lightning);
  const levelIndex = LEVELS.findIndex((l) => l.key === level.key);
  const next = LEVELS[levelIndex + 1] ?? null;

  if (!next) {
    return { level, next: null, remaining: 0, progressPercent: 100 };
  }

  const remaining = Math.max(0, next.min - lightning);
  const progressPercent = Math.round(((lightning - level.min) / (next.min - level.min)) * 100);
  return { level, next, remaining, progressPercent: Math.min(100, Math.max(0, progressPercent)) };
}
