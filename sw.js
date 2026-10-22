/* ============================================
 * Service Worker - منصة إنجاز الأكاديمية (v3)
 * محسّن لـ TWA - تحديث تلقائي ذكي
 * ============================================
 *
 * ⚠️ هام: قم بتغيير رقم الإصدار (CACHE_NAME) عند كل تحديث للكود
 * مثال: enjaz-v23 → enjaz-v24 → enjaz-v25 ...
 *
 * ✨ الميزات الجديدة في v3:
 * 1. اكتشاف التحديثات تلقائياً عند فتح التطبيق
 * 2. إجبار التحديث فوراً (skipWaiting + claim)
 * 3. إشعار التطبيق بوجود نسخة جديدة (message event)
 * 4. تحديث index.html بأولوية قصوى (network-first صارم)
 * 5. فحص التحديثات كل 5 دقائق تلقائياً
 * ============================================ */

// ⚠️ غيّر هذا الرقم مع كل تحديث للكود (v23 -> v24 -> v25 ...)
const CACHE_NAME = 'enjaz-v23';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// ==========================================
// حدث التثبيت (Install)
// ==========================================
self.addEventListener('install', (event) => {
  // ✅ إجبار الـ Service Worker الجديد على التفعيل فوراً دون انتظار إغلاق التبويبات
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// ==========================================
// حدث التفعيل (Activate) - مسح الكاش القديم + إجبار التحديث
// ==========================================
self.addEventListener('activate', (event) => {
  // ✅ المفتاح السحري: يجبر التطبيق على استخدام النسخة الجديدة فوراً
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
    }).then(() => {
      // ✅ إشعار جميع التبويبات المفتوحة بوجود نسخة جديدة
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: CACHE_NAME,
            timestamp: Date.now()
          });
        });
      });
    })
  );
});

// ==========================================
// حدث الرسائل (Message) - للتواصل مع التطبيق
// ==========================================
self.addEventListener('message', (event) => {
  // ✅ التطبيق يطلب التحديث الفوري
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // ✅ التطبيق يطلب فحص التحديثات
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    // إجبار فحص التحديث من الشبكة
    fetch('./sw.js', { cache: 'no-store' }).then(() => {
      self.skipWaiting();
    }).catch(() => {});
  }
});

// ==========================================
// حدث جلب البيانات (Fetch) - استراتيجية Network First ذكية
// ==========================================
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // ⚠️ تجاهل طلبات Firebase API
  if (requestUrl.hostname.includes('firestore.googleapis.com') ||
      requestUrl.hostname.includes('identitytoolkit.googleapis.com') ||
      requestUrl.hostname.includes('securetoken.googleapis.com') ||
      requestUrl.hostname.includes('gstatic.com') ||
      requestUrl.hostname.includes('firebaseio.com')) {
    return;
  }

  // ⚠️ تجاهل الروابط الخارجية (Tailwind, FontAwesome, Google Fonts) لتجنب CORS
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // ⚠️ تجاهل طلبات non-GET
  if (event.request.method !== 'GET') {
    return;
  }

  // ✅ استراتيجية خاصة لـ index.html: Network First صارمة + no-cache
  // هذا يضمن أن أي تعديل على index.html يظهر فوراً
  if (requestUrl.pathname === '/' ||
      requestUrl.pathname === '/enjaz-app/' ||
      requestUrl.pathname === '/enjaz-app/index.html' ||
      requestUrl.pathname.endsWith('/index.html')) {

    event.respondWith(
      fetch(event.request, {
        cache: 'no-cache',
        credentials: 'same-origin'
      }).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          // تحديث الكاش بالنسخة الجديدة
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // في حال انقطاع الإنترنت، استخدم الكاش
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // ✅ استراتيجية عامة: Network First مع fallback للكاش
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
      }
      return networkResponse;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});

// ==========================================
// ✅ فحص دوري للتحديثات كل 5 دقائق
// ==========================================
setInterval(() => {
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    if (clients.length > 0) {
      // يوجد مستخدم نشط - فحص التحديث
      fetch('./sw.js', { cache: 'no-store' }).catch(() => {});
    }
  });
}, 5 * 60 * 1000); // 5 دقائق
