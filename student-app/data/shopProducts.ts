import { Ionicons } from '@expo/vector-icons';

export type ShopCategory = 'merch' | 'books' | 'gadgets' | 'stationery';

export const SHOP_CATEGORY_LABELS: Record<ShopCategory, string> = {
  merch: 'Homework',
  books: 'Kitoblar',
  gadgets: 'Gadgetlar',
  stationery: 'Kontsstovarlar',
};

export type ShopProduct = {
  id: string;
  name: string;
  category: ShopCategory;
  price: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  delivered?: boolean;
  // CRM'da mahsulotga haqiqiy rasm yuklansa shu maydon to'ldiriladi — mavjud
  // bo'lsa icon/color/bg o'rniga shu rasm ko'rsatiladi.
  imageUrl?: string;
};

export const SHOP_PRODUCTS: ShopProduct[] = [
  { id: 'merch-tshirt', name: 'Homework futbolkasi', category: 'merch', price: 600, icon: 'shirt-outline', color: '#7B61FF', bg: '#EDE9FE', delivered: true },
  { id: 'merch-mug', name: 'Homework bokali', category: 'merch', price: 400, icon: 'cafe-outline', color: '#2563EB', bg: '#DBEAFE', delivered: true },
  { id: 'merch-pen', name: 'Homework ruchkasi', category: 'merch', price: 150, icon: 'create-outline', color: '#D97706', bg: '#FEF3C7', delivered: true },
  { id: 'merch-notebook', name: 'Homework daftari', category: 'merch', price: 200, icon: 'book-outline', color: '#059669', bg: '#D1FAE5', delivered: true },
  { id: 'book-grammar', name: 'Grammar in Use kitobi', category: 'books', price: 800, icon: 'library-outline', color: '#7B61FF', bg: '#EDE9FE', delivered: true },
  { id: 'book-vocabulary', name: 'Vocabulary in Use kitobi', category: 'books', price: 900, icon: 'library-outline', color: '#2563EB', bg: '#DBEAFE', delivered: true },
  { id: 'gadget-earbuds', name: 'Simsiz quloqchinlar', category: 'gadgets', price: 2500, icon: 'headset-outline', color: '#DB2777', bg: '#FCE7F3', delivered: true },
  { id: 'gadget-powerbank', name: "Quvvat banki (Power bank)", category: 'gadgets', price: 1800, icon: 'battery-charging-outline', color: '#059669', bg: '#D1FAE5', delivered: true },
  { id: 'gadget-mouse', name: 'Simsiz sichqoncha', category: 'gadgets', price: 1200, icon: 'hardware-chip-outline', color: '#4B5563', bg: '#F3F4F6', delivered: true },
  { id: 'stationery-pencils', name: "Ranglar to'plami", category: 'stationery', price: 300, icon: 'color-palette-outline', color: '#D97706', bg: '#FEF3C7', delivered: true },
  { id: 'stationery-folder', name: 'Fayl-papka', category: 'stationery', price: 100, icon: 'folder-outline', color: '#2563EB', bg: '#DBEAFE', delivered: true },
];
