// 40-vazifa: ilovaning ikki tilli (o'zbekcha/ruscha) tarjima lug'ati.
// 1-bosqich — infratuzilma + eng ko'p ko'rinadigan ekranlar (pastki
// navigatsiya, Bosh sahifa, Profil). Qolgan ekranlar keyingi bosqichlarda
// shu lug'atga qo'shib boriladi — bitta umumiy kod, ikkala tilda ham
// avtomatik yangilanadi.
export type AppLang = 'uz' | 'ru';

export const translations = {
  uz: {
    nav_home: 'Bosh sahifa',
    nav_lessons: 'Darslar',
    nav_resources: 'Resurslar',
    nav_community: 'Muloqot',
    nav_profile: 'Profil',

    home_greeting: 'Salom',
    home_radio: 'Radio',
    home_words: "So'zlar",
    home_translator: 'Tarjimon',
    home_speaking_battle: 'Speaking Battle',
    home_skills_progress: "Ko'nikmalar progressi",

    profile_title: 'Profil',
    profile_leaderboard: 'Leaderboard',
    profile_place_suffix: "-o'rin",
    profile_attendance: 'Davomat',
    profile_time: 'Vaqt',
    profile_streak: 'Chaqmoq',
    profile_hour_short: 'soat',
    profile_schedule: 'Dars jadvali',
    profile_my_teacher: 'Mening ustozim',
    profile_grades: 'Baholar',
    profile_motivation: 'Motivatsiya tizimi',
    profile_results: 'Natijalarim',
    profile_certificates: 'Sertifikatlarim',
    profile_delivery: 'Yetkazib berish xizmati',
    profile_payments: "To'lovlar tarixi",
    profile_settings: 'Sozlamalar',
  },
  ru: {
    nav_home: 'Главная',
    nav_lessons: 'Уроки',
    nav_resources: 'Ресурсы',
    nav_community: 'Общение',
    nav_profile: 'Профиль',

    home_greeting: 'Привет',
    home_radio: 'Радио',
    home_words: 'Слова',
    home_translator: 'Переводчик',
    home_speaking_battle: 'Speaking Battle',
    home_skills_progress: 'Прогресс навыков',

    profile_title: 'Профиль',
    profile_leaderboard: 'Лидерборд',
    profile_place_suffix: '-е место',
    profile_attendance: 'Посещаемость',
    profile_time: 'Время',
    profile_streak: 'Серия',
    profile_hour_short: 'ч',
    profile_schedule: 'Расписание',
    profile_my_teacher: 'Мой учитель',
    profile_grades: 'Оценки',
    profile_motivation: 'Система мотивации',
    profile_results: 'Мои результаты',
    profile_certificates: 'Мои сертификаты',
    profile_delivery: 'Служба доставки',
    profile_payments: 'История платежей',
    profile_settings: 'Настройки',
  },
} as const;

export type TranslationKey = keyof typeof translations.uz;
