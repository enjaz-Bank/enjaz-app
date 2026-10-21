// ⚠️ هام جداً: قم بتغيير الرقم مع كل تحديث تقوم به (v18 -> v20 -> v20 ...)
const CACHE_NAME = 'enjaz-v22'; 

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// ==========================================
// حدث التثبيت (Install)
// ==========================================
self.addEventListener('install', (event) => {
  // إجبار الـ Service Worker الجديد على التفعيل فوراً دون انتظار
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// ==========================================
// حدث التفعيل (Activate) - مسح الكاش القديم
// ==========================================
self.addEventListener('activate', (event) => {
  // ✅ هذا السطر هو "المفتاح السحري": يجبر التطبيق على استخدام النسخة الجديدة فوراً
  self.clients.claim();

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          // مسح أي كاش لا يطابق الإصدار الجديد
          if (cache !== CACHE_NAME) {
            console.log('🗑️ مسح الكاش القديم:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// ==========================================
// حدث جلب البيانات (Fetch) - استراتيجية Network First
// ==========================================
self.addEventListener('fetch', (event) => {
  // تجاهل طلبات Firebase API
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('identitytoolkit.googleapis.com') ||
      event.request.url.includes('securetoken.googleapis.com')) {
    return;
  }

  // تجاهل الروابط الخارجية (Tailwind, FontAwesome) لتجنب CORS
  if (!event.request.url.startsWith(self.location.origin)) {
    return; 
  }

  // استراتيجية: الشبكة أولاً (Network First) لضمان أحدث الملفات
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      // إذا نجح الاتصال بالإنترنت، قم بتحديث الكاش بهذه النسخة الجديدة وأعدها للمستخدم
      if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
      }
      return networkResponse;
    }).catch(() => {
      // في حال انقطاع الإنترنت، ابحث في الكاش
      return caches.match(event.request);
    })
  );
});
