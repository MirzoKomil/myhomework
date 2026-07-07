import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { DeliveryStage } from '@/data/mock';
import { ShopProduct } from '@/data/shopProducts';
import { addCoins, getTotalCoins } from '@/services/coinsStore';

const ORDERS_KEY = 'mh_shop_orders';

export type ShopOrder = {
  id: string;
  productId: string;
  productName: string;
  price: number;
  date: string;
  stage: DeliveryStage;
};

let orders: ShopOrder[] = [];
let loaded = false;
let loadPromise: Promise<void> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(ORDERS_KEY)
      .then((raw) => {
        orders = raw ? JSON.parse(raw) : [];
      })
      .catch(() => {
        orders = [];
      })
      .finally(() => {
        loaded = true;
      });
  }
  return loadPromise;
}

async function persist() {
  try {
    await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch {
    // Xotiraga yozib bo'lmasa jim o'tkazib yuboramiz.
  }
}

export function getOrders(): ShopOrder[] {
  return orders;
}

export async function loadOrders(): Promise<void> {
  await ensureLoaded();
  notify();
}

export async function placeOrder(product: ShopProduct): Promise<boolean> {
  await ensureLoaded();
  if (getTotalCoins() < product.price) return false;
  await addCoins(-product.price);
  orders = [
    {
      id: `order-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      price: product.price,
      date: new Date().toLocaleDateString('uz-UZ'),
      stage: 'preparing',
    },
    ...orders,
  ];
  notify();
  await persist();
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
