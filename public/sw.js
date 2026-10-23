const CACHE_NAME = 'verdevale-static-v2';
const APP_SHELL = ['/', '/bio', '/panfleto-de-ofertas'];
const VAPID_PUBLIC_KEY =
  'BPlBuxt_eTlKP9YMr2wNo-7g2VNtbtKDtgVCUE7woK4sLqo5EWJjnc3SXwSy5IfRs58pEjKW7mtoB6Sm_qGZtMU';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        APP_SHELL.map(async (path) => {
          const response = await fetch(path);
          if (response.ok) await cache.put(path, response);
        }),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/conta')
  ) {
    return;
  }

  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? Response.error()),
    );
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { message: event.data?.text() ?? '' };
  }

  const title =
    typeof payload.title === 'string' && payload.title.trim()
      ? payload.title.trim().slice(0, 80)
      : 'Ofertas do Supermercado';
  const body =
    typeof payload.message === 'string'
      ? payload.message.slice(0, 240)
      : typeof payload.body === 'string'
        ? payload.body.slice(0, 240)
        : '';
  const icon =
    typeof payload.icon === 'string' && payload.icon.trim()
      ? payload.icon.trim()
      : '/icon.png';
  const destination = typeof payload.link === 'string' ? payload.link : '/';
  let url = new URL('/', self.location.origin);
  try {
    const candidate = new URL(destination, self.location.origin);
    if (candidate.origin === self.location.origin) url = candidate;
  } catch {
    url = new URL('/', self.location.origin);
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/icons/icon-192.png',
      data: { url: url.href },
    }),
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keyResponse = await fetch('/api/push/subscribe').catch(() => null);
        const keyJson = keyResponse && keyResponse.ok ? await keyResponse.json() : null;
        const activePublicKey =
          keyJson && typeof keyJson.publicKey === 'string' && keyJson.publicKey
            ? keyJson.publicKey
            : VAPID_PUBLIC_KEY;

        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(activePublicKey),
        });

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        });
      } catch (err) {
        console.error('Falha ao renovar inscrição push no Service Worker:', err);
      }
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destination = event.notification.data?.url;
  let target = self.location.origin + '/';
  try {
    const candidate = new URL(destination || '/', self.location.origin);
    if (candidate.origin === self.location.origin) target = candidate.href;
  } catch {
    target = self.location.origin + '/';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const openClient = clients.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (openClient) {
        await openClient.navigate(target);
        return openClient.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
