export type PodcastLevel = 'a1' | 'a2' | 'b1';

export const PODCAST_LEVEL_LABELS: Record<PodcastLevel, string> = {
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
};

export const PODCAST_LEVEL_COLORS: Record<PodcastLevel, string> = {
  a1: '#34D399',
  a2: '#FBBF24',
  b1: '#F87171',
};

export const PODCAST_LEVELS_ORDER: PodcastLevel[] = ['a1', 'a2', 'b1'];

export type PodcastLine = { en: string; uz: string };
export type PodcastEpisode = {
  id: string;
  level: PodcastLevel;
  title: string;
  emoji: string;
  colors: [string, string];
  lines: PodcastLine[];
};

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const COLOR_PAIRS: [string, string][] = [
  ['#9B7BFF', '#6B4FE0'],
  ['#F87171', '#F59E0B'],
  ['#D879E8', '#A855F7'],
  ['#FBBF24', '#D97706'],
  ['#34D399', '#059669'],
  ['#60A5FA', '#2563EB'],
  ['#F472B6', '#DB2777'],
  ['#FB923C', '#EA580C'],
  ['#38BDF8', '#0284C7'],
  ['#A78BFA', '#7C3AED'],
  ['#4ADE80', '#16A34A'],
  ['#FCA5A5', '#DC2626'],
];

let colorCounter = 0;
function nextColors(): [string, string] {
  const c = COLOR_PAIRS[colorCounter % COLOR_PAIRS.length];
  colorCounter += 1;
  return c;
}

function P(en: string, uz: string): PodcastLine {
  return { en, uz };
}

function episode(level: PodcastLevel, title: string, emoji: string, lines: PodcastLine[]): PodcastEpisode {
  return { id: slug(title), level, title, emoji, colors: nextColors(), lines };
}

