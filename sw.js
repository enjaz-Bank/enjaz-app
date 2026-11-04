/* ============================================
 * Service Worker - منصة إنجاز الأكاديمية (v26)
 * محسّن لـ TWA - تحديث تلقائي ذكي
 *
 * ✨ الجديد في v26:
 *   ← حل مشكلة اختفاء CSS عند انقطاع الإنترنت!
 *   ← تخزين موارد CDN إجبارياً (Tailwind, Font Awesome, Cairo)
 *   ← تجاوز ترويسة no-store التي يرسلها tailwindcss.com
 *   ← الاحتفاظ بكل مزايا v25 (التحديث التلقائي، الفحص الدوري)
 *
 * ⚠️ هام: قم بتغيير رقم الإصدار عند كل تحديث
 * مثال: enjaz-v26 → enjaz-v27 → enjaz-v28 ...
 * ============================================ */

// ⚠️ غيّر هذا الرقم مع كل تحديث للكود
const CACHE_NAME = 'enjaz-v28';

// ✅ كاش مخصص لموارد CDN الخارجية
const CDN_CACHE_NAME = `${CACHE_NAME}-cdn`;

// ✅ موارد محلية لتخزينها فوراً عند التثبيت
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// ✅ موارد CDN التي يجب تخزينها إجبارياً (رغم no-store)
// هذه هي الموارد التي كانت تختفي عند انقطاع الإنترنت
const CDN_PRECACHE = [
  // Tailwind CSS (يرسل no-store، نخزّنه يدوياً)
  'https://cdn.tailwindcss.com',

  // Font Awesome CSS
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',

  // Font Awesome خطوط الأيقونات
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2',

  // خط Cairo - CSS
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap',

  // خط Cairo - ملفات TTF لكل الأوزان
  'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hOA-W1Q.ttf',
  'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hD45W1Q.ttf',
  'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hAc5W1Q.ttf',
  'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hGA5W1Q.ttf',
  'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hEk5W1Q.ttf',

  // Firebase SDK
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js',

  // أيقونة التخرج (تظهر في الهيدر)
  'https://img.icons8.com/3d-fluency/96/graduation-cap.png'
];

// ✅ أنماط URL لموارد CDN (لاستراتيجية CacheFirst)
const CDN_PATTERNS = [
  /cdn\.tailwindcss\.com/,
  /cdnjs\.cloudflare\.com/,
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
  /www\.gstatic\.com/,
  /img\.icons8\.com/
];

// ==========================================
// دالة مساعدة: تخزين مورد CDN متجاوزين no-store
// ==========================================
async function forceCacheCDN(url, cache) {
  try {
    // نستخدم cache: 'no-cache' لإجبار جلب نسخة جديدة
    const response = await fetch(url, {
      cache: 'no-cache',
      credentials: 'omit',
      mode: 'cors'
    });

    if (response && response.ok) {
      // إنشاء Response جديدة بنفس المحتوى لكن بدون ترويسة no-store
      // هذا قانوني ومسموح به — نخزّن نسختنا الخاصة
      const cloned = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers)
      });
      // إزالة ترويسة Cache-Control التي تمنع التخزين
      cloned.headers.delete('Cache-Control');
      cloned.headers.delete('cache-control');

      await cache.put(url, cloned);
      return true;
    }
    return false;
  } catch (err) {
    console.warn(`[SW] فشل تخزين ${url.substring(0, 70)}:`, err.message);
    return false;
  }
}

// ==========================================
// حدث التثبيت (Install)
// ==========================================
self.addEventListener('install', (event) => {
  console.log(`[SW ${CACHE_NAME}] بدء التثبيت...`);

  // ✅ إجبار الـ Service Worker الجديد على التفعيل فوراً
  self.skipWaiting();

  event.waitUntil(
    (async () => {
      // أ) تخزين الموارد المحلية
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(ASSETS_TO_CACHE);
        console.log('[SW] ✅ تم تخزين الموارد المحلية');
      } catch (err) {
        console.warn('[SW] ⚠️ خطأ في تخزين الموارد المحلية:', err.message);
      }

      // ب) تخزين موارد CDN إجبارياً (متجاوزين no-store)
      const cdnCache = await caches.open(CDN_CACHE_NAME);
      let successCount = 0;
      let failCount = 0;

      console.log(`[SW] بدء تخزين ${CDN_PRECACHE.length} مورد CDN...`);

      // تخزين متوازي لكل موارد CDN
      const results = await Promise.allSettled(
        CDN_PRECACHE.map(async (url) => {
          const ok = await forceCacheCDN(url, cdnCache);
          if (ok) {
            successCount++;
            console.log(`[SW] ✅ تم: ${url.substring(0, 60)}...`);
          } else {
            failCount++;
          }
          return ok;
        })
      );

      console.log(`[SW] اكتمل تخزين CDN: ${successCount} نجح، ${failCount} فشل`);
    })()
  );
});

