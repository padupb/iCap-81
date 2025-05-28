// Service Worker para i-CAP Tracker PWA
const CACHE_NAME = 'icap-tracker-v1.0.0';
const STATIC_CACHE_NAME = 'icap-tracker-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'icap-tracker-dynamic-v1.0.0';

// Arquivos para cache estático (sempre em cache)
const STATIC_FILES = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

// Arquivos para cache dinâmico (cache conforme uso)
const DYNAMIC_FILES = [
    '/api/health',
    '/api/orders/validate/',
    '/api/orders/',
    '/api/tracking/location'
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
    console.log('Service Worker: Instalando...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Cache estático criado');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('Service Worker: Arquivos estáticos em cache');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Erro ao criar cache estático:', error);
            })
    );
});

// Ativar Service Worker
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Ativando...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Remover caches antigos
                        if (cacheName !== STATIC_CACHE_NAME && 
                            cacheName !== DYNAMIC_CACHE_NAME &&
                            cacheName.startsWith('icap-tracker-')) {
                            console.log('Service Worker: Removendo cache antigo:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Ativado');
                return self.clients.claim();
            })
    );
});

// Interceptar requisições
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Estratégia Cache First para arquivos estáticos
    if (STATIC_FILES.some(file => request.url.includes(file))) {
        event.respondWith(cacheFirst(request));
        return;
    }
    
    // Estratégia Network First para APIs
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // Estratégia Stale While Revalidate para outros recursos
    event.respondWith(staleWhileRevalidate(request));
});

// Estratégia Cache First
async function cacheFirst(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Cache First falhou:', error);
        
        // Retornar página offline se disponível
        if (request.destination === 'document') {
            return caches.match('/index.html');
        }
        
        throw error;
    }
}

// Estratégia Network First
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Network First: Tentando cache para:', request.url);
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Para APIs, retornar resposta offline
        if (request.url.includes('/api/')) {
            return new Response(
                JSON.stringify({ 
                    error: 'Offline', 
                    message: 'Sem conexão com o servidor' 
                }),
                {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
        
        throw error;
    }
}

// Estratégia Stale While Revalidate
async function staleWhileRevalidate(request) {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(() => {
        // Se falhar, retornar cache se disponível
        return cachedResponse;
    });
    
    return cachedResponse || fetchPromise;
}

// Sincronização em background
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Evento de sincronização:', event.tag);
    
    if (event.tag === 'sync-locations') {
        event.waitUntil(syncPendingLocations());
    }
});

// Sincronizar localizações pendentes
async function syncPendingLocations() {
    try {
        // Obter dados pendentes do IndexedDB ou localStorage
        const pendingData = await getPendingLocationData();
        
        if (pendingData && pendingData.length > 0) {
            console.log('Service Worker: Sincronizando', pendingData.length, 'localizações');
            
            for (const locationData of pendingData) {
                try {
                    const response = await fetch('/api/tracking/location', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(locationData)
                    });
                    
                    if (response.ok) {
                        await removePendingLocationData(locationData.id);
                        console.log('Service Worker: Localização sincronizada:', locationData.id);
                    }
                } catch (error) {
                    console.error('Service Worker: Erro ao sincronizar localização:', error);
                }
            }
        }
    } catch (error) {
        console.error('Service Worker: Erro na sincronização:', error);
    }
}

// Obter dados pendentes (simulação - implementar com IndexedDB)
async function getPendingLocationData() {
    // Esta função seria implementada para acessar dados do IndexedDB
    // Por enquanto, retorna array vazio
    return [];
}

// Remover dados pendentes (simulação - implementar com IndexedDB)
async function removePendingLocationData(id) {
    // Esta função seria implementada para remover dados do IndexedDB
    console.log('Removendo dados pendentes:', id);
}

// Notificações push (para futuras implementações)
self.addEventListener('push', (event) => {
    console.log('Service Worker: Notificação push recebida');
    
    const options = {
        body: event.data ? event.data.text() : 'Nova notificação do i-CAP Tracker',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Abrir App',
                icon: '/icons/icon-96x96.png'
            },
            {
                action: 'close',
                title: 'Fechar',
                icon: '/icons/icon-96x96.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('i-CAP Tracker', options)
    );
});

// Clique em notificação
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Clique em notificação:', event.action);
    
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Mensagens do cliente
self.addEventListener('message', (event) => {
    console.log('Service Worker: Mensagem recebida:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

// Logs de debug
console.log('Service Worker: Carregado - Versão:', CACHE_NAME); 