export type SpeakingLevel = 'easy' | 'medium' | 'hard';

export const SPEAKING_LEVEL_LABELS: Record<SpeakingLevel, string> = {
  easy: 'Oson',
  medium: "O'rtacha",
  hard: 'Qiyin',
};

export const SPEAKING_LEVEL_COLORS: Record<SpeakingLevel, string> = {
  easy: '#34D399',
  medium: '#FBBF24',
  hard: '#F87171',
};

export const SPEAKING_LEVELS_ORDER: SpeakingLevel[] = ['easy', 'medium', 'hard'];

export type DialogueLine = { speaker: string; en: string; uz: string };
export type SpeakingTopic = {
  id: string;
  level: SpeakingLevel;
  title: string;
  description: string;
  emoji: string;
  colors: [string, string];
  lines: DialogueLine[];
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
];

let colorCounter = 0;
function nextColors(): [string, string] {
  const c = COLOR_PAIRS[colorCounter % COLOR_PAIRS.length];
  colorCounter += 1;
  return c;
}

function L(speaker: string, en: string, uz: string): DialogueLine {
  return { speaker, en, uz };
}

function topic(
  level: SpeakingLevel,
  title: string,
  description: string,
  emoji: string,
  lines: DialogueLine[]
): SpeakingTopic {
  return { id: slug(title), level, title, description, emoji, colors: nextColors(), lines };
}

