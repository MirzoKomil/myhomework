/**
 * v2 manzillari — dizayndagi har bir ekran (artboard) qaysi manzilda.
 * Ekranlar bir-biriga faqat shu yerdagi manzillar orqali bog'lanadi.
 * Popup'lar (BotConnect, ContactSheet, HomeworkSent, DebtReminder,
 * LogoutConfirm, LevelUp, LessonLocked, LiveNow, StreakLost, StreakConfirm,
 * OrderSuccess) alohida manzil emas — components/v2/popups/.
 */
export const R = {
  login: '/v2/login', // 01 Login
  onboarding: '/v2/onboarding', // 02 Onboarding
  home: '/v2', // 03 MainNoBot · 04 Main · 06 DarkMain (qorong'u rejimda)
  notifications: '/v2/bildirishnomalar', // 05 Notifications
  wordReview: '/v2/takrorlash', // 07 WordReview

  path: '/v2/darslar', // 07 Path
  lesson: (id: string) => `/v2/dars/${id}`, // 08 Lesson
  vocab: (id: string) => `/v2/dars/${id}/sozlar`, // 09 Vocab
  audioDialog: (id: string) => `/v2/dars/${id}/audio`, // 10 AudioDialog
  slides: (id: string) => `/v2/dars/${id}/slaydlar`, // 11 Slides
  video: (id: string) => `/v2/dars/${id}/video`, // 12 Video
  homework: (id: string) => `/v2/dars/${id}/vazifa`, // 13 Homework
  homeworkPart: (id: string, part: string) => `/v2/dars/${id}/vazifa/${part}`, // 14 Exercise · 15 Test · 17 Reading · 18 Match · 19 Build
  complete: (id: string) => `/v2/dars/${id}/tugadi`, // 18 Complete
  wordList: (id: string) => `/v2/dars/${id}/soz-royxati`, // 14 WordList
  quickCheck: (id: string) => `/v2/dars/${id}/tekshiruv`, // 77 QuickCheck
  slideViewer: (id: string) => `/v2/dars/${id}/slaydlar-toliq`, // 84 SlideViewer
  testReview: (id: string) => `/v2/dars/${id}/vazifa-natija`, // 75 TestReview
  mistakes: (id: string) => `/v2/dars/${id}/xatolar`, // 83 MistakeReview

  exams: '/v2/imtihonlar', // 20 Exams
  bonus: '/v2/bonus', // 23 Bonus
  bonusPlayer: (id: string) => `/v2/bonus/${id}`, // 27 BonusPlayer
  certificates: '/v2/sertifikatlar', // 24 Certificates
  certificate: (id: string) => `/v2/sertifikatlar/${id}`, // 28 CertificateView
  schedule: '/v2/jadval', // 23 Schedule
  progress: '/v2/natijalar', // 24 Progress

  practice: '/v2/mashq', // 25 Practice
  battle: '/v2/mashq/yuzma-yuz', // 26 Battle
  wordChain: '/v2/mashq/songgi-harf', // 27 WordChain
  memory: '/v2/mashq/esla-mosla', // 28 Memory
  wordSearch: '/v2/mashq/soztopar', // 29 WordSearch
  mystery: '/v2/mashq/sirli-soz', // 30 Mystery

  grammarList: '/v2/grammatika', // 31 GrammarList
  grammar: (id: string) => `/v2/grammatika/${id}`, // 32 Grammar
  audioList: '/v2/audiolar', // 37 AudioList
  audioTrack: (id: string) => `/v2/audiolar/${id}`, // 76 AudioTrack
  dialogList: '/v2/dialoglar', // 38 DialogList
  dialog: (id: string) => `/v2/dialoglar/${id}`, // 41 AudioDialogLib
  storyList: '/v2/hikoyalar', // 35 StoryList
  book: (id: string) => `/v2/hikoyalar/${id}`, // 36 Book
  translator: '/v2/tarjimon', // 37 Translator
  search: '/v2/qidiruv', // 38 SearchEmpty (natija yo'q holati)

  league: '/v2/liga', // 39 Leaderboard
  leagueResult: '/v2/liga/natija', // 40 LeagueResult
  levels: '/v2/darajalar', // 46 Levels
  lugat: '/v2/lugat', // 48 Lugat

  shop: '/v2/dokon', // 43 Shop
  shopItem: (id: string) => `/v2/dokon/${id}`, // 44 ShopItem
  imageViewer: (id: string) => `/v2/dokon/${id}/rasm`, // 45 ImageViewer
  checkout: (id: string) => `/v2/dokon/${id}/buyurtma`, // 46 Checkout
  orders: '/v2/buyurtmalar', // 47 Orders
  streak: '/v2/streak', // 48 StreakSaved

  profile: '/v2/profil', // 49 Profile
  profileEdit: '/v2/profil/avatar', // 50 ProfileEdit
  teachers: '/v2/ustozlar', // 51 Teacher
  payments: '/v2/tolovlar', // 52 Payments
  contract: '/v2/shartnoma', // 53 Contract
  expired: '/v2/kurs-tugadi', // 54 Expired

  settings: '/v2/sozlamalar', // 55 Settings
  language: '/v2/sozlamalar/til', // 56 Language
  devices: '/v2/sozlamalar/qurilmalar', // 57 Devices
  faq: '/v2/sozlamalar/savollar', // 58 FAQ
  privacy: '/v2/sozlamalar/maxfiylik', // 59 Privacy
  offline: '/v2/oflayn', // 60 Offline
} as const;
