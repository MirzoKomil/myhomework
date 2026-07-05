import { Ionicons } from '@expo/vector-icons';

export type PronunciationExample = { text: string; hint: string };
export type PronunciationTopic = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  synopsis: string;
  examples: PronunciationExample[];
};

function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function ex(text: string, hint: string): PronunciationExample {
  return { text, hint };
}

function t(
  title: string,
  icon: keyof typeof Ionicons.glyphMap,
  color: string,
  bg: string,
  synopsis: string,
  examples: PronunciationExample[]
): PronunciationTopic {
  return { id: slug(title), title, icon, color, bg, synopsis, examples };
}

export const PRONUNCIATION_TOPICS: PronunciationTopic[] = [
  t(
    'Alifbo',
    'text-outline',
    '#4F8CFF',
    '#E8F0FF',
    "Ingliz alifbosida 26 ta harf bor: 5 tasi unli (a, e, i, o, u), qolgan 21 tasi undosh. Har bir harfning so'zdagi tovushidan farqli o'z nomi mavjud — shu nomni to'g'ri talaffuz qilishni o'rganish barcha keyingi mavzular uchun poydevor bo'ladi.",
    [ex('A', 'ey'), ex('B', 'bi'), ex('C', 'si'), ex('D', 'di'), ex('E', 'i'), ex('F', 'ef'), ex('G', 'ji'), ex('H', 'eych')]
  ),
  t(
    'Harf tovushlari',
    'musical-notes-outline',
    '#7B61FF',
    '#EDE9FE',
    "Har bir harf nomidan tashqari, so'z ichida chiqaradigan alohida tovushga ega. Bir xil harf turli so'zlarda turlicha tovush berishi mumkin — masalan 'c' harfi 'cat'da /k/, 'city'da esa /s/ tovushini beradi.",
    [ex('cat', "k tovushi"), ex('city', "s tovushi"), ex('go', "g tovushi"), ex('giant', "j tovushi"), ex('phone', "f tovushi"), ex('sugar', "sh tovushi")]
  ),
  t(
    'Unli tovushlar',
    'ellipse-outline',
    '#34D399',
    '#D1FAE5',
    "Ingliz tilida 5 ta unli harf bo'lsa-da, 20 dan ortiq turli unli tovush mavjud. Bu tovushlar qisqa yoki cho'ziq bo'lib, so'zning butunlay boshqa ma'no anglatishiga sabab bo'lishi mumkin.",
    [ex('ship', "qisqa i"), ex('sheep', "cho'ziq i"), ex('full', "qisqa u"), ex('fool', "cho'ziq u"), ex('cat', "qisqa a"), ex('cut', "boshqa unli")]
  ),
  t(
    'Undosh tovushlar',
    'grid-outline',
    '#F472B6',
    '#FCE7F3',
    "Undosh tovushlar havo oqimining og'iz ichida turli joyda to'silishi orqali hosil bo'ladi. Ba'zilari o'zbek tilidagi tovushlarga o'xshaydi, ba'zilari esa butunlay yangi va alohida mashq talab qiladi.",
    [ex('pin', 'jarangsiz p'), ex('bin', 'jarangli b'), ex('tin', 'jarangsiz t'), ex('din', 'jarangli d'), ex('fine', 'jarangsiz f'), ex('vine', 'jarangli v')]
  ),
  t(
    'TH tovushi',
    'chatbox-ellipses-outline',
    '#FBBF24',
    '#FEF3C7',
    "'TH' harflar birikmasi ikki xil tovush beradi: jarangsiz /θ/ (think so'zida) va jarangli /ð/ (this so'zida). Ikkalasida ham til uchi old tishlar orasiga yengil tegib turadi.",
    [ex('think', 'jarangsiz th'), ex('three', 'jarangsiz th'), ex('bath', 'jarangsiz th'), ex('this', 'jarangli th'), ex('that', 'jarangli th'), ex('mother', 'jarangli th')]
  ),
  t(
    'R va L',
    'swap-horizontal-outline',
    '#A855F7',
    '#F3E8FF',
    "O'zbek tilida farqlanmaydigan bu ikki tovush ingliz tilida so'z ma'nosini butunlay o'zgartiradi. 'R' tilni orqaga egib, hech narsaga tekkizmasdan; 'L' esa til uchini yuqori tishlar orqasiga tekkizib aytiladi.",
    [ex('right', "til tishga tegmaydi"), ex('light', "til tishga tegadi"), ex('road', 'r tovushi'), ex('load', 'l tovushi'), ex('correct', 'r tovushi'), ex('collect', 'l tovushi')]
  ),
  t(
    'W va V',
    'swap-horizontal-outline',
    '#38BDF8',
    '#E0F2FE',
    "'W' lablarni dumaloq shaklga keltirib puflab aytiladi, 'V' esa pastki lab yuqori tishlarga tegib chiqariladi. Bu ikki tovushni chalkashtirib yuborish juda keng tarqalgan xato hisoblanadi.",
    [ex('west', 'lab dumaloq'), ex('vest', 'lab tishga tegadi'), ex('wet', 'w tovushi'), ex('vet', 'v tovushi'), ex('wine', 'w tovushi'), ex('vine', 'v tovushi')]
  ),
  t(
    "So'z urg'usi",
    'megaphone-outline',
    '#FB923C',
    '#FFEDD5',
    "Ingliz so'zlarida bitta bo'g'in boshqalariga nisbatan kuchliroq va cho'ziqroq aytiladi. Urg'u noto'g'ri qo'yilsa, so'zning ma'nosi yoki turkumi (ot/fe'l) o'zgarib qolishi mumkin.",
    [ex('PREsent', "ot: sovg'a"), ex('preSENT', "fe'l: taqdim etmoq"), ex('REcord', 'ot: yozuv'), ex('reCORD', "fe'l: yozib olmoq"), ex('PHOtograph', 'ot: surat')]
  ),
  t(
    "Gap urg'usi",
    'megaphone-outline',
    '#F87171',
    '#FEE2E2',
    "Gapda asosiy ma'no bildiruvchi so'zlar (ot, fe'l, sifat) kuchliroq aytiladi, yordamchi so'zlar (artikl, predlog) esa tezroq va kuchsizroq talaffuz qilinadi. Bu tabiiy ohangni yaratadi.",
    [ex('I WANT to GO HOME.', "WANT va GO HOME kuchli"), ex("She CAN'T BELIEVE it.", "CAN'T va BELIEVE kuchli")]
  ),
  t(
    'Intonatsiya',
    'trending-up-outline',
    '#60A5FA',
    '#DBEAFE',
    "Ovoz balandligining ko'tarilishi yoki tushishi gapning ma'nosi va maqsadini o'zgartiradi. Savol gaplarida ko'pincha ohang ko'tariladi, tasdiq gaplarida esa pasayadi.",
    [ex("You're coming?", "ohang ko'tariladi"), ex("You're coming.", 'ohang pasayadi'), ex('Really?', "ohang ko'tariladi")]
  ),
  t(
    "Bog'langan nutq",
    'link-outline',
    '#059669',
    '#D1FAE5',
    "Tabiiy nutqda so'zlar bir-biriga bog'lanib ketadi, ayrim tovushlar tushib qoladi yoki o'zgaradi. Masalan 'want to' so'zlashuvda ko'pincha 'wanna' kabi eshitiladi.",
    [ex('want to', 'wanna'), ex('going to', 'gonna'), ex('give me', 'gimme'), ex('kind of', 'kinda'), ex('got to', 'gotta')]
  ),
  t(
    'Qisqartmalar',
    'contract-outline',
    '#DB2777',
    '#FCE7F3',
    "So'zlashuv nutqida ikkita so'z birlashib qisqaradi. Bu tabiiy va tezroq talaffuz qilishga yordam beradi, yozma tilda esa ko'pincha to'liq shakl ishlatiladi.",
    [ex("I'm", 'I am'), ex("don't", 'do not'), ex("she's", 'she has / is'), ex("they'll", 'they will'), ex("can't", 'cannot')]
  ),
  t(
    'Tez gapirish',
    'speedometer-outline',
    '#D97706',
    '#FEF3C7',
    "Tez nutqda kuchsiz so'zlar (artikl, predlog) deyarli eshitilmay qoladi. Tinglab tushunish uchun diqqatni asosiy urg'uli so'zlarga qaratish kerak.",
    [ex('Whatcha doin?', 'What are you doing?'), ex('Didja eat?', 'Did you eat?'), ex('Gimme that.', 'Give me that.')]
  ),
  t(
    'Minimal juftliklar',
    'git-compare-outline',
    '#7C3AED',
    '#EDE9FE',
    "Faqat bitta tovush bilan farqlanadigan so'zlar juftligi talaffuzni mashq qilish uchun juda foydali. Bu so'zlarni farqlashni o'rganish tinglab tushunish ko'nikmasini ham yaxshilaydi.",
    [ex('ship / sheep', "qisqa/cho'ziq i"), ex('bit / beat', "qisqa/cho'ziq i"), ex('pull / pool', "qisqa/cho'ziq u"), ex('cheap / chip', "cho'ziq/qisqa i")]
  ),
  t(
    'Tabiiy talaffuz',
    'sparkles-outline',
    '#EA580C',
    '#FFEDD5',
    "Ona tilida so'zlashuvchi kabi tabiiy jaranglash uchun to'g'ri urg'u, ohang va bog'langan nutqni birgalikda qo'llash kerak. Ko'p tinglash va takrorlash bu ko'nikmani tez rivojlantiradi.",
    [ex("How's it going?", 'qanday holat'), ex('I dunno.', "bilmayman (so'zlashuv)"), ex("Let's grab a bite.", 'ovqatlanib olaylik')]
  ),
  t(
    'Shadowing',
    'copy-outline',
    '#0284C7',
    '#E0F2FE',
    "Shadowing — ona tilida so'zlashuvchi ortidan deyarli bir vaqtda, uning ohangi va tezligiga taqlid qilib takrorlab borish usuli. Bu usul talaffuz, ritm va tezlikni tabiiy tarzda o'zlashtirishga yordam beradi.",
    [ex('Listen, then repeat immediately.', "eshiting, darhol takrorlang"), ex('Match the speed and rhythm.', "tezlik va ritmga moslashing")]
  ),
];

export function getPronunciationTopicPracticeCount(topic: PronunciationTopic): number {
  return topic.examples.length;
}
