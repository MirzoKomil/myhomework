/**
 * Holatlar ko'rgazmasi — Loading va ServerError komponentlarini alohida
 * ko'rish (skrinshot) uchun: /v2/holatlar?state=loading|error.
 * Haqiqiy ma'lumot ishlatmaydi, hech narsa saqlamaydi.
 */
import { router, useLocalSearchParams } from 'expo-router';

import { Loading } from '@/components/v2/states/Loading';
import { ServerError } from '@/components/v2/states/ServerError';

export default function V2States() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  if (state === 'error') return <ServerError onRetry={() => router.setParams({ state: 'loading' })} />;
  return <Loading />;
}
