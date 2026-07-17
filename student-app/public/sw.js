// 142-ish qayta ish 8: haqiqiy Web Push — ilova yopiq/fon rejimida bo'lsa
// ham, brauzer/qurilma darajasidagi bildirishnoma ko'rsatish uchun.
self.addEventListener('push', (event) => {
  let data = { title: 'Myhomework.uz', body: 'Yangi bildirishnoma bor.' };
  try {
    if (event.data) data = event.data.json();
  } catch {
    // JSON bo'lmasa standart matn ishlatiladi.
  }
  const url = data.url || '/student/notifications';
  event.waitUntil(
    self.registration.showNotification(data.title || 'Myhomework.uz', {
      body: data.body || '',
      icon: '/student/favicon.ico',
      badge: '/student/favicon.ico',
      data: { url },
    })
  );
});

// Bildirishnomaga bosilganda tegishli sahifani ochadi (agar allaqachon ochiq
// tab bo'lsa — o'shani oldinga chiqaradi, aks holda yangi tab ochadi).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/student/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