export const PODCAST_EPISODES: PodcastEpisode[] = [
  // ─── A1 — 12 ta ─────────────────────────────────────────────────────────
  episode('a1', 'Hello! Nice to Meet You', '👋', [
    P('Hello! My name is Sarah.', 'Salom! Mening ismim Sara.'),
    P('I am from London.', 'Men Londondanman.'),
    P('Nice to meet you!', 'Tanishganimdan xursandman!'),
    P('What is your name?', 'Sizning ismingiz nima?'),
    P('Where are you from?', 'Siz qayerdansiz?'),
    P('It is nice to make new friends.', 'Yangi do\'stlar orttirish yoqimli.'),
  ]),
  episode('a1', 'My Family', '👨‍👩‍👧‍👦', [
    P('I have a small family.', 'Mening kichik oilam bor.'),
    P('There are four people in my family.', "Oilamizda to'rtta odam bor."),
    P('My father works at a bank.', 'Otam bankda ishlaydi.'),
    P('My mother is a teacher.', "Onam o'qituvchi."),
    P('I have one younger sister.', 'Mening bitta singlim bor.'),
    P('We love spending time together.', "Biz birga vaqt o'tkazishni yaxshi ko'ramiz."),
  ]),
  episode('a1', 'A Day in My Life', '⏰', [
    P('I wake up at seven o\'clock.', "Men soat yettida uyg'onaman."),
    P('First, I brush my teeth and have breakfast.', 'Avval tishimni yuvaman va nonushta qilaman.'),
    P('Then I go to work by bus.', 'Keyin avtobusda ishga boraman.'),
    P('I work from nine to five.', "Men soat to'qqizdan beshgacha ishlayman."),
    P('In the evening, I cook dinner and watch TV.', "Kechqurun kechki ovqat pishiraman va televizor ko'raman."),
    P('I go to bed at eleven.', "Men soat o'n birda uxlashga yotaman."),
  ]),
  episode('a1', 'My House', '🏠', [
    P('I live in a small apartment.', 'Men kichik kvartirada yashayman.'),
    P('It has two bedrooms and one kitchen.', 'Unda ikkita yotoqxona va bitta oshxona bor.'),
    P('My favorite room is the living room.', 'Mening sevimli xonam mehmonxona.'),
    P('I like to relax there after work.', "Ishdan keyin o'sha yerda dam olishni yoqtiraman."),
    P('My house is close to the park.', 'Uyim parkka yaqin.'),
    P('I feel comfortable at home.', 'Uyimda o\'zimni qulay his qilaman.'),
  ]),
  episode('a1', 'At the Supermarket', '🛒', [
    P('I go to the supermarket every weekend.', 'Men har dam olish kuni supermarketga boraman.'),
    P('I buy fruits, vegetables, and bread.', 'Meva, sabzavot va non sotib olaman.'),
    P('Sometimes the lines are very long.', "Ba'zan navbat juda uzun bo'ladi."),
    P('I always make a shopping list first.', "Men doim avval xarid ro'yxatini tuzaman."),
    P('This helps me save money.', 'Bu menga pul tejashga yordam beradi.'),
    P('Shopping can be fun with a plan.', 'Reja bilan xarid qilish qiziqarli bo\'lishi mumkin.'),
  ]),
  episode('a1', 'Ordering Coffee', '☕', [
    P('I love going to coffee shops.', 'Menga qahvaxonalarga borish yoqadi.'),
    P('I usually order a cup of black coffee.', 'Odatda men bir chashka qora qahva buyurtma qilaman.'),
    P('Sometimes I ask for milk and sugar.', "Ba'zan sut va shakar so'rayman."),
    P('The barista always smiles and says thank you.', 'Barista doim jilmayib rahmat aytadi.'),
    P('I enjoy drinking coffee slowly.', 'Menga qahvani sekin ichish yoqadi.'),
    P('It is a relaxing part of my day.', "Bu kunimning dam oluvchi qismi."),
  ]),
  episode('a1', 'My Favorite Food', '🍕', [
    P('My favorite food is pizza.', 'Mening sevimli taomim pitsa.'),
    P('I like pizza with cheese and mushrooms.', "Menga pishloq va qo'ziqorinli pitsa yoqadi."),
    P('I usually eat it on Fridays.', 'Odatda uni juma kunlari yeyman.'),
    P('I also enjoy cooking at home.', 'Menga uyda ovqat pishirish ham yoqadi.'),
    P('Food brings people together.', 'Ovqat odamlarni birlashtiradi.'),
    P('What is your favorite food?', 'Sizning sevimli taomingiz nima?'),
  ]),
  episode('a1', 'My Hobbies', '🎨', [
    P('In my free time, I like reading books.', "Bo'sh vaqtimda kitob o'qishni yoqtiraman."),
    P('I also enjoy painting pictures.', 'Menga rasm chizish ham yoqadi.'),
    P('On weekends, I play football with friends.', "Dam olish kunlari do'stlarim bilan futbol o'ynayman."),
    P('Hobbies help me relax.', "Sevimli mashg'ulotlar menga dam olishga yordam beradi."),
    P('I think everyone needs a hobby.', "Menimcha, har kimga sevimli mashg'ulot kerak."),
    P('What is your hobby?', "Sizning sevimli mashg'ulotingiz nima?"),
  ]),
  episode('a1', 'Going to School', '🏫', [
    P('I go to school every morning.', 'Men har kuni ertalab maktabga boraman.'),
    P('My classes start at eight o\'clock.', "Darslarim soat sakkizda boshlanadi."),
    P('My favorite subject is English.', "Mening sevimli fanim ingliz tili."),
    P('I study with my classmates in the library.', "Men sinfdoshlarim bilan kutubxonada o'qiyman."),
    P('School helps me learn new things every day.', "Maktab menga har kuni yangi narsalarni o'rganishga yordam beradi."),
    P('I enjoy learning with my friends.', "Menga do'stlarim bilan o'rganish yoqadi."),
  ]),
  episode('a1', 'My Best Friend', '🧑‍🤝‍🧑', [
    P('My best friend\'s name is Anna.', "Eng yaqin do'stimning ismi Anna."),
    P('We have known each other for five years.', 'Biz besh yildan beri bir-birimizni bilamiz.'),
    P('We like watching movies together.', "Bizga birga kino ko'rish yoqadi."),
    P('She always helps me when I need it.', 'U menga kerak bo\'lganda doim yordam beradi.'),
    P('A good friend makes life better.', "Yaxshi do'st hayotni yaxshilaydi."),
    P('I am thankful to have her.', 'Uning borligidan minnatdorman.'),
  ]),
  episode('a1', 'Visiting the Doctor', '🩺', [
    P('Last week, I visited the doctor.', "O'tgan hafta men shifokorga bordim."),
    P('I had a small cough and a headache.', "Menda ozgina yo'tal va bosh og'rig'i bor edi."),
    P('The doctor checked me carefully.', 'Shifokor meni ehtiyotkorlik bilan tekshirdi.'),
    P('She gave me some medicine.', 'U menga dori berdi.'),
    P('After a few days, I felt much better.', "Bir necha kundan so'ng o'zimni ancha yaxshi his qildim."),
    P('It is important to take care of our health.', "Sog'ligimizga g'amxo'rlik qilish muhim."),
  ]),
  episode('a1', 'My Weekend Plans', '📅', [
    P('This weekend, I have many plans.', 'Bu dam olish kunlarida mening ko\'p rejalarim bor.'),
    P('On Saturday, I will meet my friends.', "Shanba kuni do'stlarim bilan uchrashaman."),
    P('We will go to the cinema together.', 'Biz birga kinoteatrga boramiz.'),
    P('On Sunday, I will clean my house.', 'Yakshanba kuni uyimni tozalayman.'),
    P('Then I will relax and read a book.', "Keyin dam olib, kitob o'qiyman."),
    P('I always look forward to weekends.', 'Men doim dam olish kunlarini intiqlik bilan kutaman.'),
  ]),

  // ─── A2 — 12 ta ─────────────────────────────────────────────────────────
  episode('a2', 'My First Job', '💼', [
    P('Last year, I got my first job.', "O'tgan yili men birinchi ishimga joylashdim."),
    P('I worked at a small coffee shop.', 'Men kichik qahvaxonada ishladim.'),
    P('At first, I was very nervous.', 'Avvaliga men juda hayajonlangan edim.'),
    P('My manager was patient and helpful.', 'Mening menejerim sabrli va yordamchi edi.'),
    P('I learned how to talk to customers.', "Mijozlar bilan qanday gaplashishni o'rgandim."),
    P('That job taught me many important skills.', "O'sha ish menga ko'plab muhim ko'nikmalarni o'rgatdi."),
  ]),
  episode('a2', 'A Memorable Vacation', '🏖️', [
    P('Two years ago, I traveled to Turkey.', "Ikki yil oldin men Turkiyaga sayohat qildim."),
    P('The beaches and food were amazing.', 'Plyajlar va taomlar ajoyib edi.'),
    P('I visited many historical places.', "Men ko'plab tarixiy joylarni ziyorat qildim."),
    P('I met friendly local people.', "Men mehribon mahalliy odamlar bilan tanishdim."),
    P('That trip is one of my best memories.', "O'sha sayohat mening eng yaxshi xotiralarimdan biri."),
    P('I hope to travel there again.', "U yerga yana borishni umid qilaman."),
  ]),
  episode('a2', 'Learning English', '📘', [
    P('I started learning English three years ago.', "Men uch yil oldin ingliz tilini o'rgana boshladim."),
    P('At first, grammar was very difficult for me.', "Avvaliga grammatika men uchun juda qiyin edi."),
    P('I practiced speaking every single day.', "Men har kuni gapirishni mashq qildim."),
    P('Watching movies helped me understand better.', "Kino ko'rish menga yaxshiroq tushunishga yordam berdi."),
    P('Now I feel more confident speaking English.', "Endi ingliz tilida gapirishda o'zimni ishonchliroq his qilaman."),
    P('Learning a language takes time and patience.', "Til o'rganish vaqt va sabr talab qiladi."),
  ]),
  episode('a2', 'A Busy Morning', '⏰', [
    P('This morning was very busy for me.', 'Bugun ertalab men juda band edim.'),
    P('I woke up late and missed my alarm.', "Kech uyg'ondim va budilnikni o'tkazib yubordim."),
    P('I quickly got dressed and ate breakfast.', 'Tez kiyinib, nonushta qildim.'),
    P('I ran to catch the bus to work.', 'Ishga borish uchun avtobusga yugurdim.'),
    P('Luckily, I arrived just in time.', "Yaxshiyamki, o'z vaqtida yetib bordim."),
    P('I try to plan better the next day.', 'Keyingi kunni yaxshiroq rejalashtirishga harakat qilaman.'),
  ]),
  episode('a2', 'Shopping for Clothes', '👕', [
    P('Yesterday, I went shopping for new clothes.', 'Kecha men yangi kiyim xarid qilgani bordim.'),
    P('I needed a jacket for the winter.', 'Menga qish uchun kurtka kerak edi.'),
    P('I tried on several different jackets.', "Men bir necha xil kurtkalarni kiyib ko'rdim."),
    P('Finally, I found the perfect one.', "Nihoyat, men mukammalini topdim."),
    P('The price was a little expensive.', 'Narxi biroz qimmat edi.'),
    P('But I was happy with my choice.', 'Lekin men tanlovimdan xursand edim.'),
  ]),
  episode('a2', 'At the Airport', '✈️', [
    P('Last month, I traveled by airplane.', "O'tgan oy men samolyotda sayohat qildim."),
    P('I arrived at the airport two hours early.', 'Aeroportga ikki soat oldin yetib bordim.'),
    P('I checked in my luggage at the counter.', "Yukimni ro'yxatdan o'tkazdim."),
    P('Security check took a long time.', 'Xavfsizlik tekshiruvi ko\'p vaqt oldi.'),
    P('Finally, I boarded the plane on time.', "Nihoyat, o'z vaqtida samolyotga chiqdim."),
    P('Traveling by air is fast but tiring.', 'Samolyotda sayohat qilish tez, lekin charchatadi.'),
  ]),
  episode('a2', 'Booking a Hotel', '🏨', [
    P('I booked a hotel online for my trip.', "Sayohatim uchun mehmonxonani onlayn bron qildim."),
    P('I compared prices on several websites.', "Bir nechta veb-saytlarda narxlarni solishtirdim."),
    P('I chose a hotel near the city center.', 'Shahar markaziga yaqin mehmonxonani tanladim.'),
    P('The room was clean and comfortable.', 'Xona toza va qulay edi.'),
    P('The staff were very friendly and helpful.', 'Xodimlar juda mehribon va yordamchi edi.'),
    P('I would definitely stay there again.', "Men albatta yana o'sha yerda qolardim."),
  ]),
  episode('a2', 'Healthy Habits', '🏃', [
    P('I try to live a healthy lifestyle.', "Men sog'lom turmush tarzini olib borishga harakat qilaman."),
    P('I exercise for thirty minutes every day.', "Har kuni o'ttiz daqiqa mashq qilaman."),
    P('I eat more vegetables and less sugar.', "Ko'proq sabzavot va kamroq shakar iste'mol qilaman."),
    P('I also drink plenty of water.', 'Shuningdek, ko\'p suv ichaman.'),
    P('Sleeping well is important for my health.', "Yaxshi uxlash sog'lig'im uchun muhim."),
    P('Small habits can make a big difference.', 'Kichik odatlar katta farq qilishi mumkin.'),
  ]),
  episode('a2', 'Using Technology Every Day', '📱', [
    P('Technology is a big part of my daily life.', "Texnologiya mening kundalik hayotimning katta qismi."),
    P('I use my phone to check messages and news.', "Xabarlar va yangiliklarni tekshirish uchun telefonimdan foydalanaman."),
    P('I also use apps to learn English.', "Ingliz tilini o'rganish uchun ilovalardan ham foydalanaman."),
    P('Sometimes I spend too much time online.', "Ba'zan onlaynda juda ko'p vaqt o'tkazaman."),
    P('I try to balance screen time and real life.', "Ekran vaqti va haqiqiy hayot o'rtasida muvozanat saqlashga harakat qilaman."),
    P('Technology is useful when used wisely.', 'Texnologiya oqilona ishlatilganda foydali.'),
  ]),
  episode('a2', 'A Birthday Celebration', '🎂', [
    P('Last week, I celebrated my birthday.', "O'tgan hafta men tug'ilgan kunimni nishonladim."),
    P('My friends organized a small surprise party.', "Do'stlarim kichik syurpriz bazm tashkil qilishdi."),
    P('We ate cake and played fun games.', 'Biz tort yedik va qiziqarli o\'yinlar o\'ynadik.'),
    P('I received many thoughtful gifts.', "Men ko'plab yoqimli sovg'alar oldim."),
    P('It was a memorable and happy day.', "Bu yodda qoladigan va baxtli kun edi."),
    P('I felt very grateful for my friends.', "Do'stlarimga juda minnatdor bo'ldim."),
  ]),
  episode('a2', 'My Dream House', '🏡', [
    P('I often imagine my dream house.', "Men ko'pincha orzuimdagi uyni tasavvur qilaman."),
    P('It would have a big garden with flowers.', "Unda gullar bilan katta bog' bo'lardi."),
    P('I would like a large kitchen for cooking.', "Ovqat pishirish uchun katta oshxona xohlardim."),
    P('There would be a cozy reading room too.', "Shuningdek, qulay o'qish xonasi ham bo'lardi."),
    P('My house would be near the sea.', 'Uyim dengizga yaqin bo\'lardi.'),
    P('Maybe one day my dream will come true.', "Balki bir kun orzuim ro'yobga chiqar."),
  ]),
  episode('a2', 'A Funny Experience', '😂', [
    P('Last summer, I had a funny experience.', "O'tgan yozda men kulgili voqeani boshdan kechirdim."),
    P('I was walking to work in the rain.', "Men yomg'irda ishga piyoda ketayotgan edim."),
    P('Suddenly, my umbrella flew away in the wind.', "Birdan soyabonim shamolda uchib ketdi."),
    P('I had to run after it down the street.', "Men uning ortidan ko'cha bo'ylab yugurishga majbur bo'ldim."),
    P('Everyone around me started laughing.', 'Atrofimdagilar kula boshlashdi.'),
    P('Now, we still laugh about that funny day.', "Hozir ham o'sha kulgili kun haqida kulamiz."),
  ]),

  // ─── B1 — 12 ta ─────────────────────────────────────────────────────────
  episode('b1', 'Social Media in Our Lives', '📱', [
    P('Social media has changed how we communicate.', "Ijtimoiy tarmoqlar muloqot qilish usulimizni o'zgartirdi."),
    P('We can now connect with people around the world instantly.', "Endi biz butun dunyo bo'ylab odamlar bilan bir zumda bog'lanishimiz mumkin."),
    P('However, it also has some negative effects.', "Ammo uning ba'zi salbiy ta'sirlari ham bor."),
    P('Many people spend too much time scrolling online.', "Ko'p odamlar onlaynda ortiqcha vaqt sarflaydi."),
    P('It is important to use social media in moderation.', "Ijtimoiy tarmoqlardan me'yorida foydalanish muhim."),
    P('Balance is the key to a healthy digital life.', "Muvozanat sog'lom raqamli hayotning kalitidir."),
  ]),
  episode('b1', 'The Future of Education', '🎓', [
    P('Education is changing quickly with new technology.', "Ta'lim yangi texnologiyalar bilan tez o'zgarmoqda."),
    P('More students are learning online than ever before.', "Ilgarigidan ko'ra ko'proq talabalar onlayn o'qimoqda."),
    P('Artificial intelligence can help personalize learning.', "Sun'iy intellekt ta'limni shaxsiylashtirishga yordam berishi mumkin."),
    P('However, teachers still play an essential role.', 'Biroq, o\'qituvchilar hali ham muhim rol o\'ynaydi.'),
    P('The classroom of the future will look very different.', "Kelajakdagi sinfxona hozirgidan juda farq qiladi."),
    P('Education must adapt to prepare students for change.', "Ta'lim talabalarni o'zgarishlarga tayyorlash uchun moslashishi kerak."),
  ]),
  episode('b1', 'Working from Home', '🏡', [
    P('Many companies now allow employees to work remotely.', "Ko'plab kompaniyalar endi xodimlarga masofadan ishlashga ruxsat beradi."),
    P('Working from home gives people more flexibility.', "Uydan ishlash odamlarga ko'proq erkinlik beradi."),
    P('However, it can be difficult to stay focused.', "Biroq, diqqatni jamlab turish qiyin bo'lishi mumkin."),
    P('Some people miss talking to coworkers in person.', "Ba'zi odamlar hamkasblari bilan yuzma-yuz gaplashishni sog'inadi."),
    P('A good routine helps balance work and life.', "Yaxshi kun tartibi ish va hayot o'rtasida muvozanat saqlashga yordam beradi."),
    P('Remote work will likely continue to grow.', "Masofaviy ish ehtimol o'sishda davom etadi."),
  ]),
  episode('b1', 'How to Manage Stress', '🧘', [
    P('Stress is a common part of modern life.', "Stress zamonaviy hayotning odatiy qismidir."),
    P('Too much stress can affect our health badly.', "Ortiqcha stress sog'lig'imizga yomon ta'sir qilishi mumkin."),
    P('Exercise is one effective way to reduce stress.', "Jismoniy mashqlar stressni kamaytirishning samarali usullaridan biri."),
    P('Talking to friends can also help a lot.', "Do'stlar bilan gaplashish ham juda yordam berishi mumkin."),
    P('It is important to take breaks during the day.', 'Kun davomida tanaffus qilish muhim.'),
    P('Managing stress leads to a happier life.', "Stressni boshqarish baxtliroq hayotga olib keladi."),
  ]),
  episode('b1', 'Success and Failure', '🏆', [
    P('Everyone experiences both success and failure in life.', "Har bir inson hayotda ham muvaffaqiyat, ham muvaffaqiyatsizlikni boshdan kechiradi."),
    P('Failure can actually teach us valuable lessons.', "Muvaffaqiyatsizlik aslida bizga qimmatli saboqlar berishi mumkin."),
    P('Many successful people failed many times before.', "Ko'plab muvaffaqiyatli odamlar avval ko'p marta muvaffaqiyatsizlikka uchragan."),
    P('The key is to learn and keep trying.', "Muhimi, o'rganish va harakat qilishda davom etish."),
    P('Success often comes after many attempts.', "Muvaffaqiyat ko'pincha ko'p urinishlardan keyin keladi."),
    P('We should not be afraid of failing.', "Biz muvaffaqiyatsizlikdan qo'rqmasligimiz kerak."),
  ]),
  episode('b1', 'The Importance of Reading', '📚', [
    P('Reading books has many important benefits.', "Kitob o'qishning ko'plab muhim foydalari bor."),
    P('It improves our vocabulary and knowledge.', "U bizning lug'atimiz va bilimimizni oshiradi."),
    P('Reading also helps us relax and reduce stress.', "O'qish shuningdek dam olish va stressni kamaytirishga yordam beradi."),
    P('Unfortunately, many people read less than before.', "Afsuski, ko'p odamlar avvalgidan kamroq o'qiydi."),
    P('Phones and social media take up our reading time.', "Telefonlar va ijtimoiy tarmoqlar o'qish vaqtimizni egallaydi."),
    P('We should try to read a little every day.', "Biz har kuni ozgina o'qishga harakat qilishimiz kerak."),
  ]),
  episode('b1', 'Travel and Culture', '🌍', [
    P('Traveling helps us understand different cultures.', "Sayohat qilish bizga turli madaniyatlarni tushunishga yordam beradi."),
    P('We learn new languages, food, and traditions.', "Biz yangi tillar, taomlar va urf-odatlarni o'rganamiz."),
    P('Meeting local people gives us new perspectives.', "Mahalliy odamlar bilan uchrashish bizga yangi qarashlar beradi."),
    P('Traveling can also make us more open-minded.', "Sayohat qilish bizni ochiqroq fikrli qilishi ham mumkin."),
    P('Every trip teaches something valuable about the world.', "Har bir sayohat dunyo haqida qimmatli narsa o'rgatadi."),
    P('Culture connects people across different countries.', "Madaniyat turli mamlakatlardagi odamlarni bog'laydi."),
  ]),
  episode('b1', 'Environmental Problems', '🌱', [
    P('Our planet is facing serious environmental problems.', "Bizning sayyoramiz jiddiy ekologik muammolarga duch kelmoqda."),
    P('Pollution and climate change harm nature every day.', "Ifloslanish va iqlim o'zgarishi har kuni tabiatga zarar yetkazadi."),
    P('Many animals are losing their natural habitats.', "Ko'plab hayvonlar o'zlarining tabiiy yashash joylarini yo'qotmoqda."),
    P('We must reduce waste and save energy.', "Biz chiqindilarni kamaytirishimiz va energiyani tejashimiz kerak."),
    P('Small actions can make a real difference.', "Kichik harakatlar haqiqiy farq qilishi mumkin."),
    P('Protecting the environment is everyone\'s responsibility.', "Atrof-muhitni himoya qilish hammaning mas'uliyati."),
  ]),
  episode('b1', 'Artificial Intelligence Today', '🤖', [
    P('Artificial intelligence is becoming part of everyday life.', "Sun'iy intellekt kundalik hayotimizning bir qismiga aylanmoqda."),
    P('It helps us with translation, work, and learning.', "U bizga tarjima, ish va o'rganishda yordam beradi."),
    P('Some people worry it might replace human jobs.', "Ba'zi odamlar u inson ishlarini almashtirishidan xavotirlanadi."),
    P('Others believe it will create new opportunities.', "Boshqalar esa u yangi imkoniyatlar yaratadi deb hisoblaydi."),
    P('AI is a powerful tool if used responsibly.', "Sun'iy intellekt mas'uliyat bilan ishlatilsa, kuchli qurol."),
    P('The future will depend on how we use it.', "Kelajak uni qanday ishlatishimizga bog'liq bo'ladi."),
  ]),
  episode('b1', 'Starting a Business', '💡', [
    P('Starting a business requires courage and planning.', "Biznes boshlash jasorat va rejalashtirishni talab qiladi."),
    P('Many entrepreneurs face financial challenges at first.', "Ko'p tadbirkorlar avvaliga moliyaviy qiyinchiliklarga duch keladi."),
    P('A good idea alone is not always enough.', "Yaxshi g'oyaning o'zi har doim ham yetarli emas."),
    P('You also need hard work and patience.', 'Sizga qattiq mehnat va sabr ham kerak.'),
    P('Learning from mistakes helps a business grow.', "Xatolardan o'rganish biznesning rivojlanishiga yordam beradi."),
    P('Many successful companies started very small.', "Ko'plab muvaffaqiyatli kompaniyalar juda kichikdan boshlangan."),
  ]),
  episode('b1', 'Healthy Lifestyle Choices', '🥗', [
    P('Living a healthy lifestyle takes daily effort.', "Sog'lom turmush tarzini olib borish har kunlik harakatni talab qiladi."),
    P('Eating balanced meals keeps our body strong.', "Muvozanatli ovqatlanish tanamizni baquvvat saqlaydi."),
    P('Regular exercise improves both body and mind.', "Muntazam mashqlar tana va aqlni yaxshilaydi."),
    P('Good sleep is just as important as diet.', "Yaxshi uyqu ovqatlanish kabi muhimdir."),
    P('Small daily choices add up over time.', "Kichik kundalik tanlovlar vaqt o'tishi bilan yig'iladi."),
    P('A healthy lifestyle leads to a happier life.', "Sog'lom turmush tarzi baxtliroq hayotga olib keladi."),
  ]),
  episode('b1', 'Goals for the Future', '🎯', [
    P('Setting goals gives our life direction and purpose.', "Maqsad qo'yish hayotimizga yo'nalish va maqsad beradi."),
    P('I want to improve my English and travel more.', "Men ingliz tilimni yaxshilashni va ko'proq sayohat qilishni xohlayman."),
    P('Achieving goals requires patience and daily effort.', "Maqsadlarga erishish sabr va kunlik harakatni talab qiladi."),
    P('Sometimes we face obstacles along the way.', "Ba'zan yo'lda to'siqlarga duch kelamiz."),
    P('But every small step brings us closer to success.', "Ammo har bir kichik qadam bizni muvaffaqiyatga yaqinlashtiradi."),
    P('I believe the future can be bright with effort.', "Men harakat bilan kelajak yorqin bo'lishi mumkinligiga ishonaman."),
  ]),
];

export function getPodcastEpisodesByLevel(level: PodcastLevel): PodcastEpisode[] {
  return PODCAST_EPISODES.filter((e) => e.level === level);
}
