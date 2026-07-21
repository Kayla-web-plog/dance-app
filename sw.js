// 舞力打卡 - Service Worker
const CACHE_NAME = 'dance-app-v4';
const CACHE_URLS = [
  '/',
  '/css/app.css',
  '/js/utils.js',
  '/js/ui.js',
  '/js/api.js',
  '/js/app-core.js',
  '/js/app-init.js',
  '/js/modules/auth.js',
  '/js/modules/card.js',
  '/js/modules/schedule.js',
  '/js/modules/smartSchedule.js',
  '/js/modules/checkin.js',
  '/js/modules/share.js',
  '/js/modules/home.js',
  '/js/modules/reminders.js',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png'
];

// 安装
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] caching app shell');
      return cache.addAll(CACHE_URLS).catch(err => {
        console.log('[SW] cache addAll error:', err);
      });
    })
  );
  self.skipWaiting();
});

// 激活
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 拦截请求
self.addEventListener('fetch', (event) => {
  // API请求不缓存，走网络
  if (event.request.url.includes('/api/')) {
    return event.respondWith(fetch(event.request));
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // 缓存静态资源
        if (event.request.url.match(/\.(css|js|png|jpg|svg|ico|json)$/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// 推送通知
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '舞力打卡';
  const options = {
    body: data.body || '该上课啦！',
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-192.png',
    vibrate: [200, 100, 200]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
