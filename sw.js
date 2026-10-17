const CACHE_NAME = 'enjaz-v1';
const ASSETS_TO_CACHE = [
  './',
  './app.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// تثبيت الـ Service Worker وتخزين الملفات الأساسية
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch(err => console.log('Cache error:', err))
  );
});

// تفعيل وحذف الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// اعتراض الطلبات (Cache First للأصول الثابتة)
self.addEventListener('fetch', (event) => {
  // تجاهل طلبات Firebase API و Firestore (حتى لا يتعارض مع Offline persistence)
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('identitytoolkit.googleapis.com') ||
      event.request.url.includes('securetoken.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // إذا وُجد في الكاش، أرجعه
      if (response) return response;
      
      // إذا لم يوجد، اطلبه من الشبكة وخزنه
      return fetch(event.request).then((networkResponse) => {
        // لا تخزن إلا الطلبات الناجحة من نوع GET
        if (!networkResponse || networkResponse.status !== 200 || event.request.method !== 'GET') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // عند انقطاع الإنترنت ولا يوجد في الكاش
        // يمكن إرجاع صفحة أوفلاين مخصصة هنا إذا أردت
      });
    })
  );
});
