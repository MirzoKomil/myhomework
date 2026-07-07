import { TEACHER_PROFILES } from '@/data/teacherProfiles';

export type StudentGender = 'male' | 'female';

export type StudentProfile = {
  id: string;
  name: string;
  avatarEmoji: string;
  gender: StudentGender;
  courseStartDate: string;
  mainTeacher: string;
  assistantTeacher: string;
  videoTeacher: string;
  overallProgress: number;
  attendanceRate: number;
  avgGrade: number;
  lessonsCompleted: number;
  communityPostsCount: number;
  commentsCount: number;
  totalLikes: number;
  shopPurchasesCount: number;
};

const KNOWN_GENDER: Record<string, StudentGender> = {
  Azizbek: 'male',
  Zarina: 'female',
  Behruz: 'male',
  Madina: 'female',
  Diyor: 'male',
  Kamila: 'female',
  Sardor: 'male',
  Gulnoza: 'female',
  Asilbek: 'male',
  Nodira: 'female',
  Jasur: 'male',
  Sitora: 'female',
  Otabek: 'male',
  Feruza: 'female',
  Dilnoza: 'female',
  Kamola: 'female',
  Nilufar: 'female',
  Judie: 'female',
};

const KNOWN_AVATAR: Record<string, string> = {
  Azizbek: '🧑',
  Zarina: '👩',
  Behruz: '🧑‍🦱',
  Madina: '👩‍🦱',
  Diyor: '🧑‍🦰',
  Kamila: '👱‍♀️',
  Sardor: '🧔',
  Gulnoza: '🧕',
  Asilbek: '👨',
  Nodira: '👩‍🦳',
  Jasur: '👦',
  Sitora: '👧',
  Otabek: '🧑‍🎓',
  Feruza: '👩‍🎓',
};

function seededInt(seed: string, salt: number, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const x = Math.sin(h * 12.9898 + salt * 78.233) * 43758.5453;
  const frac = x - Math.floor(x);
  return min + Math.floor(frac * (max - min + 1));
}

const UZ_MONTHS_SHORT = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

function seededStartDate(seed: string): string {
  const monthsAgo = seededInt(seed, 50, 1, 8);
  const day = seededInt(seed, 51, 1, 28);
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  return `${day}-${UZ_MONTHS_SHORT[d.getMonth()]}, ${d.getFullYear()}`;
}

const mainTeacher = TEACHER_PROFILES.find((t) => t.id === 'main-teacher')!.name;
const assistantTeacher = TEACHER_PROFILES.find((t) => t.id === 'assistant-teacher')!.name;
const videoTeacher = TEACHER_PROFILES.find((t) => t.id === 'video-teacher')!.name;

export function getStudentProfile(name: string): StudentProfile {
  const gender: StudentGender = KNOWN_GENDER[name] ?? (seededInt(name, 99, 0, 1) === 0 ? 'male' : 'female');
  const avatarEmoji = KNOWN_AVATAR[name] ?? (gender === 'male' ? '🙂' : '🙂');

  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    avatarEmoji,
    gender,
    courseStartDate: seededStartDate(name),
    mainTeacher,
    assistantTeacher,
    videoTeacher,
    overallProgress: seededInt(name, 1, 35, 96),
    attendanceRate: seededInt(name, 2, 70, 99),
    avgGrade: seededInt(name, 3, 30, 49) / 10,
    lessonsCompleted: seededInt(name, 4, 18, 72),
    communityPostsCount: seededInt(name, 5, 0, 14),
    commentsCount: seededInt(name, 6, 2, 45),
    totalLikes: seededInt(name, 7, 5, 320),
    shopPurchasesCount: seededInt(name, 8, 0, 4),
  };
}