// ==========================================
// حدث التفعيل (Activate) - مسح الكاش القديم + إجبار التحديث
// ==========================================
self.addEventListener('activate', (event) => {
  console.log(`[SW ${CACHE_NAME}] التفعيل...`);

  // ✅ المفتاح السحري: يجبر التطبيق على استخدام النسخة الجديدة فوراً
  self.clients.claim();

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          // مسح أي كاش لا يطابق الإصدار الجديد (محلي + CDN)
          if (cache !== CACHE_NAME && cache !== CDN_CACHE_NAME) {
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
    fetch('./sw.js', { cache: 'no-store' }).then(() => {
      self.skipWaiting();
    }).catch(() => {});
  }

  // ✅ طلب إعادة تخزين موارد CDN (للاستخدام المستقبلي)
  if (event.data && event.data.type === 'REFRESH_CDN') {
    event.waitUntil(
      (async () => {
        const cdnCache = await caches.open(CDN_CACHE_NAME);
        let count = 0;
        for (const url of CDN_PRECACHE) {
          if (await forceCacheCDN(url, cdnCache)) count++;
        }
        console.log(`[SW] تم تحديث ${count} مورد CDN`);
        event.ports[0]?.postMessage({ refreshed: count });
      })()
    );
  }
});

// ==========================================
// دالة مساعدة: التحقق من نمط URL
// ==========================================
function matchesCDNPattern(url, patterns) {
  return patterns.some(pattern => pattern.test(url));
}

// ==========================================
// حدث جلب البيانات (Fetch)
// ==========================================
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // ⚠️ تجاهل طلبات non-GET
  if (event.request.method !== 'GET') {
    return;
  }

  // ⚠️ تجاهل طلبات Firebase Auth (تحتاج اتصال حي - لا يمكن تخزينها)
  if (requestUrl.hostname.includes('securetoken.googleapis.com') ||
      requestUrl.hostname.includes('identitytoolkit.googleapis.com')) {
    return;
  }

  // ⚠️ تجاهل طلبات Firestore API الحية (لها كاش خاص في المتصفح)
  // ملاحظة: Firestore لديها persistentLocalCache خاص بها
  if (requestUrl.hostname.includes('firestore.googleapis.com')) {
    return;
  }

  // ⚠️ تجاهل طلبات Firestore realtime (websocket)
  if (event.request.headers.get('accept') &&
      event.request.headers.get('accept').includes('text/event-stream')) {
    return;
  }

  // ⚠️ تجاهل Google Analytics
  if (requestUrl.hostname.includes('google-analytics.com') ||
      requestUrl.hostname.includes('googletagmanager.com')) {
    return;
  }

  // ==========================================
  // ✅ استراتيجية 1: موارد CDN (Tailwind, Font Awesome, Cairo)
  // CacheFirst — ابحث في الكاش أولاً، ثم الشبكة
  // ==========================================
  if (matchesCDNPattern(event.request.url, CDN_PATTERNS)) {
    event.respondWith(
      (async () => {
        // 1) تحقق من الكاش أولاً
        const cached = await caches.match(event.request);
        if (cached) {
          return cached;
        }

        // 2) إذا لم يكن في الكاش، حاول الشبكة
        try {
          const response = await fetch(event.request);
          if (response && response.ok) {
            // خزّن نسخة في الكاش (متجاوزين no-store)
            const cdnCache = await caches.open(CDN_CACHE_NAME);
            const cloned = new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: new Headers(response.headers)
            });
            cloned.headers.delete('Cache-Control');
            cdnCache.put(event.request, cloned);
          }
          return response;
        } catch (err) {
          // فشل الاتصال — حاول البحث بأي طريقة
          const cdnCache = await caches.open(CDN_CACHE_NAME);
          const anyMatch = await cdnCache.match(event.request, { ignoreSearch: true });
          if (anyMatch) return anyMatch;
          throw err;
        }
      })()
    );
    return;
  }

  // ==========================================
  // ✅ استراتيجية 2: index.html — Network First صارمة
  // هذا يضمن أن أي تعديل على index.html يظهر فوراً
  // ==========================================
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

  // ==========================================
  // ✅ استراتيجية 3: الموارد المحلية الأخرى (أيقونات، إلخ)
  // CacheFirst
  // ==========================================
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        try {
          const response = await fetch(event.request);
          if (response && response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (err) {
          return caches.match(event.request) || Response.error();
        }
      })()
    );
    return;
  }

  // ⚠️ تجاهل أي طلبات أخرى خارجية لا نعرفها (لتفادي مشاكل CORS)
  // السماح لها بالذهاب للشبكة مباشرة دون اعتراض
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
