import { Platform } from 'react-native';
import { useEffect, useState } from 'react';

import { DeliveryStage } from '@/data/mock';
import { ShopProduct } from '@/data/shopProducts';
import { addCoins, getTotalCoins } from '@/services/coinsStore';

// Homework Shop buyurtmalari — ilgari faqat qurilma xotirasida (AsyncStorage)
// yashagan, bosqichi hech qachon o'zgarmagan (doim "preparing") edi. Endi
// serverda saqlanadi: CRM'ning "Yetkazib berish" kanban'i bosqichni
// o'zgartirsa, shu yerdan qayta yuklanganda darhol ko'rinadi.
const API_BASE =
  Platform.OS === 'web'
    ? '/api/state/demo-shop-orders'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/demo-shop-orders';

export type ShopOrder = {
  id: string;
  productId: string;
  productName: string;
  category?: string;
  price: number;
  date: string;
  stage: DeliveryStage;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
};

let orders: ShopOrder[] = [];

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOrders(): ShopOrder[] {
  return orders;
}

function fromServerOrder(o: any): ShopOrder {
  return {
    id: o.id,
    productId: o.productId,
    productName: o.productName,
    category: o.category,
    price: o.price,
    date: o.createdAt ? new Date(o.createdAt).toLocaleDateString('uz-UZ') : '',
    stage: o.stage,
    dispatchedAt: o.dispatchedAt ?? null,
    deliveredAt: o.deliveredAt ?? null,
  };
}

// Har chaqirilganda serverdan qayta yuklaydi — CRM'da bosqich o'zgartirilsa,
// o'quvchi bu ekranga qaytganda darhol yangilangan holatni ko'radi.
export async function loadOrders(): Promise<void> {
  try {
    const res = await fetch(API_BASE);
    const data = await res.json();
    if (Array.isArray(data.orders)) orders = data.orders.map(fromServerOrder);
  } catch {
    // Tarmoq xatosi bo'lsa, oldingi holat saqlanib qoladi.
  } finally {
    notify();
  }
}

export async function placeOrder(product: ShopProduct): Promise<boolean> {
  if (getTotalCoins() < product.price) return false;
  await addCoins(-product.price);
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.id,
        productName: product.name,
        category: product.category,
        price: product.price,
      }),
    });
    const data = await res.json();
    if (data.order) {
      orders = [fromServerOrder(data.order), ...orders];
      notify();
    }
  } catch {
    // Buyurtma serverga yozilmasa ham coin allaqachon yechilgan — jim
    // o'tkazib yuboramiz, keyingi loadOrders() qayta urinib ko'radi.
  }
  return true;
}

export function useOrders(): ShopOrder[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    loadOrders().then(() => setTick((t) => t + 1));
    return subscribe(() => setTick((t) => t + 1));
  }, []);
  return getOrders();
}
