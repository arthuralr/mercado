const CACHE_NAME = 'verdevale-static-v1';
const APP_SHELL = ['/', '/bio', '/panfleto-de-ofertas'];

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
    payload = { body: event.data?.text() ?? '' };
  }

  const title =
    typeof payload.title === 'string' && payload.title.trim()
      ? payload.title.trim().slice(0, 80)
      : 'Ofertas do Supermercado';
  const body = typeof payload.message === 'string' ? payload.message.slice(0, 240) : '';
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
      icon: '/icon.png',
      badge: '/icons/icon-192.png',
      data: { url: url.href },
    }),
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
      const openClient = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (openClient) {
        await openClient.navigate(target);
        return openClient.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
