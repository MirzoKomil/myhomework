export type Course = {
  id: string;
  title: string;
  level: string;
  progress: number;
  lessonsTotal: number;
  lessonsDone: number;
};

export type LessonNode = {
  id: string;
  title: string;
  progress: number;
  locked: boolean;
  side: 'left' | 'right';
};

export type LessonActivity = {
  id: string;
  type: 'video' | 'speaking' | 'quiz';
  title: string;
  duration: string;
  done: boolean;
  locked: boolean;
};

export const courses: Course[] = [
  {
    id: 'elementary-1',
    title: 'Elementary 1',
    level: 'A1',
    progress: 24,
    lessonsTotal: 12,
    lessonsDone: 3,
  },
  {
    id: 'elementary-2',
    title: 'Elementary 2',
    level: 'A2',
    progress: 0,
    lessonsTotal: 14,
    lessonsDone: 0,
  },
];

export const roadmapLessons: Record<string, LessonNode[]> = {
  'elementary-1': [
    { id: '1', title: 'Dars 1', progress: 67, locked: false, side: 'left' },
    { id: '2', title: 'Dars 2', progress: 33, locked: false, side: 'right' },
    { id: '3', title: 'Dars 3', progress: 0, locked: false, side: 'left' },
    { id: '4', title: 'Dars 4', progress: 0, locked: true, side: 'right' },
    { id: '5', title: 'Dars 5', progress: 0, locked: true, side: 'left' },
    { id: '6', title: 'Dars 6', progress: 0, locked: true, side: 'right' },
  ],
};

export const lessonActivities: Record<string, LessonActivity[]> = {
  '1': [
    { id: 'v1', type: 'video', title: 'Video dars', duration: '12 daq', done: true, locked: false },
    { id: 's1', type: 'speaking', title: 'Speaking', duration: '8 daq', done: false, locked: false },
    { id: 'q1', type: 'quiz', title: 'O\'yinlar va testlar', duration: '15 daq', done: false, locked: false },
  ],
};

export const profileStats = {
  name: 'Shahzoda Mavlonova',
  level: 'Beginner',
  phone: '+998 33 695 95 50',
  avatar: null as string | null,
  vocabularyCount: 142,
  grammarCount: 38,
  hoursSpent: 24.5,
  attendanceRate: 92,
  balance: 120000,
  tariff: 'Standard',
};

export const weeklySchedule = [
  { day: 'Dush', time: '14:00', topic: 'Present Simple', attended: true },
  { day: 'Sesh', time: '14:00', topic: 'Vocabulary: Family', attended: true },
  { day: 'Chor', time: '14:00', topic: 'Listening Practice', attended: false },
  { day: 'Pay', time: '14:00', topic: 'Speaking Club', attended: true },
  { day: 'Jum', time: '14:00', topic: 'Grammar Review', attended: null },
];

export const grades = [
  { subject: 'Speaking', score: 85, max: 100 },
  { subject: 'Listening', score: 78, max: 100 },
  { subject: 'Grammar', score: 91, max: 100 },
  { subject: 'Vocabulary', score: 88, max: 100 },
];

export const paymentHistory = [
  { id: '1', date: '2026-05-01', amount: 450000, tariff: 'Standard', status: 'paid' },
  { id: '2', date: '2026-04-01', amount: 450000, tariff: 'Standard', status: 'paid' },
  { id: '3', date: '2026-03-01', amount: 450000, tariff: 'Standard', status: 'paid' },
];
