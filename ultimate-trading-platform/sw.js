/**
 * Service Worker for Ultimate Trading Platform PWA
 * Provides offline caching and background sync capabilities
 */

const CACHE_NAME = 'trading-platform-v1.0.0';
const RUNTIME_CACHE = 'trading-runtime-v1';
const STATIC_CACHE = 'trading-static-v1';

// Files to cache immediately
const STATIC_ASSETS = [
  './',
  './index.html',
  './ultimate-trading-app.js',
  './services/hyperliquid-service.js',
  './services/ai-optimizer.js',
  './services/subscription-manager.js',
  './services/trading-monitor.js',
  './assets/styles.css',
  './manifest.json'
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/api\/market-data/,
  /\/api\/portfolio/,
  /\/api\/strategies/
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('📦 Service Worker: Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('📦 Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker: Static assets cached');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Service Worker: Caching failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('🔄 Service Worker: Activating...');

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== RUNTIME_CACHE) {
              console.log('🗑️ Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle different types of requests
  if (request.method !== 'GET') {
    return; // Don't cache POST/PUT/DELETE requests
  }

  // Strategy: Cache First for static assets
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Strategy: Network First for API calls
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Strategy: Stale While Revalidate for dynamic content
  event.respondWith(staleWhileRevalidate(request));
});

// Cache First Strategy - for static assets
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, networkResponse.clone());

    return networkResponse;
  } catch (error) {
    console.error('Cache first strategy failed:', error);
    return new Response('Offline - Asset not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Network First Strategy - for API calls
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache...', error);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response(JSON.stringify({
      error: 'Network unavailable',
      offline: true,
      timestamp: Date.now()
    }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Stale While Revalidate - for HTML and dynamic content
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(networkResponse => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(error => {
      console.log('Network request failed:', error);
      return cachedResponse; // Fallback to cache
    });

  // Return cached version immediately if available, otherwise wait for network
  return cachedResponse || fetchPromise;
}

// Background Sync - for offline actions
self.addEventListener('sync', event => {
  console.log('🔄 Background Sync:', event.tag);

  if (event.tag === 'trading-actions') {
    event.waitUntil(syncTradingActions());
  }

  if (event.tag === 'portfolio-update') {
    event.waitUntil(syncPortfolioUpdates());
  }
});

// Sync trading actions when back online
async function syncTradingActions() {
  try {
    console.log('📤 Syncing trading actions...');

    const db = await openDatabase();
    const pendingActions = await getPendingTradingActions(db);

    for (const action of pendingActions) {
      try {
        const response = await fetch('/api/execute-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action)
        });

        if (response.ok) {
          await removePendingAction(db, action.id);
          console.log('✅ Synced trading action:', action.id);
        }
      } catch (error) {
        console.error('Failed to sync action:', action.id, error);
      }
    }
  } catch (error) {
    console.error('Trading actions sync failed:', error);
  }
}

// Sync portfolio updates
async function syncPortfolioUpdates() {
  try {
    console.log('📊 Syncing portfolio updates...');

    const response = await fetch('/api/portfolio/sync');
    if (response.ok) {
      const portfolioData = await response.json();

      // Notify all clients of portfolio update
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'PORTFOLIO_UPDATE',
          data: portfolioData
        });
      });
    }
  } catch (error) {
    console.error('Portfolio sync failed:', error);
  }
}

// Push notifications for trading alerts
self.addEventListener('push', event => {
  console.log('📨 Push notification received');

  const options = {
    body: event.data ? event.data.text() : 'New trading alert',
    icon: '/assets/icon-192x192.png',
    badge: '/assets/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: 'View Details',
        icon: '/assets/action-view.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/assets/action-close.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Ultimate Trading Platform', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('👆 Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/index.html#alerts')
    );
  } else if (event.action === 'close') {
    // Just close the notification
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/index.html')
    );
  }
});

// Message handling from main thread
self.addEventListener('message', event => {
  console.log('💬 Service Worker received message:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_STRATEGY_DATA') {
    cacheStrategyData(event.data.strategies);
  }
});

// Utility functions
function isStaticAsset(url) {
  const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

function isApiRequest(url) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname));
}

async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TradingPlatformDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('pendingActions')) {
        db.createObjectStore('pendingActions', { keyPath: 'id' });
      }
    };
  });
}

async function getPendingTradingActions(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingActions'], 'readonly');
    const store = transaction.objectStore('pendingActions');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function removePendingAction(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingActions'], 'readwrite');
    const store = transaction.objectStore('pendingActions');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function cacheStrategyData(strategies) {
  const cache = await caches.open(RUNTIME_CACHE);
  const response = new Response(JSON.stringify(strategies), {
    headers: { 'Content-Type': 'application/json' }
  });
  await cache.put('/api/strategies/cached', response);
}

console.log('🚀 Service Worker loaded successfully');