export const SPEAKING_TOPICS: SpeakingTopic[] = [
  // ─── Oson (Easy) — 20 mavzu ─────────────────────────────────────────────
  topic('easy', 'Salomlashish', "Yangi tanishlar bilan qanday salomlashish va tanishishni o'rganing.", '👋', [
    L('Ali', 'Hello! How are you today?', 'Salom! Bugun qandaysiz?'),
    L('Aziza', "I'm fine, thank you. And you?", 'Yaxshiman, rahmat. Sizchi?'),
    L('Ali', "I'm great, thanks. What's your name?", 'Zo\'r, rahmat. Ismingiz nima?'),
    L('Aziza', 'My name is Aziza. Nice to meet you.', 'Mening ismim Aziza. Tanishganimdan xursandman.'),
    L('Ali', 'Nice to meet you too!', 'Men ham tanishganimdan xursandman!'),
  ]),
  topic('easy', "O'zim haqimda", "O'zingiz haqingizda qisqacha gapirishni mashq qiling.", '🧑', [
    L('Aziza', 'Can you tell me about yourself?', "O'zingiz haqingizda gapirib bera olasizmi?"),
    L('Ali', "Sure. I'm 20 years old and I study English.", 'Albatta. Men 20 yoshdaman va ingliz tilini o\'rganaman.'),
    L('Aziza', 'What do you like to do?', 'Nima qilishni yoqtirasiz?'),
    L('Ali', 'I like reading books and playing football.', "Men kitob o'qish va futbol o'ynashni yoqtiraman."),
    L('Aziza', "That's interesting!", 'Bu qiziq ekan!'),
  ]),
  topic('easy', 'Oilam', "Oilangiz haqida gapirishni mashq qiling.", '👨‍👩‍👧‍👦', [
    L('Aziza', 'How many people are in your family?', 'Oilangizda nechta odam bor?'),
    L('Ali', 'There are five of us: my parents, my sister, my brother and me.', "Bizning oilamizda beshta kishi bor: ota-onam, opam, ukam va men."),
    L('Aziza', 'What does your father do?', 'Otangiz nima ish qiladi?'),
    L('Ali', 'He is an engineer. My mother is a teacher.', 'U muhandis. Onam esa o\'qituvchi.'),
    L('Aziza', 'Sounds like a lovely family.', 'Ajoyib oila ekan.'),
  ]),
  topic('easy', "Do'stlarim", "Do'stlaringiz haqida gapirishni mashq qiling.", '🧑‍🤝‍🧑', [
    L('Ali', 'Who is your best friend?', "Eng yaqin do'stingiz kim?"),
    L('Aziza', 'Her name is Dilnoza. We met at school.', "Uning ismi Dilnoza. Biz maktabda tanishganmiz."),
    L('Ali', 'What do you do together?', 'Birga nima qilasizlar?'),
    L('Aziza', 'We study together and go for walks.', 'Birga o\'qiymiz va sayr qilamiz.'),
    L('Ali', "That's a great friendship.", "Bu ajoyib do'stlik ekan."),
  ]),
  topic('easy', 'Kasbim', "Kasbingiz haqida gapirishni mashq qiling.", '💼', [
    L('Aziza', 'What is your profession?', 'Kasbingiz nima?'),
    L('Ali', 'I am a student, but I want to become a doctor.', "Men talabaman, lekin shifokor bo'lishni xohlayman."),
    L('Aziza', 'Why did you choose that profession?', 'Nega shu kasbni tanladingiz?'),
    L('Ali', 'I want to help sick people.', 'Kasal odamlarga yordam bermoqchiman.'),
    L('Aziza', "That's a noble goal.", 'Bu olijanob maqsad ekan.'),
  ]),
  topic('easy', 'Mening kun tartibim', "Kundalik ish-tartibingiz haqida gapirishni mashq qiling.", '⏰', [
    L('Aziza', 'What time do you wake up?', "Soat nechada uyg'onasiz?"),
    L('Ali', 'I wake up at seven and have breakfast.', "Men soat yettida uyg'onaman va nonushta qilaman."),
    L('Aziza', 'What do you do after that?', 'Undan keyin nima qilasiz?'),
    L('Ali', 'I go to school and study until two.', "Maktabga boraman va soat ikkigacha o'qiyman."),
    L('Aziza', 'Sounds like a busy day!', 'Band kun ekan!'),
  ]),
  topic('easy', 'Uyim', "Uyingiz haqida gapirishni mashq qiling.", '🏠', [
    L('Ali', 'Tell me about your house.', 'Uyingiz haqida gapirib bering.'),
    L('Aziza', 'I live in a big house with a garden.', "Men bog'i bor katta uyda yashayman."),
    L('Ali', 'How many rooms does it have?', 'Necha xonasi bor?'),
    L('Aziza', 'It has four rooms and a kitchen.', "Unda to'rtta xona va oshxona bor."),
    L('Ali', 'It sounds cozy.', 'Juda qulay ekan.'),
  ]),
  topic('easy', 'Mening shahrim', "Yashaydigan shahringiz haqida gapirishni mashq qiling.", '🏙️', [
    L('Ali', 'What city are you from?', 'Qaysi shahardansiz?'),
    L('Aziza', "I'm from Tashkent, the capital of Uzbekistan.", "Men O'zbekiston poytaxti Toshkentdanman."),
    L('Ali', 'What do you like about your city?', 'Shahringizning nimasini yoqtirasiz?'),
    L('Aziza', 'I like the parks and the friendly people.', 'Menga parklar va mehribon odamlar yoqadi.'),
    L('Ali', 'Sounds like a great place.', 'Ajoyib joy ekan.'),
  ]),
  topic('easy', 'Telefon orqali suhbat', "Telefon orqali suhbatlashishni mashq qiling.", '📞', [
    L('Ali', 'Hello, this is Ali speaking.', 'Salom, bu Ali gapiryapti.'),
    L('Aziza', 'Hi Ali, how are you?', 'Salom Ali, qalaysiz?'),
    L('Ali', "I'm good. Are you free tomorrow?", "Yaxshiman. Ertaga bo'shmisiz?"),
    L('Aziza', "Yes, I am. What's up?", "Ha, bo'shman. Nima gap?"),
    L('Ali', "Let's meet for coffee.", 'Keling qahva ichishga uchrashamiz.'),
  ]),
  topic('easy', 'Ob-havo', "Ob-havo haqida suhbatlashishni mashq qiling.", '☀️', [
    L('Aziza', "What's the weather like today?", 'Bugun ob-havo qanday?'),
    L('Ali', "It's sunny and warm outside.", 'Tashqarida quyoshli va issiq.'),
    L('Aziza', 'Will it rain tomorrow?', "Ertaga yomg'ir yog'adimi?"),
    L('Ali', 'I heard it might be cloudy.', 'Bulutli bo\'lishi mumkinligini eshitdim.'),
    L('Aziza', 'I hope it stays warm.', 'Issiq davom etsa yaxshi bo\'lardi.'),
  ]),
  topic('easy', "Xarid qilish (Do'konda)", "Do'konda mahsulot sotib olishni mashq qiling.", '🛒', [
    L('Sotuvchi', 'How can I help you?', 'Sizga qanday yordam bera olaman?'),
    L('Xaridor', "I'm looking for some fresh vegetables.", 'Men yangi sabzavotlar qidiryapman.'),
    L('Sotuvchi', 'We have tomatoes and cucumbers today.', 'Bugun bizda pomidor va bodring bor.'),
    L('Xaridor', "Great, I'll take a kilo of each.", "Ajoyib, har biridan bir kilodan olaman."),
    L('Sotuvchi', 'Here you are. That will be 20,000 som.', "Mana. Bu 20,000 so'm bo'ladi."),
  ]),
  topic('easy', 'Kafeda', "Kafeda buyurtma berishni mashq qiling.", '☕', [
    L('Ofitsiant', 'What would you like to drink?', 'Nima ichishni istaysiz?'),
    L('Mijoz', 'A cup of coffee, please.', 'Bir chashka qahva, iltimos.'),
    L('Ofitsiant', 'Would you like anything to eat?', 'Yeyish uchun biror narsa xohlaysizmi?'),
    L('Mijoz', 'Yes, a piece of cake too.', "Ha, bir bo'lak tort ham."),
    L('Ofitsiant', "Sure, I'll bring it right away.", 'Albatta, hozir olib kelaman.'),
  ]),
  topic('easy', 'Restoranda', "Restoranda buyurtma berishni mashq qiling.", '🍽️', [
    L('Ofitsiant', 'Are you ready to order?', 'Buyurtma berishga tayyormisiz?'),
    L('Mijoz', "Yes, I'd like the chicken soup.", "Ha, men tovuq sho'rvasini xohlayman."),
    L('Ofitsiant', 'Would you like something to drink?', 'Ichimlik xohlaysizmi?'),
    L('Mijoz', 'Just water, please.', 'Faqat suv, iltimos.'),
    L('Ofitsiant', 'Alright, it will be ready soon.', 'Yaxshi, tez orada tayyor bo\'ladi.'),
  ]),
  topic('easy', 'Shifokor huzurida', "Shifokor bilan alomatlar haqida gaplashishni mashq qiling.", '🩺', [
    L('Shifokor', 'What seems to be the problem?', 'Muammo nimada ekan?'),
    L('Bemor', 'I have a headache and a cough.', "Boshim og'riyapti va yo'talyapman."),
    L('Shifokor', 'How long have you felt this way?', 'Qancha vaqtdan beri shunday his qilyapsiz?'),
    L('Bemor', 'Since yesterday morning.', 'Kecha ertalabdan beri.'),
    L('Shifokor', "I'll prescribe some medicine for you.", 'Sizga dori yozib beraman.'),
  ]),
  topic('easy', 'Aeroportda', "Aeroportda sayohat haqida ma'lumot so'rashni mashq qiling.", '✈️', [
    L('Xodim', 'Can I see your passport, please?', 'Pasportingizni ko\'rsam bo\'ladimi?'),
    L("Yo'lovchi", 'Here it is.', 'Mana.'),
    L('Xodim', 'The boarding gate is over there.', 'Chiqish darvozasi ana u yerda.'),
    L("Yo'lovchi", 'Thank you, could you tell me the gate number?', 'Rahmat, darvoza raqamini ayta olasizmi?'),
    L('Xodim', "Gate number five.", 'Beshinchi darvoza.'),
  ]),
  topic('easy', 'Mehmonxonada', "Mehmonxonada ro'yxatdan o'tishni mashq qiling.", '🏨', [
    L('Resepshn', 'Welcome! Do you have a reservation?', 'Xush kelibsiz! Broningiz bormi?'),
    L('Mehmon', 'Yes, I have a reservation under my name.', 'Ha, mening nomimga bron qilingan.'),
    L('Resepshn', 'Here is your room key.', 'Mana xonangiz kaliti.'),
    L('Mehmon', 'Thank you. Which floor is it on?', 'Rahmat. Qaysi qavatda joylashgan?'),
    L('Resepshn', "It's on the third floor.", 'Uchinchi qavatda.'),
  ]),
  topic('easy', 'Taksi chaqirish', "Taksi chaqirishni mashq qiling.", '🚕', [
    L('Mijoz', 'Hello, I need a taxi to the airport.', 'Salom, menga aeroportga taksi kerak.'),
    L('Haydovchi', 'Sure, what is your address?', 'Albatta, manzilingiz qayerda?'),
    L('Mijoz', "I'm on Amir Temur street.", "Men Amir Temur ko'chasidaman."),
    L('Haydovchi', "Okay, I'll be there in ten minutes.", "Yaxshi, o'n daqiqada yetib boraman."),
    L('Mijoz', 'Thank you very much.', 'Katta rahmat.'),
  ]),
  topic('easy', "Yo'l so'rash", "Yo'nalish so'rashni mashq qiling.", '🧭', [
    L('Ali', 'Excuse me, how do I get to the museum?', "Kechirasiz, muzeyga qanday borsam bo'ladi?"),
    L('Aziza', 'Go straight and turn left.', "To'g'riga yuring va chapga buriling."),
    L('Ali', 'Is it far from here?', 'Bu yerdan uzoqmi?'),
    L('Aziza', "No, it's about five minutes away.", 'Yo\'q, bu yerdan besh daqiqacha.'),
    L('Ali', 'Thank you for your help.', 'Yordamingiz uchun rahmat.'),
  ]),
  topic('easy', "Bo'sh vaqt", "Bo'sh vaqtingiz haqida gapirishni mashq qiling.", '🎮', [
    L('Ali', 'What do you do in your free time?', "Bo'sh vaqtingizda nima qilasiz?"),
    L('Aziza', 'I like watching movies and drawing.', 'Menga kino ko\'rish va rasm chizish yoqadi.'),
    L('Ali', 'Do you play any sports?', "Biror sport bilan shug'ullanasizmi?"),
    L('Aziza', 'Yes, I play volleyball on weekends.', "Ha, dam olish kunlari voleybol o'ynayman."),
    L('Ali', 'That sounds fun!', 'Bu qiziqarli ekan!'),
  ]),
  topic('easy', 'Sevimli filmim', "Sevimli filmingiz haqida gapirishni mashq qiling.", '🎬', [
    L('Aziza', 'What is your favorite movie?', 'Sevimli filmingiz qaysi?'),
    L('Ali', 'I love "Interstellar." It\'s about space travel.', 'Menga "Interstellar" yoqadi. U kosmik sayohat haqida.'),
    L('Aziza', 'Why do you like it so much?', 'Nega u sizga shunchalik yoqadi?'),
    L('Ali', 'The story and music are amazing.', 'Syujeti va musiqasi ajoyib.'),
    L('Aziza', 'I should watch it too.', "Men ham uni ko'rishim kerak."),
  ]),

  // ─── O'rtacha (Medium) — 20 mavzu ───────────────────────────────────────
  topic('medium', "Ta'til rejalari", "Ta'til rejalari haqida gapirishni mashq qiling.", '🏖️', [
    L('Aziza', 'Do you have any plans for your vacation?', 'Ta\'tilingiz uchun rejalaringiz bormi?'),
    L('Ali', "Yes, I'm planning to visit the seaside.", "Ha, dengiz bo'yiga borishni rejalashtiryapman."),
    L('Aziza', 'How long will you stay there?', 'U yerda qancha vaqt qolasiz?'),
    L('Ali', 'About a week, with my family.', "Oilam bilan bir haftacha."),
    L('Aziza', 'That sounds relaxing.', 'Bu dam oluvchi ekan.'),
  ]),
  topic('medium', 'Sayohat', "Sayohat tajribalaringiz haqida gapirishni mashq qiling.", '🧳', [
    L('Ali', 'Have you traveled to another country?', 'Boshqa mamlakatga sayohat qilganmisiz?'),
    L('Aziza', 'Yes, I visited Turkey last year.', "Ha, o'tgan yili Turkiyaga bordim."),
    L('Ali', 'What did you like most about it?', 'Sizga u yerda eng nimasi yoqdi?'),
    L('Aziza', 'The historical places were amazing.', 'Tarixiy joylar ajoyib edi.'),
    L('Ali', "I'd love to go there someday.", "Men ham bir kun u yerga borishni istardim."),
  ]),
  topic('medium', 'Universitet hayoti', "Universitet hayotingiz haqida gapirishni mashq qiling.", '🎓', [
    L('Ali', 'How is your university life going?', 'Universitet hayotingiz qanday kechyapti?'),
    L('Aziza', "It's busy but interesting.", 'Band, lekin qiziqarli.'),
    L('Ali', 'What subject are you studying?', "Qaysi fanni o'qiyapsiz?"),
    L('Aziza', "I'm studying economics.", "Men iqtisodiyotni o'qiyapman."),
    L('Ali', "That's a useful field.", 'Bu foydali soha ekan.'),
  ]),
  topic('medium', 'Ish suhbati', "Ish suhbatida qanday javob berishni mashq qiling.", '🧑‍💼', [
    L('Ishga oluvchi', 'Why do you want this job?', 'Nega shu ishni xohlaysiz?'),
    L('Nomzod', 'I have experience and I enjoy this field.', 'Menda tajriba bor va bu sohani yoqtiraman.'),
    L('Ishga oluvchi', 'What are your strengths?', 'Kuchli tomonlaringiz nima?'),
    L('Nomzod', 'I am hardworking and reliable.', 'Men mehnatsevar va ishonchli insonman.'),
    L('Ishga oluvchi', 'Thank you, we will contact you.', "Rahmat, siz bilan bog'lanamiz."),
  ]),
  topic('medium', 'Sport va sog\'lom turmush', "Sport va sog'lom turmush haqida gapirishni mashq qiling.", '🏃', [
    L('Aziza', 'Do you exercise regularly?', 'Muntazam mashq qilasizmi?'),
    L('Ali', 'Yes, I run every morning.', 'Ha, har kuni ertalab yuguraman.'),
    L('Aziza', 'Does it help you feel better?', "Bu o'zingizni yaxshi his qilishga yordam beradimi?"),
    L('Ali', 'Definitely, it gives me energy.', 'Albatta, menga energiya beradi.'),
    L('Aziza', 'I should start exercising too.', 'Men ham mashq qila boshlashim kerak.'),
  ]),
  topic('medium', 'Texnologiya', "Texnologiya hayotimizga qanday ta'sir qilishi haqida gapirishni mashq qiling.", '💻', [
    L('Ali', 'How has technology changed your life?', 'Texnologiya hayotingizni qanday o\'zgartirdi?'),
    L('Aziza', 'It helps me study and communicate easily.', "U menga o'qish va muloqot qilishda yordam beradi."),
    L('Ali', 'Do you think it has any downsides?', 'Uning salbiy tomonlari ham bor deb o\'ylaysizmi?'),
    L('Aziza', 'Yes, people spend too much time on phones.', "Ha, odamlar telefonda juda ko'p vaqt sarflaydi."),
    L('Ali', "That's true.", 'Bu haqiqat.'),
  ]),
  topic('medium', 'Ijtimoiy tarmoqlar', "Ijtimoiy tarmoqlardan foydalanish haqida gapirishni mashq qiling.", '📱', [
    L('Aziza', 'How much time do you spend on social media?', "Ijtimoiy tarmoqlarda qancha vaqt o'tkazasiz?"),
    L('Ali', 'Probably an hour a day.', 'Kuniga taxminan bir soat.'),
    L('Aziza', 'What do you use it for?', 'Uni nima uchun ishlatasiz?'),
    L('Ali', 'Mostly to talk with friends and read news.', "Ko'pincha do'stlar bilan gaplashish va yangiliklar o'qish uchun."),
    L('Aziza', 'Same here.', 'Men ham xuddi shunday.'),
  ]),
  topic('medium', 'Kitoblar', "Sevimli kitoblaringiz haqida gapirishni mashq qiling.", '📚', [
    L('Ali', 'Do you enjoy reading books?', "Kitob o'qishni yoqtirasizmi?"),
    L('Aziza', 'Yes, I read every night before bed.', 'Ha, har kecha uxlashdan oldin o\'qiyman.'),
    L('Ali', 'What kind of books do you like?', 'Qanday kitoblarni yoqtirasiz?'),
    L('Aziza', 'I love mystery and adventure stories.', 'Menga sirli va sarguzasht hikoyalar yoqadi.'),
    L('Ali', 'I should try reading more too.', "Men ham ko'proq o'qishga harakat qilishim kerak."),
  ]),
  topic('medium', 'Musiqa', "Sevimli musiqangiz haqida gapirishni mashq qiling.", '🎵', [
    L('Aziza', 'What kind of music do you listen to?', 'Qanday musiqa tinglaysiz?'),
    L('Ali', 'I usually listen to pop and jazz.', 'Odatda pop va jaz musiqasini tinglayman.'),
    L('Aziza', 'Do you play any instruments?', 'Biror asbobda chalasizmi?'),
    L('Ali', 'Yes, I play the guitar a little.', 'Ha, gitarada ozgina chalaman.'),
    L('Aziza', "That's impressive!", 'Bu ajoyib!'),
  ]),
  topic('medium', "Ta'lim", "Ta'lim va uning ahamiyati haqida gapirishni mashq qiling.", '🏫', [
    L('Ali', 'Why is education important to you?', 'Ta\'lim siz uchun nega muhim?'),
    L('Aziza', 'It helps me achieve my goals in life.', "U menga hayotdagi maqsadlarga erishishga yordam beradi."),
    L('Ali', 'What do you want to study in the future?', 'Kelajakda nimani o\'qishni xohlaysiz?'),
    L('Aziza', 'I want to study medicine.', "Men tibbiyotni o'qishni xohlayman."),
    L('Ali', "That's a great choice.", 'Bu ajoyib tanlov.'),
  ]),
  topic('medium', 'Onlayn xarid', "Onlayn xarid tajribangiz haqida gapirishni mashq qiling.", '🛍️', [
    L('Aziza', 'Do you often shop online?', 'Tez-tez onlayn xarid qilasizmi?'),
    L('Ali', "Yes, it's fast and convenient.", 'Ha, bu tez va qulay.'),
    L('Aziza', 'What was the last thing you bought?', 'Oxirgi marta nima sotib oldingiz?'),
    L('Ali', 'I bought a new pair of shoes.', 'Men yangi poyabzal sotib oldim.'),
    L('Aziza', 'Did it arrive on time?', "U o'z vaqtida yetib keldimi?"),
    L('Ali', 'Yes, in just two days.', 'Ha, atigi ikki kunda.'),
  ]),
  topic('medium', 'Bankda', "Bankda hisob ochishni mashq qiling.", '🏦', [
    L('Xodim', 'How can I help you today?', 'Bugun sizga qanday yordam bera olaman?'),
    L('Mijoz', "I'd like to open a new account.", 'Yangi hisob ochmoqchiman.'),
    L('Xodim', 'Sure, may I see your ID?', 'Albatta, hujjatingizni ko\'rsam bo\'ladimi?'),
    L('Mijoz', 'Here you go.', 'Mana.'),
    L('Xodim', 'Great, it will be ready in a few minutes.', 'Ajoyib, bir necha daqiqada tayyor bo\'ladi.'),
  ]),
  topic('medium', 'Pochta xizmatlari', "Pochta orqali jo'natma yuborishni mashq qiling.", '📮', [
    L('Mijoz', 'I want to send this package abroad.', "Men bu jo'natmani chet elga yubormoqchiman."),
    L('Xodim', 'Sure, please fill in this form.', 'Albatta, iltimos shu formani to\'ldiring.'),
    L('Mijoz', 'How long will it take to arrive?', 'U yetib borishi qancha vaqt oladi?'),
    L('Xodim', 'Usually about a week.', 'Odatda taxminan bir hafta.'),
    L('Mijoz', 'Thank you for the information.', "Ma'lumot uchun rahmat."),
  ]),
  topic('medium', 'Muammo va shikoyatlar', "Shikoyat bildirishni mashq qiling.", '😤', [
    L('Mijoz', 'I have a problem with my order.', 'Buyurtmam bilan muammo bor.'),
    L('Xodim', "I'm sorry to hear that. What happened?", 'Buni eshitib afsusdaman. Nima bo\'ldi?'),
    L('Mijoz', 'I received the wrong item.', "Men noto'g'ri mahsulot oldim."),
    L('Xodim', 'We will send the correct one right away.', "Biz to'g'risini darhol yuboramiz."),
    L('Mijoz', 'Thank you for solving this quickly.', 'Buni tezda hal qilganingiz uchun rahmat.'),
  ]),
  topic('medium', 'Tadbir tashkil qilish', "Tadbir rejalashtirishni mashq qiling.", '🎉', [
    L('Ali', 'We need to organize the graduation party.', 'Bitiruv bazmini tashkil qilishimiz kerak.'),
    L('Aziza', 'I can take care of the decorations.', 'Men bezaklar bilan shug\'ullanaman.'),
    L('Ali', "I'll handle the music and food.", 'Men musiqa va ovqat bilan shug\'ullanaman.'),
    L('Aziza', "Great, let's meet tomorrow to plan more.", "Ajoyib, ko'proq rejalashtirish uchun ertaga uchrashamiz."),
    L('Ali', 'Sounds good to me.', 'Menga mos.'),
  ]),
  topic('medium', "Tug'ilgan kun", "Tug'ilgan kuningizni qanday nishonlashingiz haqida gapirishni mashq qiling.", '🎂', [
    L('Aziza', 'When is your birthday?', 'Tug\'ilgan kuningiz qachon?'),
    L('Ali', "It's on the 15th of May.", '15-may kuni.'),
    L('Aziza', 'How do you usually celebrate it?', 'Uni odatda qanday nishonlaysiz?'),
    L('Ali', 'I celebrate with family and a big cake.', 'Men uni oilam bilan va katta tort bilan nishonlayman.'),
    L('Aziza', 'That sounds lovely.', 'Bu juda yoqimli ekan.'),
  ]),
  topic('medium', 'Kelajak rejalari', "Kelajakdagi rejalaringiz haqida gapirishni mashq qiling.", '🔭', [
    L('Ali', 'What are your plans for the future?', 'Kelajak uchun rejalaringiz qanday?'),
    L('Aziza', 'I want to finish university and travel the world.', 'Universitetni tugatib, dunyo bo\'ylab sayohat qilmoqchiman.'),
    L('Ali', 'That sounds exciting.', 'Bu qiziqarli ekan.'),
    L('Aziza', 'What about you?', 'Sizchi?'),
    L('Ali', 'I want to start my own business.', "Men o'z biznesimni boshlashni xohlayman."),
  ]),
  topic('medium', 'Bolalik xotiralari', "Bolalik xotiralaringiz haqida gapirishni mashq qiling.", '🧸', [
    L('Aziza', 'What is your favorite childhood memory?', 'Bolalikdagi eng sevimli xotirangiz nima?'),
    L('Ali', 'Playing football with my friends every evening.', "Har kuni kechqurun do'stlarim bilan futbol o'ynash."),
    L('Aziza', 'That sounds like a happy time.', 'Bu baxtli davr bo\'lgan ekan.'),
    L('Ali', 'Yes, I miss those days.', "Ha, o'sha kunlarni sog'inaman."),
    L('Aziza', 'Me too.', 'Men ham.'),
  ]),
  topic('medium', 'Madaniyat va urf-odatlar', "Milliy urf-odatlaringiz haqida gapirishni mashq qiling.", '🎎', [
    L('Ali', 'What traditions does your family celebrate?', "Oilangiz qanday urf-odatlarni nishonlaydi?"),
    L('Aziza', 'We celebrate Navruz every spring.', "Biz har bahorda Navro'zni nishonlaymiz."),
    L('Ali', 'What do you do on that day?', "O'sha kuni nima qilasizlar?"),
    L('Aziza', 'We cook sumalak and visit relatives.', 'Sumalak pishiramiz va qarindoshlarga boramiz.'),
    L('Ali', 'That sounds wonderful.', 'Bu ajoyib ekan.'),
  ]),
  topic('medium', 'Mening orzuim', "Eng katta orzuingiz haqida gapirishni mashq qiling.", '⭐', [
    L('Aziza', 'What is your biggest dream?', 'Eng katta orzuingiz nima?'),
    L('Ali', 'I dream of becoming a successful engineer.', "Men muvaffaqiyatli muhandis bo'lishni orzu qilaman."),
    L('Aziza', 'What steps are you taking to achieve it?', "Unga erishish uchun qanday qadamlar qo'yyapsiz?"),
    L('Ali', 'I study hard and practice every day.', 'Men qattiq o\'qiyman va har kuni mashq qilaman.'),
    L('Aziza', "I'm sure you'll achieve it.", 'Ishonchim komilki, siz unga erishasiz.'),
  ]),

  // ─── Qiyin (Hard) — 20 mavzu ────────────────────────────────────────────
  topic('hard', "Sun'iy intellekt", "Sun'iy intellekt haqida fikr almashishni mashq qiling.", '🤖', [
    L('Ali', 'Do you think AI will change our future?', "Sun'iy intellekt kelajagimizni o'zgartiradi deb o'ylaysizmi?"),
    L('Aziza', "Definitely, it's already changing many industries.", "Albatta, u allaqachon ko'plab sohalarni o'zgartiryapti."),
    L('Ali', 'Are you worried it might replace jobs?', 'U ish o\'rinlarini almashtirishidan xavotirdamisiz?'),
    L('Aziza', 'A little, but it also creates new opportunities.', 'Ozgina, lekin u yangi imkoniyatlar ham yaratadi.'),
    L('Ali', 'I hope we can use it wisely.', "Undan oqilona foydalana olishimizga umid qilaman."),
  ]),
  topic('hard', 'Masofaviy ish', "Masofadan ishlash haqida fikr almashishni mashq qiling.", '🏡', [
    L('Ali', 'Would you prefer working remotely?', 'Masofadan ishlashni afzal ko\'rasizmi?'),
    L('Aziza', 'Yes, it gives me more flexibility.', 'Ha, bu menga ko\'proq erkinlik beradi.'),
    L('Ali', "But doesn't it feel lonely sometimes?", 'Lekin ba\'zan yolg\'iz his qilmaysizmi?'),
    L('Aziza', 'Sometimes, but video calls help a lot.', "Ba'zan, lekin video qo'ng'iroqlar juda yordam beradi."),
    L('Ali', 'That makes sense.', 'Bu mantiqiy.'),
  ]),
  topic('hard', 'Global isish', "Global isish muammosi haqida fikr almashishni mashq qiling.", '🌡️', [
    L('Aziza', 'Global warming is becoming a serious problem.', "Global isish jiddiy muammoga aylanmoqda."),
    L('Ali', 'Yes, we need to reduce pollution urgently.', "Ha, ifloslanishni shoshilinch ravishda kamaytirishimiz kerak."),
    L('Aziza', 'What can individuals do to help?', 'Odamlar yordam berish uchun nima qila oladi?'),
    L('Ali', 'We can use less plastic and save energy.', "Kamroq plastik ishlatishimiz va energiyani tejashimiz mumkin."),
    L('Aziza', 'Every small action counts.', 'Har bir kichik harakat muhim.'),
  ]),
  topic('hard', 'Atrof-muhit muammolari', "Ekologik muammolar haqida fikr almashishni mashq qiling.", '🌍', [
    L('Ali', 'What environmental problem worries you most?', 'Sizni eng ko\'p qaysi ekologik muammo tashvishga solyapti?'),
    L('Aziza', 'Air pollution in big cities worries me.', 'Katta shaharlardagi havo ifloslanishi meni tashvishga solyapti.'),
    L('Ali', 'What solutions do you suggest?', 'Qanday yechimlar taklif qilasiz?'),
    L('Aziza', 'Planting more trees and using public transport.', "Ko'proq daraxt ekish va jamoat transportidan foydalanish."),
    L('Ali', 'Those are great ideas.', "Bular ajoyib g'oyalar."),
  ]),
  topic('hard', 'Migratsiya', "Migratsiya mavzusida fikr almashishni mashq qiling.", '🧳', [
    L('Aziza', 'Why do many people migrate to other countries?', "Nega ko'p odamlar boshqa mamlakatlarga ko'chib o'tishadi?"),
    L('Ali', 'They usually look for better jobs and education.', "Ular odatda yaxshiroq ish va ta'lim izlaydi."),
    L('Aziza', 'Do you think migration has more benefits or problems?', 'Migratsiyaning foydasi ko\'pmi yoki muammosi?'),
    L('Ali', 'It has both, depending on the situation.', 'Vaziyatga qarab ikkalasi ham bor.'),
    L('Aziza', "That's a fair point.", 'Bu haqqoniy fikr.'),
  ]),
  topic('hard', 'Biznes va tadbirkorlik', "Biznes va tadbirkorlik haqida fikr almashishni mashq qiling.", '💡', [
    L('Ali', 'Have you ever thought about starting a business?', 'Biznes boshlash haqida o\'ylab ko\'rganmisiz?'),
    L('Aziza', 'Yes, I want to open a small cafe someday.', "Ha, bir kun kichik kafe ochishni xohlayman."),
    L('Ali', 'What challenges do entrepreneurs usually face?', "Tadbirkorlar odatda qanday qiyinchiliklarga duch keladi?"),
    L('Aziza', 'Finding money and customers is often difficult.', "Pul va mijozlarni topish ko'pincha qiyin bo'ladi."),
    L('Ali', 'But the results can be rewarding.', 'Lekin natijalar arziydigan bo\'lishi mumkin.'),
  ]),
  topic('hard', 'Yetakchilik', "Yetakchilik fazilatlari haqida fikr almashishni mashq qiling.", '🧑‍✈️', [
    L('Aziza', 'What makes a good leader?', 'Yaxshi yetakchini nima qiladi?'),
    L('Ali', 'A good leader listens and supports their team.', "Yaxshi yetakchi tinglaydi va o'z jamoasini qo'llab-quvvatlaydi."),
    L('Aziza', 'Have you ever led a team?', 'Siz jamoaga boshchilik qilganmisiz?'),
    L('Ali', 'Yes, I led a project at university.', "Ha, universitetda bir loyihaga boshchilik qilganman."),
    L('Aziza', 'What did you learn from it?', 'Undan nima o\'rgandingiz?'),
    L('Ali', 'I learned patience and communication skills.', "Sabr va muloqot ko'nikmalarini o'rgandim."),
  ]),
  topic('hard', 'Pul baxt keltiradimi?', "Pul va baxt mavzusida fikr almashishni mashq qiling.", '💰', [
    L('Aziza', 'Do you think money brings happiness?', 'Pul baxt keltiradi deb o\'ylaysizmi?'),
    L('Ali', "It helps, but it isn't everything.", 'U yordam beradi, lekin hammasi emas.'),
    L('Aziza', 'What else is important for happiness?', 'Baxt uchun yana nima muhim?'),
    L('Ali', 'Good health and relationships matter a lot.', "Yaxshi sog'liq va munosabatlar juda muhim."),
    L('Aziza', 'I completely agree.', 'Men bilan to\'liq roziman.'),
  ]),
  topic('hard', 'Universitet kerakmi?', "Universitet zarurligi haqida fikr almashishni mashq qiling.", '🎓', [
    L('Ali', 'Do you think university is necessary for success?', 'Universitet muvaffaqiyat uchun zarur deb o\'ylaysizmi?'),
    L('Aziza', 'Not always, but it opens many doors.', "Har doim ham emas, lekin u ko'p eshiklarni ochadi."),
    L('Ali', 'Can people succeed without a degree?', 'Odamlar diplomasiz muvaffaqiyat qozonishi mumkinmi?'),
    L('Aziza', 'Yes, with skills and hard work.', 'Ha, ko\'nikma va mehnat bilan.'),
    L('Ali', "That's true in many cases.", "Bu ko'p hollarda to'g'ri."),
  ]),
  topic('hard', 'Texnologiyaning salbiy tomonlari', "Texnologiyaning salbiy ta'siri haqida fikr almashishni mashq qiling.", '⚠️', [
    L('Aziza', 'What are the negative sides of technology?', "Texnologiyaning salbiy tomonlari nima?"),
    L('Ali', 'It can make people addicted to screens.', "U odamlarni ekranga qaram qilib qo'yishi mumkin."),
    L('Aziza', 'Does it affect real relationships?', 'Bu haqiqiy munosabatlarga ta\'sir qiladimi?'),
    L('Ali', 'Yes, people talk less face to face now.', "Ha, odamlar hozir yuzma-yuz kamroq gaplashadi."),
    L('Aziza', 'We should use it more carefully.', "Biz undan ehtiyotroq foydalanishimiz kerak."),
  ]),
  topic('hard', 'Ijtimoiy tengsizlik', "Ijtimoiy tengsizlik mavzusida fikr almashishni mashq qiling.", '⚖️', [
    L('Ali', 'Why does social inequality still exist?', 'Nega ijtimoiy tengsizlik hali ham mavjud?'),
    L('Aziza', 'Unequal access to education is a big reason.', "Ta'limga teng bo'lmagan imkoniyat katta sabab."),
    L('Ali', 'What can governments do about it?', 'Hukumatlar bu haqda nima qila oladi?'),
    L('Aziza', 'They can provide free education and healthcare.', "Ular bepul ta'lim va sog'liqni saqlashni ta'minlashi mumkin."),
    L('Ali', 'That would help a lot.', 'Bu juda yordam berardi.'),
  ]),
  topic('hard', 'Kelajak kasblari', "Kelajak kasblari haqida fikr almashishni mashq qiling.", '🚀', [
    L('Aziza', 'What professions do you think will be popular in the future?', 'Kelajakda qaysi kasblar mashhur bo\'ladi deb o\'ylaysiz?'),
    L('Ali', 'I think jobs related to technology and AI will grow.', "Menimcha, texnologiya va sun'iy intellekt bilan bog'liq ishlar o'sadi."),
    L('Aziza', 'What about traditional jobs?', "An'anaviy kasblarchi?"),
    L('Ali', 'Some may disappear, but new ones will appear.', "Ba'zilari yo'qolishi mumkin, lekin yangilari paydo bo'ladi."),
    L('Aziza', 'The world is changing fast.', "Dunyo tez o'zgaryapti."),
  ]),
  topic('hard', 'Muvaffaqiyat siri', "Muvaffaqiyat siri haqida fikr almashishni mashq qiling.", '🏆', [
    L('Ali', 'What do you think is the secret of success?', 'Muvaffaqiyat sirini nima deb o\'ylaysiz?'),
    L('Aziza', 'Hard work and never giving up.', "Mehnat va hech qachon taslim bo'lmaslik."),
    L('Ali', 'Is talent important too?', "Iste'dod ham muhimmi?"),
    L('Aziza', 'Yes, but effort matters more in the end.', "Ha, lekin oxir-oqibat harakat ko'proq ahamiyatga ega."),
    L('Ali', 'I agree completely.', "Men to'liq qo'shilaman."),
  ]),
  topic('hard', 'Stress va mental salomatlik', "Stress va ruhiy salomatlik haqida fikr almashishni mashq qiling.", '🧠', [
    L('Aziza', 'How do you deal with stress?', 'Stress bilan qanday kurashasiz?'),
    L('Ali', 'I exercise and talk to my friends.', "Mashq qilaman va do'stlarim bilan gaplashaman."),
    L('Aziza', 'Do you think mental health is taken seriously enough?', 'Ruhiy salomatlik yetarlicha jiddiy qabul qilinadi deb o\'ylaysizmi?'),
    L('Ali', 'No, I think we need to talk about it more.', "Yo'q, menimcha biz bu haqda ko'proq gaplashishimiz kerak."),
    L('Aziza', 'I completely agree with you.', "Men siz bilan to'liq roziman."),
  ]),
  topic('hard', 'Media va propaganda', "Media va uning ta'siri haqida fikr almashishni mashq qiling.", '📰', [
    L('Ali', 'Do you trust everything you see in the media?', "Ommaviy axborot vositalarida ko'rgan hamma narsaga ishonasizmi?"),
    L('Aziza', 'No, I always check the information first.', "Yo'q, men avval ma'lumotni tekshiraman."),
    L('Ali', 'Why is that important?', 'Bu nega muhim?'),
    L('Aziza', 'Because some news can be false or biased.', "Chunki ba'zi yangiliklar noto'g'ri yoki tarafkash bo'lishi mumkin."),
    L('Ali', "That's a wise approach.", 'Bu oqilona yondashuv.'),
  ]),
  topic('hard', "Kosmosni o'rganish", "Kosmosni o'rganish haqida fikr almashishni mashq qiling.", '🛰️', [
    L('Aziza', 'Do you think humans will live on Mars someday?', "Odamlar bir kun Marsda yashaydi deb o'ylaysizmi?"),
    L('Ali', "It's possible with the technology we have now.", 'Hozirgi texnologiya bilan bu mumkin.'),
    L('Aziza', 'Why do we spend so much money on space exploration?', "Nega kosmosni o'rganishga shuncha pul sarflaymiz?"),
    L('Ali', 'It helps us discover new resources and knowledge.', "Bu bizga yangi resurslar va bilimlarni kashf qilishga yordam beradi."),
    L('Aziza', "That's a fascinating field.", 'Bu ajoyib soha ekan.'),
  ]),
  topic('hard', "Robotlar odam o'rnini bosadimi?", "Robotlashtirish mavzusida fikr almashishni mashq qiling.", '🦾', [
    L('Ali', 'Do you think robots will replace human workers?', 'Robotlar inson ishchilarini almashtiradi deb o\'ylaysizmi?'),
    L('Aziza', 'In some jobs, yes, but not all of them.', "Ba'zi ishlarda ha, lekin barchasida emas."),
    L('Ali', 'Which jobs are safe from automation?', 'Qaysi ishlar avtomatlashtirishdan xavfsiz?'),
    L('Aziza', 'Jobs that need creativity and empathy.', "Ijodkorlik va hamdardlikni talab qiladigan ishlar."),
    L('Ali', 'That makes sense to me.', 'Bu menga mantiqiy tuyuldi.'),
  ]),
  topic('hard', "Zamonaviy ta'lim", "Zamonaviy ta'lim tizimi haqida fikr almashishni mashq qiling.", '💻', [
    L('Aziza', 'How has modern education changed compared to before?', 'Zamonaviy ta\'lim avvalgisiga nisbatan qanday o\'zgargan?'),
    L('Ali', 'Now we can learn online from anywhere.', "Endi biz istalgan joydan onlayn o'rganishimiz mumkin."),
    L('Aziza', 'Do you think it is more effective?', 'Bu samaraliroq deb o\'ylaysizmi?'),
    L('Ali', "It depends on the student's discipline.", "Bu talabaning intizomiga bog'liq."),
    L('Aziza', "That's a good point.", 'Bu yaxshi fikr.'),
  ]),
  topic('hard', 'Globalizatsiya', "Globalizatsiya mavzusida fikr almashishni mashq qiling.", '🌐', [
    L('Ali', 'How has globalization affected your country?', 'Globalizatsiya mamlakatingizga qanday ta\'sir qildi?'),
    L('Aziza', 'It brought new technology and international trade.', "U yangi texnologiya va xalqaro savdoni olib keldi."),
    L('Ali', 'Are there any negative effects?', "Salbiy ta'sirlari ham bormi?"),
    L('Aziza', 'Yes, some local traditions are slowly disappearing.', "Ha, ba'zi mahalliy urf-odatlar asta-sekin yo'qolmoqda."),
    L('Ali', 'We should try to preserve our culture too.', "Biz o'z madaniyatimizni ham saqlashga harakat qilishimiz kerak."),
  ]),
  topic('hard', 'Ideal jamiyat', "Ideal jamiyat haqida fikr almashishni mashq qiling.", '🕊️', [
    L('Aziza', 'What would an ideal society look like to you?', 'Sizga ideal jamiyat qanday ko\'rinadi?'),
    L('Ali', 'A society where everyone has equal opportunities.', "Hamma teng imkoniyatlarga ega bo'lgan jamiyat."),
    L('Aziza', 'Do you think it is possible to achieve?', 'Bunga erishish mumkin deb o\'ylaysizmi?'),
    L('Ali', "It's difficult, but we should always try.", 'Bu qiyin, lekin biz doim harakat qilishimiz kerak.'),
    L('Aziza', 'I hope we get closer to it.', 'Umid qilamanki, unga yaqinlashamiz.'),
  ]),
];

export function getSpeakingTopicsByLevel(level: SpeakingLevel): SpeakingTopic[] {
  return SPEAKING_TOPICS.filter((t) => t.level === level);
}
