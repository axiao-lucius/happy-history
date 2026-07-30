/**
 * 快乐学历史 · Service Worker v2.0
 * 策略：
 * 1) 安装时预缓存核心资源 + 全部题库 → 首次访问后完全离线可用
 * 2) 使用相对路径，兼容 https://xxx.github.io/happy-history/ 子路径部署
 * 3) 启动时主动重缓存关键资源，重置 iOS 7 天缓存过期计时器
 * 4) 缓存策略：
 *    - 题库 JSON：Stale-While-Revalidate（先返回缓存，后台更新）
 *    - HTML/CSS/JS：Cache-First（离线优先）
 *    - 其他：Network-First fallback Cache
 */

const CACHE_VERSION = 'v2.0.0';
const CACHE_NAME = `happy-history-${CACHE_VERSION}`;

// 使用相对路径 → SW 的 scope 内自动解析
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css?v=2',
  './js/app.js?v=2',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg',
  './data/quiz-v4.json',
];

// 安装：预缓存所有核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] precache failed:', err))
  );
});

// 激活：清理旧版缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// 拦截请求
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 只处理同源请求
  if (url.origin !== self.location.origin) return;

  // 题库 JSON：Stale-While-Revalidate
  if (url.pathname.endsWith('.json') && url.pathname.includes('/data/')) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // 导航请求（页面）：Network-First → Cache-Fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 静态资源：Cache-First
  event.respondWith(cacheFirst(req));
});

// -------- 缓存策略实现 --------
async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch (e) {
    // 兜底：找同路径任何版本
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req, { ignoreSearch: true });
  const fetchPromise = fetch(req).then(res => {
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || fetchPromise;
}

// -------- 客户端消息：主动刷新关键资源（防 iOS 7 天过期） --------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'REFRESH_CORE') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache =>
        cache.addAll(CORE_ASSETS).catch(err => console.warn('[SW] refresh failed:', err))
      )
    );
  }
});
