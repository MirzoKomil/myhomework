export type VocabLevel = 'beginner' | 'intermediate' | 'advanced';

export const VOCAB_LEVEL_LABELS: Record<VocabLevel, string> = {
  beginner: "Boshlang'ich",
  intermediate: "O'rta",
  advanced: 'Yuqori',
};

export const VOCAB_LEVELS_ORDER: VocabLevel[] = ['beginner', 'intermediate', 'advanced'];

export type VocabWordEntry = { en: string; uz: string; emoji: string };
export type VocabTopic = { id: string; level: VocabLevel; title: string; icon: string; words: VocabWordEntry[] };

function w(en: string, uz: string, emoji: string): VocabWordEntry {
  return { en, uz, emoji };
}

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function topic(level: VocabLevel, title: string, icon: string, words: VocabWordEntry[]): VocabTopic {
  return { id: slug(title), level, title, icon, words };
}

export const VOCAB_TOPICS: VocabTopic[] = [
  // ─── Boshlang'ich (Beginner) — 38 mavzu ────────────────────────────────────
  topic('beginner', 'Insects', '🐝', [
    w('Bee', 'Asalari', '🐝'), w('Ant', 'Chumoli', '🐜'), w('Butterfly', 'Kapalak', '🦋'),
    w('Spider', "O'rgimchak", '🕷️'), w('Ladybug', 'Xonqizi', '🐞'), w('Fly', 'Pashsha', '🪰'),
    w('Mosquito', 'Chivin', '🦟'), w('Beetle', "Qo'ng'iz", '🪲'), w('Worm', 'Chuvalchang', '🪱'),
  ]),
  topic('beginner', 'Kitchen', '🍳', [
    w('Pot', 'Qozon', '🍲'), w('Pan', 'Tova', '🍳'), w('Knife', 'Pichoq', '🔪'),
    w('Fork', 'Vilka', '🍴'), w('Spoon', 'Qoshiq', '🥄'), w('Plate', 'Likopcha', '🍽️'),
    w('Cup', 'Piyola', '☕'), w('Refrigerator', 'Muzlatgich', '🧊'), w('Stove', 'Plita', '🔥'),
  ]),
  topic('beginner', 'Stationery', '✏️', [
    w('Pen', 'Ruchka', '🖊️'), w('Pencil', 'Qalam', '✏️'), w('Eraser', "O'chirg'ich", '🧽'),
    w('Ruler', "Chizg'ich", '📏'), w('Notebook', 'Daftar', '📓'), w('Scissors', 'Qaychi', '✂️'),
    w('Glue', 'Yelim', '🧴'), w('Paper', "Qog'oz", '📄'), w('Marker', 'Marker', '🖍️'),
  ]),
  topic('beginner', 'Fast food', '🍔', [
    w('Burger', 'Burger', '🍔'), w('Fries', 'Kartoshka fri', '🍟'), w('Pizza', 'Pitsa', '🍕'),
    w('Hot dog', 'Xot-dog', '🌭'), w('Soda', 'Gazli ichimlik', '🥤'), w('Sandwich', 'Sendvich', '🥪'),
    w('Taco', 'Tako', '🌮'), w('Donut', 'Ponchik', '🍩'), w('Nuggets', 'Nagets', '🍗'),
  ]),
  topic('beginner', 'Holiday accessories', '🕶️', [
    w('Sunglasses', "Quyosh ko'zoynagi", '🕶️'), w('Hat', 'Shlyapa', '👒'), w('Swimsuit', 'Kupalnik', '🩱'),
    w('Flip-flops', 'Shippak', '🩴'), w('Suitcase', 'Chamodon', '🧳'), w('Camera', 'Kamera', '📷'),
    w('Passport', 'Pasport', '🛂'), w('Sunscreen', "Quyoshdan himoya kremi", '🧴'), w('Beach ball', 'Plyaj to\'pi', '🏐'),
  ]),
  topic('beginner', 'Every day activities 1', '⏰', [
    w('Wake up', "Uyg'onmoq", '⏰'), w('Eat breakfast', 'Nonushta qilmoq', '🍳'), w('Brush teeth', 'Tish yuvmoq', '🪥'),
    w('Take a shower', 'Dush qabul qilmoq', '🚿'), w('Get dressed', 'Kiyinmoq', '👕'), w('Go to school', 'Maktabga bormoq', '🎒'),
    w('Do homework', 'Uy vazifasini bajarmoq', '📚'), w('Watch TV', "Televizor ko'rmoq", '📺'), w('Sleep', 'Uxlamoq', '😴'),
  ]),
  topic('beginner', 'Everyday activities 2', '🍳', [
    w('Cook', 'Ovqat pishirmoq', '🍳'), w('Clean', 'Tozalamoq', '🧹'), w('Wash dishes', 'Idish yuvmoq', '🍽️'),
    w('Read', "O'qimoq", '📖'), w('Exercise', 'Mashq qilmoq', '🏃'), w('Play', "O'ynamoq", '🎮'),
    w('Talk', 'Gaplashmoq', '💬'), w('Walk', 'Yurmoq', '🚶'), w('Rest', 'Dam olmoq', '🛌'),
  ]),
  topic('beginner', 'Classroom 1', '🪑', [
    w('Desk', 'Parta', '🪑'), w('Chair', 'Stul', '💺'), w('Board', 'Doska', '⬛'),
    w('Book', 'Kitob', '📖'), w('Bag', 'Sumka', '🎒'), w('Pencil case', 'Qalamdon', '🖊️'),
    w('Clock', 'Soat', '🕐'), w('Window', 'Deraza', '🪟'), w('Door', 'Eshik', '🚪'),
  ]),
  topic('beginner', 'Classroom 2', '🗺️', [
    w('Map', 'Xarita', '🗺️'), w('Globe', 'Globus', '🌍'), w('Computer', 'Kompyuter', '💻'),
    w('Projector', 'Proyektor', '📽️'), w('Calendar', 'Taqvim', '📅'), w('Poster', 'Plakat', '🖼️'),
    w('Bookshelf', 'Kitob javoni', '📚'), w('Chalk', "Bo'r", '🖍️'), w('Ruler', "Chizg'ich", '📏'),
  ]),
  topic('beginner', 'Outside the home 1', '🏡', [
    w('Garden', "Bog'", '🌳'), w('Fence', "To'siq", '🚧'), w('Gate', 'Darvoza', '🚪'),
    w('Roof', 'Tom', '🏠'), w('Garage', 'Garaj', '🚗'), w('Driveway', 'Kirish yo\'lagi', '🛣️'),
    w('Mailbox', 'Pochta qutisi', '📬'), w('Porch', 'Ayvon', '🏡'), w('Yard', 'Hovli', '🌱'),
  ]),
  topic('beginner', 'Outside the home 2', '🚪', [
    w('Chimney', "Mo'ri", '🏠'), w('Balcony', 'Balkon', '🏢'), w('Steps', 'Zinapoya', '🪜'),
    w('Doorbell', "Eshik qo'ng'irog'i", '🔔'), w('Path', "Yo'lka", '🚶'), w('Wall', 'Devor', '🧱'),
    w('Window', 'Deraza', '🪟'), w('Lamp', 'Chiroq', '💡'), w('Bench', "O'rindiq", '🪑'),
  ]),
  topic('beginner', 'The apartment building 1', '🏢', [
    w('Elevator', 'Lift', '🛗'), w('Stairs', 'Zinapoya', '🪜'), w('Lobby', 'Kirish holl', '🏢'),
    w('Balcony', 'Balkon', '🏢'), w('Door', 'Eshik', '🚪'), w('Floor', 'Qavat', '🏠'),
    w('Roof', 'Tom', '🏠'), w('Basement', 'Podval', '🕳️'), w('Corridor', "Yo'lak", '🚪'),
  ]),
  topic('beginner', 'Work activities 1', '💼', [
    w('Type', 'Terish', '💻'), w('Write', 'Yozmoq', '✍️'), w('Call', "Qo'ng'iroq qilmoq", '📞'),
    w('Meet', 'Uchrashmoq', '🤝'), w('Present', 'Taqdimot qilmoq', '📊'), w('Plan', 'Rejalashtirmoq', '🗓️'),
    w('Print', 'Chop etmoq', '🖨️'), w('Sign', 'Imzolamoq', '✍️'), w('Email', 'Xat yubormoq', '📧'),
  ]),
  topic('beginner', 'Aircraft Parts', '✈️', [
    w('Wing', 'Qanot', '✈️'), w('Engine', 'Dvigatel', '⚙️'), w('Cockpit', 'Kabina', '🎛️'),
    w('Tail', 'Dum', '✈️'), w('Landing gear', 'Shassi', '🛬'), w('Propeller', 'Vint', '🌀'),
    w('Cabin', 'Salon', '💺'), w('Window', 'Illyuminator', '🪟'), w('Door', 'Eshik', '🚪'),
  ]),
  topic('beginner', 'Emotions', '😊', [
    w('Scared', "Qo'rqqan", '😨'), w('Angry', 'Jahldor', '😠'), w('Grateful', 'Minnatdor', '🙏'),
    w('Confident', 'Ishonchli', '😎'), w('Tired', 'Charchagan', '😴'), w('Depressed', 'Tushkunlikka tushgan', '😔'),
    w('Happy', 'Baxtli', '😊'), w('Surprised', 'Hayron', '😲'), w('Sad', 'Xafa', '😢'),
  ]),
  topic('beginner', 'In the city', '🏙️', [
    w('Street', "Ko'cha", '🛣️'), w('Building', 'Bino', '🏢'), w('Bridge', "Ko'prik", '🌉'),
    w('Park', 'Park', '🌳'), w('Bank', 'Bank', '🏦'), w('Hospital', 'Kasalxona', '🏥'),
    w('Market', 'Bozor', '🏪'), w('Bus stop', 'Avtobus bekati', '🚏'), w('Traffic light', 'Svetofor', '🚦'),
  ]),
  topic('beginner', 'Library', '📚', [
    w('Book', 'Kitob', '📚'), w('Shelf', 'Javon', '📖'), w('Librarian', 'Kutubxonachi', '🧑‍💼'),
    w('Card', 'Kartochka', '📇'), w('Table', 'Stol', '🪑'), w('Quiet', 'Sokin', '🤫'),
    w('Reading', "O'qish", '📖'), w('Magazine', 'Jurnal', '📰'), w('Computer', 'Kompyuter', '💻'),
  ]),
  topic('beginner', 'Temperament', '😌', [
    w('Calm', 'Xotirjam', '😌'), w('Nervous', 'Asabiy', '😬'), w('Brave', 'Jasur', '💪'),
    w('Shy', 'Uyatchan', '😳'), w('Patient', 'Sabrli', '⏳'), w('Stubborn', 'Qaysar', '😤'),
    w('Cheerful', 'Quvnoq', '😄'), w('Serious', 'Jiddiy', '😐'), w('Curious', 'Qiziquvchan', '🤔'),
  ]),
  topic('beginner', 'Dairy products', '🧀', [
    w('Cheese', 'Pishloq', '🧀'), w('Sour cream', 'Smetana', '🥣'), w('Butter', "Sariyog'", '🧈'),
    w('Cream', 'Qaymoq', '🍦'), w('Ice cream', 'Muzqaymoq', '🍨'), w('Margarine', 'Margarin', '🧈'),
    w('Yoghurt', 'Yogurt', '🥣'), w('Milk', 'Sut', '🥛'), w('Curd', 'Tvorog', '🧀'),
  ]),
  topic('beginner', 'Family', '👨‍👩‍👧‍👦', [
    w('Family', 'Oila', '👨‍👩‍👧‍👦'), w('Parents', 'Ota-ona', '👫'), w('Children', 'Bolalar', '🧒'),
    w('Grandmother', 'Buvi', '👵'), w('Father', 'Ota', '👨'), w('Daughter', 'Qiz', '👧'),
    w('Grandfather', 'Bobo', '👴'), w('Mother', 'Ona', '👩'), w('Son', "O'g'il", '👦'),
  ]),
  topic('beginner', 'People', '🧑', [
    w('Man', 'Erkak', '👨'), w('Woman', 'Ayol', '👩'), w('Boy', "O'g'il bola", '👦'),
    w('Girl', 'Qiz bola', '👧'), w('Baby', 'Chaqaloq', '👶'), w('Teenager', "O'smir", '🧑'),
    w('Adult', 'Kattalar', '🧑'), w('Elderly', 'Keksa', '👴'), w('Friend', "Do'st", '🧑‍🤝‍🧑'),
  ]),
  topic('beginner', 'Tens', '🔟', [
    w('Ten', "O'n", '🔟'), w('Twenty', 'Yigirma', '2️⃣0️⃣'), w('Thirty', "O'ttiz", '3️⃣0️⃣'),
    w('Forty', 'Qirq', '4️⃣0️⃣'), w('Fifty', 'Ellik', '5️⃣0️⃣'), w('Sixty', 'Oltmish', '6️⃣0️⃣'),
    w('Seventy', 'Yetmish', '7️⃣0️⃣'), w('Eighty', 'Sakson', '8️⃣0️⃣'), w('Ninety', "To'qson", '9️⃣0️⃣'),
  ]),
  topic('beginner', 'Digits', '🔢', [
    w('One', 'Bir', '1️⃣'), w('Two', 'Ikki', '2️⃣'), w('Three', 'Uch', '3️⃣'),
    w('Four', "To'rt", '4️⃣'), w('Five', 'Besh', '5️⃣'), w('Six', 'Olti', '6️⃣'),
    w('Seven', 'Yetti', '7️⃣'), w('Eight', 'Sakkiz', '8️⃣'), w('Nine', "To'qqiz", '9️⃣'),
  ]),
  topic('beginner', 'Digits 2', '🔢', [
    w('Zero', 'Nol', '0️⃣'), w('Ten', "O'n", '🔟'), w('Eleven', "O'n bir", '1️⃣1️⃣'),
    w('Twelve', "O'n ikki", '1️⃣2️⃣'), w('Thirteen', "O'n uch", '1️⃣3️⃣'), w('Fourteen', "O'n to'rt", '1️⃣4️⃣'),
    w('Fifteen', "O'n besh", '1️⃣5️⃣'), w('Sixteen', "O'n olti", '1️⃣6️⃣'), w('Seventeen', "O'n yetti", '1️⃣7️⃣'),
  ]),
  topic('beginner', 'Nature', '🌳', [
    w('Tree', 'Daraxt', '🌳'), w('Mountain', "Tog'", '⛰️'), w('River', 'Daryo', '🏞️'),
    w('Forest', "O'rmon", '🌲'), w('Flower', 'Gul', '🌸'), w('Sky', 'Osmon', '☁️'),
    w('Sun', 'Quyosh', '☀️'), w('Rock', 'Tosh', '🪨'), w('Grass', "O't", '🌿'),
  ]),
  topic('beginner', 'Seasons and Weather', '🌦️', [
    w('Spring', 'Bahor', '🌸'), w('Summer', 'Yoz', '☀️'), w('Autumn', 'Kuz', '🍂'),
    w('Winter', 'Qish', '❄️'), w('Rain', "Yomg'ir", '🌧️'), w('Snow', 'Qor', '🌨️'),
    w('Wind', 'Shamol', '💨'), w('Cloud', 'Bulut', '☁️'), w('Storm', "Bo'ron", '⛈️'),
  ]),
  topic('beginner', 'Parts of the face', '👁️', [
    w('Eye', "Ko'z", '👁️'), w('Nose', 'Burun', '👃'), w('Mouth', "Og'iz", '👄'),
    w('Ear', 'Quloq', '👂'), w('Eyebrow', 'Qosh', '🤨'), w('Cheek', 'Yonoq', '😊'),
    w('Chin', 'Iyak', '🧑'), w('Lips', 'Lab', '💋'), w('Forehead', 'Peshona', '🧑'),
  ]),
  topic('beginner', 'Drinks', '🥤', [
    w('Water', 'Suv', '💧'), w('Juice', 'Sharbat', '🧃'), w('Tea', 'Choy', '🍵'),
    w('Coffee', 'Qahva', '☕'), w('Milk', 'Sut', '🥛'), w('Soda', 'Gazli suv', '🥤'),
    w('Wine', 'Vino', '🍷'), w('Beer', 'Pivo', '🍺'), w('Lemonade', 'Limonad', '🍋'),
  ]),
  topic('beginner', 'School', '🏫', [
    w('Teacher', "O'qituvchi", '🧑‍🏫'), w('Student', "O'quvchi", '🧑‍🎓'), w('Classroom', 'Sinfxona', '🏫'),
    w('Homework', 'Uy vazifasi', '📝'), w('Exam', 'Imtihon', '📄'), w('Backpack', 'Ryukzak', '🎒'),
    w('Lesson', 'Dars', '📖'), w('Bell', "Qo'ng'iroq", '🔔'), w('Uniform', 'Forma', '👕'),
  ]),
  topic('beginner', 'Circus', '🎪', [
    w('Clown', 'Masxaraboz', '🤡'), w('Acrobat', 'Akrobat', '🤸'), w('Lion', 'Sher', '🦁'),
    w('Elephant', 'Fil', '🐘'), w('Tightrope', 'Kanat', '🎪'), w('Juggler', 'Jonglyor', '🤹'),
    w('Ringmaster', 'Sirk boshqaruvchisi', '🎩'), w('Tent', 'Chodir', '🎪'), w('Trapeze', 'Trapetsiya', '🤸'),
  ]),
  topic('beginner', 'Clothes', '👕', [
    w('Shirt', "Ko'ylak", '👕'), w('Trousers', 'Shim', '👖'), w('Dress', 'Libos', '👗'),
    w('Jacket', 'Kurtka', '🧥'), w('Shoes', 'Poyabzal', '👟'), w('Socks', 'Paypoq', '🧦'),
    w('Hat', 'Kepka', '🧢'), w('Gloves', "Qo'lqop", '🧤'), w('Scarf', 'Sharf', '🧣'),
  ]),
  topic('beginner', 'Prepositions', '📍', [
    w('In', 'Ichida', '⬇️'), w('On', 'Ustida', '⬆️'), w('Under', 'Ostida', '⬇️'),
    w('Next to', 'Yonida', '➡️'), w('Between', "O'rtasida", '↔️'), w('Behind', 'Ortida', '⬅️'),
    w('In front of', 'Oldida', '➡️'), w('Above', 'Yuqorisida', '⬆️'), w('Below', 'Pastida', '⬇️'),
  ]),
  topic('beginner', 'Room furniture', '🛋️', [
    w('Bed', 'Karavot', '🛏️'), w('Sofa', 'Divan', '🛋️'), w('Table', 'Stol', '🪑'),
    w('Chair', 'Stul', '💺'), w('Wardrobe', 'Shkaf', '🚪'), w('Mirror', 'Oyna', '🪞'),
    w('Lamp', 'Chiroq', '💡'), w('Shelf', 'Javon', '📚'), w('Rug', 'Gilam', '🟫'),
  ]),
  topic('beginner', 'Transport', '🚗', [
    w('Car', 'Mashina', '🚗'), w('Bus', 'Avtobus', '🚌'), w('Train', 'Poyezd', '🚆'),
    w('Bicycle', 'Velosiped', '🚲'), w('Airplane', 'Samolyot', '✈️'), w('Ship', 'Kema', '🚢'),
    w('Motorcycle', 'Mototsikl', '🏍️'), w('Taxi', 'Taksi', '🚕'), w('Truck', 'Yuk mashinasi', '🚚'),
  ]),
  topic('beginner', 'Toys', '🧸', [
    w('Doll', "Qo'g'irchoq", '🪆'), w('Ball', "To'p", '⚽'), w('Teddy bear', 'Ayiqcha', '🧸'),
    w('Blocks', 'Kublar', '🧱'), w('Kite', 'Varrak', '🪁'), w('Puzzle', 'Boshqotirma', '🧩'),
    w('Robot', 'Robot', '🤖'), w('Car', 'Mashinacha', '🚗'), w('Yo-yo', 'Yo-yo', '🪀'),
  ]),
  topic('beginner', 'Colors', '🎨', [
    w('Red', 'Qizil', '🔴'), w('Blue', "Ko'k", '🔵'), w('Green', 'Yashil', '🟢'),
    w('Yellow', 'Sariq', '🟡'), w('Black', 'Qora', '⚫'), w('White', 'Oq', '⚪'),
    w('Orange', "To'q sariq", '🟠'), w('Purple', 'Binafsha', '🟣'), w('Brown', 'Jigarrang', '🟤'),
  ]),
  topic('beginner', 'Fruits', '🍎', [
    w('Apple', 'Olma', '🍎'), w('Banana', 'Banan', '🍌'), w('Orange', 'Apelsin', '🍊'),
    w('Grapes', 'Uzum', '🍇'), w('Watermelon', 'Tarvuz', '🍉'), w('Strawberry', 'Qulupnay', '🍓'),
    w('Pineapple', 'Ananas', '🍍'), w('Mango', 'Mango', '🥭'), w('Cherry', 'Gilos', '🍒'),
  ]),
  topic('beginner', 'Domestic', '🐐', [
    w('Goat', 'Echki', '🐐'), w('Cow', 'Sigir', '🐄'), w('Cat', 'Mushuk', '🐱'),
    w('Hen', 'Tovuq', '🐔'), w('Horse', 'Ot', '🐴'), w('Rabbit', 'Quyon', '🐰'),
    w('Donkey', 'Eshak', '🫏'), w('Duck', "O'rdak", '🦆'), w('Dog', 'It', '🐕'),
  ]),

  // ─── O'rta (Intermediate) — 56 mavzu ────────────────────────────────────────
  topic('intermediate', 'At the atelier', '🧵', [
    w('Needle', 'Igna', '🪡'), w('Thread', 'Ip', '🧵'), w('Scissors', 'Qaychi', '✂️'),
    w('Fabric', 'Mato', '🧶'), w('Sewing machine', 'Tikuv mashinasi', '🧵'), w('Button', 'Tugma', '🔘'),
    w('Zipper', 'Zamok', '🤐'), w('Measuring tape', "O'lchov lentasi", '📏'), w('Pattern', 'Andoza', '📐'),
  ]),
  topic('intermediate', 'At the hotel', '🏨', [
    w('Reception', 'Qabulxona', '🛎️'), w('Room', 'Xona', '🚪'), w('Key', 'Kalit', '🔑'),
    w('Elevator', 'Lift', '🛗'), w('Luggage', 'Yuk', '🧳'), w('Bellboy', 'Xizmatchi', '🧑‍💼'),
    w('Lobby', 'Holl', '🏨'), w('Reservation', 'Bron', '📅'), w('Checkout', 'Chiqish', '🧾'),
  ]),
  topic('intermediate', 'In the bedroom', '🛏️', [
    w('Bed', 'Karavot', '🛏️'), w('Pillow', 'Yostiq', '🛌'), w('Blanket', 'Adyol', '🧣'),
    w('Wardrobe', 'Shkaf', '🚪'), w('Mirror', 'Oyna', '🪞'), w('Curtain', 'Parda', '🪟'),
    w('Lamp', 'Chiroq', '💡'), w('Alarm clock', "Uyg'otgich soat", '⏰'), w('Rug', 'Gilam', '🟫'),
  ]),
  topic('intermediate', 'Household appliances', '🧺', [
    w('Washing machine', 'Kir yuvish mashinasi', '🧺'), w('Refrigerator', 'Muzlatgich', '🧊'), w('Microwave', 'Mikroto\'lqinli pech', '📦'),
    w('Vacuum cleaner', 'Changyutgich', '🧹'), w('Iron', 'Dazmol', '🔥'), w('Toaster', 'Toster', '🍞'),
    w('Blender', 'Blender', '🥤'), w('Kettle', 'Choynak', '🫖'), w('Dishwasher', 'Idish yuvish mashinasi', '🍽️'),
  ]),
  topic('intermediate', 'Theatre', '🎭', [
    w('Lira', 'Lira', '🎼'), w('Plot', 'Syujet', '📜'), w('Mask', 'Niqob', '🎭'),
    w('Binoculars', 'Durbin', '🔭'), w('Spotlight', 'Prozhektor', '🔦'), w('Curtain', 'Parda', '🎬'),
    w('Bouquet', 'Guldasta', '💐'), w('Fan', "Elpig'ich", '🪭'), w('Ticket', 'Chipta', '🎫'),
  ]),
  topic('intermediate', 'Flowers', '🌷', [
    w('Rose', 'Atirgul', '🌹'), w('Tulip', 'Lola', '🌷'), w('Sunflower', 'Kungaboqar', '🌻'),
    w('Daisy', 'Romashka', '🌼'), w('Lily', 'Zambak', '🌸'), w('Orchid', 'Orxideya', '🌺'),
    w('Carnation', 'Chinnigul', '🌸'), w('Poppy', "Lolaqizg'aldoq", '🌺'), w('Violet', 'Binafsha', '💜'),
  ]),
  topic('intermediate', 'Berries', '🍇', [
    w('Strawberry', 'Qulupnay', '🍓'), w('Raspberry', 'Malina', '🍇'), w('Blueberry', "Ko'k mevak", '🫐'),
    w('Blackberry', 'Ejevika', '🫐'), w('Cranberry', 'Klyukva', '🍒'), w('Currant', 'Smorodina', '🍒'),
    w('Gooseberry', "Qarag'at", '🍈'), w('Grape', 'Uzum', '🍇'), w('Cherry', 'Gilos', '🍒'),
  ]),
  topic('intermediate', 'Spices', '🌶️', [
    w('Salt', 'Tuz', '🧂'), w('Pepper', 'Qalampir', '🌶️'), w('Cinnamon', 'Dolchin', '🟤'),
    w('Ginger', 'Zanjabil', '🫚'), w('Garlic', 'Sarimsoq', '🧄'), w('Cumin', 'Zira', '🌿'),
    w('Turmeric', 'Zarchava', '🟡'), w('Basil', 'Rayhon', '🌿'), w('Cloves', 'Mixak', '🟫'),
  ]),
  topic('intermediate', 'Fishing', '🎣', [
    w('Fishing rod', 'Qarmoq', '🎣'), w('Hook', 'Ilgak', '🪝'), w('Net', "To'r", '🥅'),
    w('Bait', "O'lja", '🪱'), w('Boat', 'Qayiq', '🚤'), w('Fish', 'Baliq', '🐟'),
    w('Lake', "Ko'l", '🏞️'), w('Bucket', 'Chelak', '🪣'), w('Line', 'Ip', '🧵'),
  ]),
  topic('intermediate', 'Fast food', '🍕', [
    w('Burger', 'Burger', '🍔'), w('Fries', 'Kartoshka fri', '🍟'), w('Pizza', 'Pitsa', '🍕'),
    w('Hot dog', 'Xot-dog', '🌭'), w('Soda', 'Gazli ichimlik', '🥤'), w('Sandwich', 'Sendvich', '🥪'),
    w('Taco', 'Tako', '🌮'), w('Donut', 'Ponchik', '🍩'), w('Milkshake', 'Milksheyk', '🥤'),
  ]),
  topic('intermediate', 'At the airport', '🛫', [
    w('Ticket', 'Chipta', '🎫'), w('Passport', 'Pasport', '🛂'), w('Boarding pass', 'Qadam kartasi', '🎟️'),
    w('Luggage', 'Yuk', '🧳'), w('Gate', 'Eshik', '🚪'), w('Runway', "Uchish-qo'nish yo'lagi", '🛬'),
    w('Check-in', "Ro'yxatdan o'tish", '📋'), w('Security', 'Xavfsizlik', '🛡️'), w('Customs', 'Bojxona', '🛃'),
  ]),
  topic('intermediate', 'Space', '🌌', [
    w('Planet', 'Sayyora', '🪐'), w('Star', 'Yulduz', '⭐'), w('Moon', 'Oy', '🌙'),
    w('Sun', 'Quyosh', '☀️'), w('Rocket', 'Raketa', '🚀'), w('Astronaut', 'Kosmonavt', '👨‍🚀'),
    w('Galaxy', 'Galaktika', '🌌'), w('Comet', 'Kometa', '☄️'), w('Satellite', "Sun'iy yo'ldosh", '🛰️'),
  ]),
  topic('intermediate', 'Video and audio equipment', '📺', [
    w('Television', 'Televizor', '📺'), w('Speaker', 'Dinamik', '🔊'), w('Headphones', 'Naushnik', '🎧'),
    w('Microphone', 'Mikrofon', '🎤'), w('Camera', 'Kamera', '📷'), w('Remote control', 'Pult', '📱'),
    w('Radio', 'Radio', '📻'), w('Amplifier', 'Kuchaytirgich', '🔊'), w('Projector', 'Proyektor', '📽️'),
  ]),
  topic('intermediate', 'The bank', '🏦', [
    w('Money', 'Pul', '💵'), w('Card', 'Karta', '💳'), w('ATM', 'Bankomat', '🏧'),
    w('Account', 'Hisob', '📊'), w('Loan', 'Kredit', '💰'), w('Cashier', 'Kassir', '🧑‍💼'),
    w('Deposit', 'Depozit', '💵'), w('Check', 'Chek', '🧾'), w('Vault', 'Seyf', '🔒'),
  ]),
  topic('intermediate', 'Work activities 2', '📊', [
    w('Manage', 'Boshqarmoq', '📊'), w('Negotiate', 'Muzokara qilmoq', '🤝'), w('Hire', 'Yollamoq', '🧑‍💼'),
    w('Fire', 'Ishdan bo\'shatmoq', '🚫'), w('Train', "O'qitmoq", '🎓'), w('Report', 'Hisobot bermoq', '📋'),
    w('Analyze', 'Tahlil qilmoq', '📈'), w('Organize', 'Tashkil qilmoq', '🗂️'), w('Delegate', 'Topshirmoq', '🤲'),
  ]),
  topic('intermediate', 'The office', '🏢', [
    w('Desk', 'Stol', '🪑'), w('Computer', 'Kompyuter', '💻'), w('Printer', 'Printer', '🖨️'),
    w('Chair', 'Stul', '💺'), w('Folder', 'Papka', '📁'), w('Stapler', 'Steplr', '📎'),
    w('Phone', 'Telefon', '☎️'), w('Whiteboard', 'Doska', '⬜'), w('Cabinet', 'Shkaf', '🗄️'),
  ]),
  topic('intermediate', 'Office furnishings', '🪑', [
    w('Desk', 'Stol', '🪑'), w('Chair', 'Stul', '💺'), w('Bookshelf', 'Kitob javoni', '📚'),
    w('Cabinet', 'Shkaf', '🗄️'), w('Lamp', 'Chiroq', '💡'), w('Carpet', 'Gilam', '🟫'),
    w('Sofa', 'Divan', '🛋️'), w('Plant', "O'simlik", '🪴'), w('Clock', 'Soat', '🕐'),
  ]),
  topic('intermediate', 'The construction site', '🏗️', [
    w('Crane', 'Kran', '🏗️'), w('Helmet', 'Kaska', '⛑️'), w('Bricks', "G'isht", '🧱'),
    w('Cement', 'Sement', '🪨'), w('Ladder', 'Narvon', '🪜'), w('Bulldozer', 'Buldozer', '🚜'),
    w('Scaffolding', 'Inshoot karkasi', '🏗️'), w('Shovel', 'Bel', '🥄'), w('Hammer', "Bolg'a", '🔨'),
  ]),
  topic('intermediate', 'Car interior 1', '🚗', [
    w('Steering wheel', 'Rul', '🎡'), w('Seat', "O'rindiq", '💺'), w('Dashboard', 'Panel', '🎛️'),
    w('Gear shift', 'Uzatma richagi', '🕹️'), w('Mirror', 'Oyna', '🪞'), w('Seatbelt', 'Xavfsizlik kamari', '🔒'),
    w('Pedal', 'Pedal', '🦶'), w('Horn', 'Signal', '📯'), w('Speedometer', 'Spidometr', '⏱️'),
  ]),
  topic('intermediate', 'The car', '🚙', [
    w('Wheel', "G'ildirak", '⚙️'), w('Engine', 'Dvigatel', '🔧'), w('Trunk', 'Bagaj', '🧳'),
    w('Door', 'Eshik', '🚪'), w('Window', 'Deraza', '🪟'), w('Headlight', 'Fara', '💡'),
    w('Bumper', 'Bamper', '🚗'), w('Tire', 'Shina', '🛞'), w('Hood', 'Kapot', '🚙'),
  ]),
  topic('intermediate', 'Highways and streets', '🛣️', [
    w('Road', "Yo'l", '🛣️'), w('Sign', 'Belgi', '🪧'), w('Traffic light', 'Svetofor', '🚦'),
    w('Crosswalk', "O'tish yo'lagi", '🚸'), w('Bridge', "Ko'prik", '🌉'), w('Tunnel', 'Tunnel', '🚇'),
    w('Lane', 'Qator', '🛤️'), w('Sidewalk', 'Piyodalar yo\'lagi', '🚶'), w('Roundabout', 'Aylanma', '🔄'),
  ]),
  topic('intermediate', 'Car interior 2', '🚘', [
    w('Radio', 'Radio', '📻'), w('Air conditioner', 'Konditsioner', '❄️'), w('Glove box', "Qo'lqop qutisi", '📦'),
    w('Sun visor', 'Quyosh soyabon', '☀️'), w('Gear stick', 'Uzatgich', '🕹️'), w('Handbrake', "Qo'l tormozi", '✋'),
    w('Ashtray', 'Kuldon', '🚬'), w('Seat belt', 'Kamar', '🔒'), w('Rearview mirror', 'Orqa ko\'rish oynasi', '🪞'),
  ]),
  topic('intermediate', 'Airplane Interior', '💺', [
    w('Seat', "O'rindiq", '💺'), w('Aisle', "Yo'lak", '🚶'), w('Window', 'Illyuminator', '🪟'),
    w('Tray table', 'Stolcha', '🍽️'), w('Overhead bin', "Yuqori bo'lim", '🧳'), w('Seatbelt', 'Kamar', '🔒'),
    w('Cabin crew', 'Ekipaj', '👩‍✈️'), w('Cockpit', 'Kabina', '🎛️'), w('Emergency exit', "Favqulodda chiqish", '🚪'),
  ]),
  topic('intermediate', 'The park and the playground', '🛝', [
    w('Swing', "Salinchoq", '🛝'), w('Slide', "Sirg'anchiq", '🛝'), w('Bench', "O'rindiq", '🪑'),
    w('Sandbox', 'Qum qutisi', '🏖️'), w('Fountain', 'Favvora', '⛲'), w('Path', "Yo'lka", '🚶'),
    w('Tree', 'Daraxt', '🌳'), w('Playground', "O'yin maydoni", '🛝'), w('Merry-go-round', 'Aylanma ot-ot', '🎠'),
  ]),
  topic('intermediate', 'Birds', '🦅', [
    w('Eagle', 'Burgut', '🦅'), w('Sparrow', 'Chumchuq', '🐦'), w('Owl', 'Boyqush', '🦉'),
    w('Parrot', "To'tiqush", '🦜'), w('Pigeon', 'Kaptar', '🕊️'), w('Swan', 'Oqqush', '🦢'),
    w('Peacock', 'Tovus', '🦚'), w('Crow', "Qarg'a", '🐦‍⬛'), w('Woodpecker', "O'rmontesar", '🐦'),
  ]),
  topic('intermediate', 'Household chores', '🧹', [
    w('Sweep', 'Supurmoq', '🧹'), w('Mop', 'Yer yuvmoq', '🧽'), w('Dust', 'Chang artmoq', '🪶'),
    w('Iron', 'Dazmollamoq', '🔥'), w('Vacuum', 'Changyutgich bilan tozalash', '🧹'), w('Wash', 'Yuvmoq', '🧺'),
    w('Fold', "Yig'ishtirmoq", '👕'), w('Tidy up', 'Tartibga keltirmoq', '🗂️'), w('Cook', 'Ovqat pishirmoq', '🍳'),
  ]),
  topic('intermediate', 'Types of housing', '🏘️', [
    w('House', 'Uy', '🏠'), w('Apartment', 'Kvartira', '🏢'), w('Villa', 'Villa', '🏡'),
    w('Cottage', 'Kottedj', '🏘️'), w('Studio', 'Studiya', '🏠'), w('Bungalow', 'Bungalo', '🏡'),
    w('Mansion', 'Katta uy', '🏰'), w('Duplex', 'Ikki qavatli uy', '🏘️'), w('Hut', 'Kulba', '🛖'),
  ]),
  topic('intermediate', 'The dining room', '🍽️', [
    w('Table', 'Stol', '🍽️'), w('Chair', 'Stul', '💺'), w('Plate', 'Likopcha', '🍽️'),
    w('Glass', 'Stakan', '🥛'), w('Napkin', 'Salfetka', '🧻'), w('Tablecloth', 'Dasturxon', '🟦'),
    w('Cutlery', 'Pichoq-vilka', '🍴'), w('Candle', 'Sham', '🕯️'), w('Vase', 'Vaza', '🏺'),
  ]),
  topic('intermediate', 'The apartment building 2', '🏙️', [
    w('Intercom', 'Domofon', '📞'), w('Mailbox', 'Pochta qutisi', '📬'), w('Parking lot', 'Avtoturargoh', '🅿️'),
    w('Elevator', 'Lift', '🛗'), w('Staircase', 'Zinapoya', '🪜'), w('Roof', 'Tom', '🏠'),
    w('Balcony', 'Balkon', '🏢'), w('Entrance', 'Kirish', '🚪'), w('Neighbor', "Qo'shni", '🧑‍🤝‍🧑'),
  ]),
  topic('intermediate', 'Housing utilities, services and repairs 1', '🔧', [
    w('Plumber', 'Santexnik', '🔧'), w('Electrician', 'Elektrik', '⚡'), w('Pipe', 'Quvur', '🚰'),
    w('Wire', 'Sim', '🔌'), w('Repair', 'Ta\'mirlash', '🛠️'), w('Water heater', 'Suv isitgich', '🚿'),
    w('Gas', 'Gaz', '🔥'), w('Meter', 'Hisoblagich', '📟'), w('Toolbox', 'Asboblar qutisi', '🧰'),
  ]),
  topic('intermediate', 'Gardening tools', '🌱', [
    w('Shovel', 'Bel', '🥄'), w('Rake', 'Tirnagich', '🧹'), w('Watering can', 'Suvarish', '🪣'),
    w('Hoe', 'Ketmon', '⛏️'), w('Wheelbarrow', 'Aravacha', '🛒'), w('Pruning shears', "Bog' qaychisi", '✂️'),
    w('Gloves', "Qo'lqop", '🧤'), w('Hose', 'Shlang', '🚿'), w('Trowel', 'Kichik bel', '🥄'),
  ]),
  topic('intermediate', 'Home supplies', '🧴', [
    w('Soap', 'Sovun', '🧼'), w('Towel', 'Sochiq', '🧻'), w('Detergent', 'Kir yuvish kukuni', '🧴'),
    w('Broom', 'Supurgi', '🧹'), w('Bucket', 'Chelak', '🪣'), w('Sponge', 'Gubka', '🧽'),
    w('Trash bag', 'Axlat qopi', '🗑️'), w('Candle', 'Sham', '🕯️'), w('Air freshener', "Xona xushbo'ylagichi", '🌸'),
  ]),
  topic('intermediate', 'Meat', '🥩', [
    w('Beef', "Mol go'shti", '🥩'), w('Chicken', "Tovuq go'shti", '🍗'), w('Lamb', "Qo'zi go'shti", '🍖'),
    w('Pork', "Cho'chqa go'shti", '🥓'), w('Sausage', 'Kolbasa', '🌭'), w('Steak', 'Steyk', '🥩'),
    w('Bacon', 'Bekon', '🥓'), w('Ribs', "Qovurg'a", '🍖'), w('Turkey', 'Kurka go\'shti', '🦃'),
  ]),
  topic('intermediate', 'The restaurant', '🍽️', [
    w('Menu', 'Menyu', '📜'), w('Waiter', 'Ofitsiant', '🧑‍🍳'), w('Table', 'Stol', '🍽️'),
    w('Bill', 'Chek', '🧾'), w('Kitchen', 'Oshxona', '🍳'), w('Chef', 'Oshpaz', '👨‍🍳'),
    w('Reservation', 'Bron', '📅'), w('Tip', "Choy puli", '💵'), w('Dish', 'Taom', '🍲'),
  ]),
  topic('intermediate', 'Sweets', '🍬', [
    w('Chocolate', 'Shokolad', '🍫'), w('Candy', 'Konfet', '🍬'), w('Cake', 'Tort', '🍰'),
    w('Cookie', 'Pechenye', '🍪'), w('Lollipop', 'Lolipop', '🍭'), w('Cupcake', 'Keks', '🧁'),
    w('Marshmallow', 'Zefir', '🍡'), w('Honey', 'Asal', '🍯'), w('Jelly', 'Jele', '🍮'),
  ]),
  topic('intermediate', 'Weather', '☀️', [
    w('Sunny', 'Quyoshli', '☀️'), w('Rainy', "Yomg'irli", '🌧️'), w('Cloudy', 'Bulutli', '☁️'),
    w('Windy', 'Shamolli', '💨'), w('Snowy', 'Qorli', '🌨️'), w('Foggy', 'Tumanli', '🌫️'),
    w('Hot', 'Issiq', '🥵'), w('Cold', 'Sovuq', '🥶'), w('Storm', "Bo'ron", '⛈️'),
  ]),
  topic('intermediate', 'Emotions', '😄', [
    w('Excited', 'Hayajonlangan', '🤩'), w('Bored', 'Zerikkan', '🥱'), w('Jealous', "Hasadgo'y", '😒'),
    w('Proud', 'Faxrlanuvchi', '😌'), w('Embarrassed', 'Uyalgan', '😳'), w('Anxious', 'Xavotirli', '😟'),
    w('Relieved', 'Yengil tortgan', '😮‍💨'), w('Curious', 'Qiziquvchan', '🤔'), w('Confused', 'Chalkashgan', '😵'),
  ]),
  topic('intermediate', 'At the supermarket', '🛒', [
    w('Cart', 'Aravacha', '🛒'), w('Basket', 'Savat', '🧺'), w('Cashier', 'Kassir', '🧑‍💼'),
    w('Receipt', 'Chek', '🧾'), w('Aisle', 'Qator', '🏬'), w('Discount', 'Chegirma', '🏷️'),
    w('Shelf', 'Javon', '📦'), w('Checkout', 'Kassa', '💳'), w('Bag', 'Paket', '🛍️'),
  ]),
  topic('intermediate', 'Pet shop', '🐾', [
    w('Dog', 'It', '🐕'), w('Cat', 'Mushuk', '🐱'), w('Fish', 'Baliq', '🐟'),
    w('Bird', 'Qush', '🐦'), w('Cage', 'Qafas', '🦜'), w('Leash', "Boyinbog'", '🦮'),
    w('Food bowl', 'Ovqat idishi', '🥣'), w('Aquarium', 'Akvarium', '🐠'), w('Toy', "O'yinchoq", '🧸'),
  ]),
  topic('intermediate', 'Fairy tale characters', '🧙', [
    w('Prince', 'Shahzoda', '🤴'), w('Princess', 'Malika', '👸'), w('Witch', 'Jodugar', '🧙‍♀️'),
    w('Dragon', 'Ajdaho', '🐉'), w('Wizard', 'Sehrgar', '🧙'), w('Fairy', 'Peri', '🧚'),
    w('Giant', 'Gigant', '🫃'), w('King', 'Podshoh', '🤴'), w('Queen', 'Malika', '👸'),
  ]),
  topic('intermediate', 'Vegetables', '🥕', [
    w('Carrot', 'Sabzi', '🥕'), w('Potato', 'Kartoshka', '🥔'), w('Tomato', 'Pomidor', '🍅'),
    w('Onion', 'Piyoz', '🧅'), w('Cucumber', 'Bodring', '🥒'), w('Cabbage', 'Karam', '🥬'),
    w('Pepper', "Bulg'or qalampiri", '🫑'), w('Eggplant', 'Baqlajon', '🍆'), w('Garlic', 'Sarimsoq', '🧄'),
  ]),
  topic('intermediate', 'Farm', '🚜', [
    w('Barn', 'Ombor', '🏚️'), w('Tractor', 'Traktor', '🚜'), w('Field', 'Dala', '🌾'),
    w('Farmer', 'Fermer', '🧑‍🌾'), w('Cow', 'Sigir', '🐄'), w('Hay', 'Somon', '🌾'),
    w('Fence', "To'siq", '🚧'), w('Silo', 'Silos', '🏭'), w('Scarecrow', "Qo'rqinchi", '🎃'),
  ]),
  topic('intermediate', 'Hiking', '🥾', [
    w('Backpack', 'Ryukzak', '🎒'), w('Boots', 'Etik', '🥾'), w('Trail', "So'qmoq", '🥾'),
    w('Compass', 'Kompas', '🧭'), w('Tent', 'Chodir', '⛺'), w('Map', 'Xarita', '🗺️'),
    w('Water bottle', 'Suv idishi', '🚰'), w('Mountain', "Tog'", '⛰️'), w('Campfire', 'Gulxan', '🔥'),
  ]),
  topic('intermediate', 'Feeling unwell', '🤒', [
    w('Headache', "Bosh og'rig'i", '🤕'), w('Fever', 'Isitma', '🌡️'), w('Cough', "Yo'tal", '😷'),
    w('Sore throat', 'Tomoq og\'rig\'i', '🤒'), w('Stomachache', 'Qorin og\'rig\'i', '🤢'), w('Cold', 'Shamollash', '🤧'),
    w('Dizzy', 'Bosh aylanishi', '😵‍💫'), w('Tired', 'Charchagan', '😴'), w('Nausea', "Ko'ngil aynishi", '🤢'),
  ]),
  topic('intermediate', 'Tools', '🧰', [
    w('Hammer', "Bolg'a", '🔨'), w('Screwdriver', 'Otvyortka', '🪛'), w('Wrench', 'Garayka kaliti', '🔧'),
    w('Saw', 'Arra', '🪚'), w('Drill', "Burg'ulash mashinasi", '🛠️'), w('Pliers', 'Ombur', '🔧'),
    w('Tape measure', "O'lchov lentasi", '📏'), w('Nail', 'Mix', '📌'), w('Screw', 'Vint', '🔩'),
  ]),
  topic('intermediate', 'Materials', '🪵', [
    w('Wood', "Yog'och", '🪵'), w('Metal', 'Metall', '⚙️'), w('Plastic', 'Plastik', '🧴'),
    w('Glass', 'Shisha', '🍶'), w('Stone', 'Tosh', '🪨'), w('Fabric', 'Mato', '🧶'),
    w('Paper', "Qog'oz", '📄'), w('Leather', 'Teri', '🟤'), w('Rubber', 'Rezina', '⚫'),
  ]),
  topic('intermediate', 'Train travel', '🚆', [
    w('Ticket', 'Chipta', '🎫'), w('Platform', 'Peron', '🚉'), w('Track', 'Relslar', '🛤️'),
    w('Conductor', "Kondüktor", '🧑‍✈️'), w('Cabin', 'Kupe', '🚃'), w('Station', 'Vokzal', '🚉'),
    w('Luggage', 'Yuk', '🧳'), w('Seat', "O'rindiq", '💺'), w('Schedule', 'Jadval', '🗓️'),
  ]),
  topic('intermediate', 'Wild animals', '🦁', [
    w('Lion', 'Sher', '🦁'), w('Tiger', "Yo'lbars", '🐅'), w('Elephant', 'Fil', '🐘'),
    w('Giraffe', 'Jirafa', '🦒'), w('Zebra', 'Zebra', '🦓'), w('Bear', 'Ayiq', '🐻'),
    w('Wolf', "Bo'ri", '🐺'), w('Fox', 'Tulki', '🦊'), w('Monkey', 'Maymun', '🐒'),
  ]),
  topic('intermediate', 'Personal hygiene products', '🧴', [
    w('Soap', 'Sovun', '🧼'), w('Shampoo', 'Shampun', '🧴'), w('Toothbrush', 'Tish cho\'tkasi', '🪥'),
    w('Toothpaste', 'Tish pastasi', '🧴'), w('Comb', 'Taroq', '🪮'), w('Towel', 'Sochiq', '🧻'),
    w('Deodorant', 'Dezodorant', '🧴'), w('Razor', 'Ustara', '🪒'), w('Perfume', 'Atir', '🧴'),
  ]),
  topic('intermediate', 'On the film set', '🎬', [
    w('Camera', 'Kamera', '🎥'), w('Director', 'Rejissyor', '🎬'), w('Actor', 'Aktyor', '🎭'),
    w('Script', 'Ssenariy', '📜'), w('Microphone', 'Mikrofon', '🎤'), w('Light', "Yorug'lik", '💡'),
    w('Set', 'Maydoncha', '🎬'), w('Costume', 'Kostyum', '👗'), w('Clapperboard', 'Xlopushka', '🎬'),
  ]),
  topic('intermediate', 'Professions', '👩‍⚕️', [
    w('Doctor', 'Shifokor', '👨‍⚕️'), w('Teacher', "O'qituvchi", '🧑‍🏫'), w('Engineer', 'Muhandis', '👷'),
    w('Police officer', 'Politsiyachi', '👮'), w('Firefighter', "O't o'chiruvchi", '👨‍🚒'), w('Chef', 'Oshpaz', '👨‍🍳'),
    w('Pilot', 'Uchuvchi', '👨‍✈️'), w('Lawyer', 'Advokat', '⚖️'), w('Nurse', 'Hamshira', '👩‍⚕️'),
  ]),
  topic('intermediate', 'Parts of the body', '🦵', [
    w('Head', 'Bosh', '🗣️'), w('Arm', "Qo'l", '💪'), w('Leg', 'Oyoq', '🦵'),
    w('Hand', 'Panja', '✋'), w('Foot', 'Oyoq panjasi', '🦶'), w('Shoulder', 'Yelka', '🤷'),
    w('Back', 'Orqa', '🔙'), w('Chest', "Ko'krak", '🫁'), w('Knee', 'Tizza', '🦵'),
  ]),
  topic('intermediate', 'Quarantine', '😷', [
    w('Mask', 'Niqob', '😷'), w('Gloves', "Qo'lqop", '🧤'), w('Sanitizer', 'Antiseptik', '🧴'),
    w('Vaccine', 'Vaksina', '💉'), w('Virus', 'Virus', '🦠'), w('Hospital', 'Kasalxona', '🏥'),
    w('Isolation', 'Izolyatsiya', '🚪'), w('Temperature', 'Harorat', '🌡️'), w('Social distance', 'Ijtimoiy masofa', '↔️'),
  ]),
  topic('intermediate', 'Cosmetics', '💄', [
    w('Lipstick', "Lab bo'yog'i", '💄'), w('Mascara', 'Tush', '👁️'), w('Foundation', 'Ton krem', '🧴'),
    w('Perfume', 'Atir', '🧴'), w('Powder', 'Puder', '🧴'), w('Nail polish', 'Lak', '💅'),
    w('Blush', 'Qizil (yonoq)', '🌸'), w('Eyeliner', "Ko'z qalami", '✏️'), w('Cream', 'Krem', '🧴'),
  ]),
  topic('intermediate', 'Chess', '♟️', [
    w('King', 'Shoh', '♔'), w('Queen', 'Farzin', '♕'), w('Rook', "Qal'a", '♖'),
    w('Bishop', 'Fil', '♗'), w('Knight', 'Ot', '♘'), w('Pawn', 'Piyoda', '♙'),
    w('Board', 'Doska', '♟️'), w('Checkmate', 'Mot', '👑'), w('Move', 'Yurish', '➡️'),
  ]),
  topic('intermediate', 'Prepositions', '🧭', [
    w('About', 'Haqida', '💬'), w('Across', "Bo'ylab", '↔️'), w('Through', 'Orqali', '➡️'),
    w('Along', "Bo'ylab", '↔️'), w('Around', 'Atrofida', '🔄'), w('Beside', 'Yonida', '➡️'),
    w('Beyond', "Naryog'ida", '⬆️'), w('Toward', 'Tomon', '➡️'), w('Within', 'Ichida', '⬇️'),
  ]),

  // ─── Yuqori (Advanced) — 25 mavzu ────────────────────────────────────────────
  topic('advanced', 'Baby care', '🍼', [
    w('Diaper', 'Bolalar tagligi', '🍼'), w('Bottle', 'Emizik shishasi', '🍼'), w('Pacifier', "So'rg'ich", '🍼'),
    w('Stroller', 'Aravacha', '🚼'), w('Crib', 'Beshik', '🛏️'), w('Bib', 'Ovqatlanish salfetkasi', '🧑‍🍼'),
    w('Baby powder', 'Bolalar kukuni', '🧴'), w('Rattle', 'Shildiroqcha', '🎉'), w('Wipes', 'Salfetkalar', '🧻'),
  ]),
  topic('advanced', 'Car repair shop', '🔧', [
    w('Mechanic', 'Mexanik', '🧑‍🔧'), w('Wrench', 'Kalit', '🔧'), w('Jack', 'Domkrat', '🚗'),
    w('Tire', 'Shina', '🛞'), w('Oil', 'Moy', '🛢️'), w('Engine', 'Dvigatel', '⚙️'),
    w('Toolbox', 'Asboblar qutisi', '🧰'), w('Battery', 'Akkumulyator', '🔋'), w('Lift', "Ko'targich", '🏗️'),
  ]),
  topic('advanced', 'Prepositions', '🧭', [
    w('Inside', 'Ichkarida', '⬇️'), w('Outside', 'Tashqarida', '⬆️'), w('Under', 'Ostida', '⬇️'),
    w('Over', 'Ustidan', '⬆️'), w('Between', 'Orasida', '↔️'), w('Near', 'Yaqinida', '📍'),
    w('Far', 'Uzoqda', '🏞️'), w('Against', 'Qarshi', '⚔️'), w('Among', 'Orasida', '👥'),
  ]),
  topic('advanced', 'Musical instruments', '🎸', [
    w('Guitar', 'Gitara', '🎸'), w('Piano', 'Pianino', '🎹'), w('Violin', 'Skripka', '🎻'),
    w('Drum', 'Baraban', '🥁'), w('Flute', 'Nay', '🪈'), w('Trumpet', 'Truba', '🎺'),
    w('Saxophone', 'Saksofon', '🎷'), w('Harp', 'Arfa', '🎼'), w('Accordion', 'Akkordeon', '🪗'),
  ]),
  topic('advanced', 'Sea', '🌊', [
    w('Wave', "To'lqin", '🌊'), w('Beach', 'Plyaj', '🏖️'), w('Fish', 'Baliq', '🐟'),
    w('Shell', "Chig'anoq", '🐚'), w('Ship', 'Kema', '🚢'), w('Sand', 'Qum', '🏖️'),
    w('Coral', 'Marjon', '🪸'), w('Dolphin', 'Delfin', '🐬'), w('Anchor', 'Langar', '⚓'),
  ]),
  topic('advanced', 'Organs', '🫀', [
    w('Heart', 'Yurak', '❤️'), w('Lungs', "O'pka", '🫁'), w('Liver', 'Jigar', '🫀'),
    w('Kidney', 'Buyrak', '🫘'), w('Stomach', 'Oshqozon', '🫃'), w('Brain', 'Miya', '🧠'),
    w('Intestine', 'Ichak', '🌀'), w('Bladder', 'Siydik pufagi', '🫧'), w('Pancreas', 'Oshqozon osti bezi', '🫀'),
  ]),
  topic('advanced', 'Sports equipment', '🏈', [
    w('Ball', "To'p", '⚽'), w('Racket', 'Raketka', '🎾'), w('Helmet', 'Kaska', '🪖'),
    w('Gloves', "Qo'lqop", '🧤'), w('Whistle', 'Hushtak', '📯'), w('Net', "To'r", '🥅'),
    w('Bat', 'Tayoqcha', '🏏'), w('Skates', 'Konki', '⛸️'), w('Weights', 'Gantel', '🏋️'),
  ]),
  topic('advanced', 'Cleaning', '🧹', [
    w('Broom', 'Supurgi', '🧹'), w('Mop', 'Shvabra', '🧽'), w('Bucket', 'Chelak', '🪣'),
    w('Sponge', 'Gubka', '🧽'), w('Detergent', 'Yuvish vositasi', '🧴'), w('Vacuum cleaner', 'Changyutgich', '🧹'),
    w('Duster', 'Chang artgich', '🪶'), w('Gloves', "Qo'lqop", '🧤'), w('Trash bag', 'Axlat qopi', '🗑️'),
  ]),
  topic('advanced', 'Cooking', '👨‍🍳', [
    w('Pan', 'Tova', '🍳'), w('Pot', 'Qozon', '🍲'), w('Knife', 'Pichoq', '🔪'),
    w('Spoon', 'Qoshiq', '🥄'), w('Oven', 'Pech', '🔥'), w('Stove', 'Plita', '🍳'),
    w('Cutting board', 'Kesish taxtasi', '🪵'), w('Recipe', 'Retsept', '📖'), w('Ingredients', 'Ingredientlar', '🧂'),
  ]),
  topic('advanced', 'Natural disasters', '🌪️', [
    w('Earthquake', 'Zilzila', '🌍'), w('Flood', 'Sel', '🌊'), w('Tornado', 'Tornado', '🌪️'),
    w('Hurricane', 'Uragan', '🌀'), w('Volcano', 'Vulqon', '🌋'), w('Drought', "Qurg'oqchilik", '🏜️'),
    w('Wildfire', "O'rmon yong'ini", '🔥'), w('Landslide', "Ko'chki", '⛰️'), w('Tsunami', 'Sunami', '🌊'),
  ]),
  topic('advanced', 'Instruments', '🎻', [
    w('Cello', 'Violonchel', '🎻'), w('Clarinet', 'Klarnet', '🎵'), w('Tuba', 'Tuba', '🎺'),
    w('Xylophone', 'Ksilofon', '🎼'), w('Banjo', 'Banjo', '🪕'), w('Harmonica', 'Garmonika', '🎵'),
    w('Bagpipes', 'Volinka', '🎶'), w('Cymbals', 'Chinni likopcha', '🥁'), w('Triangle', 'Uchburchak', '🔺'),
  ]),
  topic('advanced', 'Garden furniture', '🪑', [
    w('Bench', "O'rindiq", '🪑'), w('Hammock', 'Osma karavot', '🛏️'), w('Table', 'Stol', '🪑'),
    w('Umbrella', 'Soyabon', '⛱️'), w('Chair', 'Stul', '💺'), w('Swing', "Salinchoq", '🛝'),
    w('Fire pit', "Gulxan o'chog'i", '🔥'), w('Planter', 'Gul tuvagi', '🪴'), w('Fence', "To'siq", '🚧'),
  ]),
  topic('advanced', 'Precious stones', '💎', [
    w('Diamond', 'Olmos', '💎'), w('Ruby', 'Yoqut', '❤️'), w('Emerald', 'Zumrad', '💚'),
    w('Sapphire', 'Safir', '💙'), w('Pearl', 'Marvarid', '🦪'), w('Amethyst', 'Ametist', '💜'),
    w('Topaz', 'Topaz', '💛'), w('Opal', 'Opal', '🤍'), w('Gold', 'Oltin', '🥇'),
  ]),
  topic('advanced', 'Flyer', '🦋', [
    w('Bee', 'Asalari', '🐝'), w('Butterfly', 'Kapalak', '🦋'), w('Dragonfly', 'Ninachi', '🌈'),
    w('Moth', 'Parvona', '🦋'), w('Wasp', 'Ari', '🐝'), w('Hummingbird', 'Kolibri', '🐦'),
    w('Bat', "Ko'rshapalak", '🦇'), w('Eagle', 'Burgut', '🦅'), w('Sparrow', 'Chumchuq', '🐦'),
  ]),
  topic('advanced', 'Automobiles', '🚘', [
    w('Sedan', 'Sedan', '🚗'), w('SUV', 'Yo\'ltanlamas', '🚙'), w('Truck', 'Yuk mashinasi', '🚚'),
    w('Van', 'Furgon', '🚐'), w('Convertible', 'Ochiq tomli mashina', '🚗'), w('Motorcycle', 'Mototsikl', '🏍️'),
    w('Bus', 'Avtobus', '🚌'), w('Pickup', 'Pikap', '🛻'), w('Sports car', 'Sport mashinasi', '🏎️'),
  ]),
  topic('advanced', 'Trees', '🌳', [
    w('Oak', 'Eman', '🌳'), w('Pine', "Qarag'ay", '🌲'), w('Maple', 'Zarang', '🍁'),
    w('Birch', 'Qayin', '🌳'), w('Palm', 'Palma', '🌴'), w('Willow', 'Tol', '🌳'),
    w('Cedar', 'Kedr', '🌲'), w('Cherry tree', 'Gilos daraxti', '🌸'), w('Bamboo', 'Bambuk', '🎍'),
  ]),
  topic('advanced', 'Air travel', '🛩️', [
    w('Airplane', 'Samolyot', '✈️'), w('Airport', 'Aeroport', '🛫'), w('Pilot', 'Uchuvchi', '👨‍✈️'),
    w('Flight attendant', 'Styuardessa', '👩‍✈️'), w('Boarding pass', 'Qadam kartasi', '🎟️'), w('Runway', "Uchish yo'lagi", '🛬'),
    w('Luggage', 'Yuk', '🧳'), w('Ticket', 'Chipta', '🎫'), w('Turbulence', 'Turbulentlik', '💨'),
  ]),
  topic('advanced', 'Baby animals', '🐣', [
    w('Puppy', 'Kuchukcha', '🐶'), w('Kitten', 'Mushukcha', '🐱'), w('Chick', "Jo'ja", '🐣'),
    w('Foal', 'Toychoq', '🐴'), w('Calf', 'Buzoq', '🐄'), w('Lamb', "Qo'zichoq", '🐑'),
    w('Cub', 'Yosh hayvon', '🐻'), w('Duckling', "O'rdakcha", '🐤'), w('Piglet', "Cho'chqacha", '🐷'),
  ]),
  topic('advanced', 'First aid kit', '🩹', [
    w('Bandage', 'Bint', '🩹'), w('Plaster', 'Leykoplastir', '🩹'), w('Antiseptic', 'Antiseptik', '🧴'),
    w('Scissors', 'Qaychi', '✂️'), w('Gauze', 'Marla', '🩹'), w('Thermometer', 'Termometr', '🌡️'),
    w('Tweezers', 'Pinset', '🔧'), w('Gloves', "Qo'lqop", '🧤'), w('Cotton', 'Paxta', '☁️'),
  ]),
  topic('advanced', 'Ecology', '🌍', [
    w('Recycling', 'Qayta ishlash', '♻️'), w('Pollution', 'Ifloslanish', '🏭'), w('Forest', "O'rmon", '🌲'),
    w('Ozone', 'Ozon', '🌐'), w('Solar panel', 'Quyosh paneli', '☀️'), w('Wind turbine', 'Shamol turbinasi', '💨'),
    w('Waste', 'Chiqindi', '🗑️'), w('Water', 'Suv', '💧'), w('Earth', 'Yer', '🌍'),
  ]),
  topic('advanced', 'At the police station', '🚓', [
    w('Officer', 'Politsiyachi', '👮'), w('Handcuffs', 'Kishan', '⛓️'), w('Badge', 'Nishon', '🎖️'),
    w('Uniform', 'Forma', '👮'), w('Cell', 'Hibsxona', '🔒'), w('Report', 'Hisobot', '📋'),
    w('Siren', 'Sirena', '🚨'), w('Radio', 'Radio', '📻'), w('Gun', 'Qurol', '🔫'),
  ]),
  topic('advanced', 'Hairstyles', '💇', [
    w('Braid', "O'rma", '💇‍♀️'), w('Ponytail', 'Quyruqcha', '💁‍♀️'), w('Bun', "Soch to'plami", '💁'),
    w('Curls', 'Jingalak soch', '👩‍🦱'), w('Bangs', 'Peshtoq soch', '💇'), w('Bald', 'Taqir bosh', '👨‍🦲'),
    w('Bob', 'Bob kesim', '💇‍♀️'), w('Afro', 'Afro soch', '👨‍🦱'), w('Mohawk', 'Moxikan', '🎸'),
  ]),
  topic('advanced', 'Hygiene products', '🧻', [
    w('Soap', 'Sovun', '🧼'), w('Shampoo', 'Shampun', '🧴'), w('Conditioner', 'Balzam', '🧴'),
    w('Toothpaste', 'Tish pastasi', '🧴'), w('Floss', 'Tish ipi', '🧵'), w('Mouthwash', "Og'iz chayqash vositasi", '🧴'),
    w('Cotton swab', 'Vatalka', '🧻'), w('Nail clipper', 'Tirnoq qaychisi', '💅'), w('Tissue', 'Salfetka', '🧻'),
  ]),
  topic('advanced', 'Seafood', '🦐', [
    w('Shrimp', 'Krevetka', '🦐'), w('Crab', 'Qisqichbaqa', '🦀'), w('Lobster', 'Omar', '🦞'),
    w('Oyster', 'Ustritsa', '🦪'), w('Salmon', 'Losos', '🐟'), w('Tuna', 'Tunets', '🐟'),
    w('Squid', 'Kalmar', '🦑'), w('Octopus', 'Sakkizoyoq', '🐙'), w('Clam', 'Midiya', '🦪'),
  ]),
  topic('advanced', 'The car', '🚕', [
    w('Windshield', 'Old oyna', '🚗'), w('Wiper', 'Stekloochistitel', '🌧️'), w('Bumper', 'Bamper', '🚗'),
    w('License plate', 'Davlat raqami', '🔢'), w('Fuel tank', "Yoqilg'i baki", '⛽'), w('Brake', 'Tormoz', '🛑'),
    w('Clutch', 'Stsepleniya', '🦶'), w('Exhaust', 'Vixlop trubasi', '💨'), w('Spare tire', "Zapas g'ildirak", '🛞'),
  ]),
];

export function getVocabTopicsByLevel(level: VocabLevel): VocabTopic[] {
  return VOCAB_TOPICS.filter((t) => t.level === level);
}
