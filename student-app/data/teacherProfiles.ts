export type TeacherProfile = {
  id: string;
  chatId?: string;
  categoryLabel: string;
  name: string;
  emoji: string;
  flag: string;
  level: string;
  rating: number;
  verified: boolean;
  quote: string;
  quoteAuthor: string;
  colors: [string, string];
  hasActions: boolean;
};

export const TEACHER_PROFILES: TeacherProfile[] = [
  {
    id: 'video-teacher',
    categoryLabel: 'Videodarslardagi ustoz',
    name: 'Muhammadali Yusupov',
    emoji: '👨‍🏫',
    flag: '🇺🇿',
    level: 'C2 daraja',
    rating: 4.9,
    verified: true,
    quote: 'Til o\'rganish — sabr bilan mevasini beradigan daraxt.',
    quoteAuthor: "O'zbek xalq maqoli",
    colors: ['#38BDF8', '#0284C7'],
    hasActions: false,
  },
  {
    id: 'main-teacher',
    chatId: 'main-teacher',
    categoryLabel: 'Asosiy ustoz',
    name: 'Asilbek Asqarov',
    emoji: '👨‍🏫',
    flag: '🇺🇿',
    level: 'C1 daraja',
    rating: 4.8,
    verified: true,
    quote: 'Oltin olma duo ol, duo oltin emasmi',
    quoteAuthor: "O'zbek xalq maqoli",
    colors: ['#9B7BFF', '#6B4FE0'],
    hasActions: true,
  },
  {
    id: 'assistant-teacher',
    chatId: 'assistant-teacher',
    categoryLabel: 'Yordamchi ustoz',
    name: 'Nozima Ergasheva',
    emoji: '👩‍🏫',
    flag: '🇺🇿',
    level: 'B2 daraja',
    rating: 4.7,
    verified: true,
    quote: "Kim ko'p bilsa, shuncha qadrlanadi",
    quoteAuthor: "O'zbek xalq maqoli",
    colors: ['#34D399', '#059669'],
    hasActions: true,
  },
];

export type TeacherComment = { id: string; name: string; text: string; time: string; me?: boolean };

export const MAIN_TEACHER_COMMENTS: TeacherComment[] = [
  { id: 'mc1', name: 'Dilnoza', text: "Asilbek aka juda tushunarli va sabr bilan tushuntiradi, rahmat ustoz!", time: '3 kun oldin' },
  { id: 'mc2', name: 'Sardor', text: 'Grammatikani shu qadar oson tushuntiradiki, hech qiynalmayapman.', time: '1 kun oldin' },
  { id: 'mc3', name: 'Madina', text: "Darslar juda qiziqarli o'tadi, rahmat katta!", time: '5 soat oldin' },
];

export const ASSISTANT_TEACHER_COMMENTS: TeacherComment[] = [
  { id: 'ac1', name: 'Jasur', text: "Nozima opa har doim savollarimga tezda javob beradi.", time: '2 kun oldin' },
  { id: 'ac2', name: 'Zarina', text: "Juda mehribon va yordamga tayyor ustoz.", time: '1 kun oldin' },
];
