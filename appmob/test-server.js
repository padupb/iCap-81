// Servidor de teste simples para a PWA i-CAP Tracker
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8080;

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
};

// Mock API responses
const mockAPI = {
    '/api/health': () => ({ status: 'ok', timestamp: new Date().toISOString() }),
    '/api/orders/validate/': (orderId) => ({ valid: true, orderId, status: 'Pendente' }),
    '/api/orders/': (orderId, method, body) => {
        if (method === 'PUT') {
            console.log(`Status atualizado para pedido ${orderId}:`, body);
            return { success: true, orderId, newStatus: body.status };
        }
        return { orderId, status: 'Pendente' };
    },
    '/api/tracking/location': (method, body) => {
        if (method === 'POST') {
            console.log('Localização recebida:', body);
            return { success: true, timestamp: new Date().toISOString() };
        }
        return { error: 'Method not allowed' };
    }
};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Handle API routes
    if (pathname.startsWith('/api/')) {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            let parsedBody = {};
            try {
                if (body) parsedBody = JSON.parse(body);
            } catch (e) {
                console.log('Erro ao parsear body:', e);
            }
            
            let response = { error: 'Not found' };
            
            // Health check
            if (pathname === '/api/health') {
                response = mockAPI['/api/health']();
            }
            // Validate order
            else if (pathname.startsWith('/api/orders/validate/')) {
                const orderId = pathname.split('/').pop();
                response = mockAPI['/api/orders/validate/'](orderId);
            }
            // Update order status
            else if (pathname.match(/^\/api\/orders\/[^\/]+\/status$/)) {
                const orderId = pathname.split('/')[3];
                response = mockAPI['/api/orders/'](orderId, req.method, parsedBody);
            }
            // Location tracking
            else if (pathname === '/api/tracking/location') {
                response = mockAPI['/api/tracking/location'](req.method, parsedBody);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
        });
        
        return;
    }
    
    // Serve static files
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);
    
    // Security check
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // Try to serve index.html for SPA routing
                fs.readFile(path.join(__dirname, 'index.html'), (err2, data2) => {
                    if (err2) {
                        res.writeHead(404);
                        res.end('File not found');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(data2);
                    }
                });
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            const ext = path.extname(filePath);
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Servidor de teste da PWA i-CAP Tracker rodando em:`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`\n📱 Para testar no celular:`);
    console.log(`   1. Conecte o celular na mesma rede WiFi`);
    console.log(`   2. Acesse http://[SEU_IP]:${PORT}`);
    console.log(`   3. O navegador oferecerá opção de instalar o app`);
    console.log(`\n🔧 APIs mock disponíveis:`);
    console.log(`   GET  /api/health`);
    console.log(`   GET  /api/orders/validate/:orderId`);
    console.log(`   PUT  /api/orders/:orderId/status`);
    console.log(`   POST /api/tracking/location`);
    console.log(`\n⏹️  Para parar: Ctrl+C`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Encerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor encerrado');
        process.exit(0);
    });
}); 