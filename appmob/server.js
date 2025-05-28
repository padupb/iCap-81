// Servidor melhorado para PWA i-CAP Tracker
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0'; // Permite acesso de qualquer IP

console.log('🚀 Iniciando servidor i-CAP Tracker PWA...');
console.log(`📁 Diretório: ${__dirname}`);
console.log(`🌐 Porta: ${PORT}`);

// MIME types
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8'
};

// Mock API responses
const mockAPI = {
    '/api/health': () => {
        console.log('📊 Health check solicitado');
        return { 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            server: 'i-CAP Tracker PWA',
            version: '1.0.0'
        };
    },
    
    '/api/orders/validate/': (orderId) => {
        console.log(`✅ Validando pedido: ${orderId}`);
        
        // Lista de pedidos válidos para teste
        const validOrders = [
            '12345', '67890', '11111', '22222', '33333',
            'PED001', 'PED002', 'PED003', 'ABC123', 'XYZ789'
        ];
        
        const isValid = validOrders.includes(orderId);
        
        if (isValid) {
            return { 
                valid: true, 
                orderId, 
                status: 'Pendente',
                message: 'Pedido encontrado e válido',
                customer: 'Cliente Teste',
                address: 'Endereço de Entrega Teste'
            };
        } else {
            return { 
                valid: false, 
                orderId, 
                message: 'Pedido não encontrado ou inválido'
            };
        }
    },
    
    '/api/orders/': (orderId, method, body) => {
        if (method === 'PUT') {
            console.log(`🔄 Status atualizado para pedido ${orderId}:`, body);
            return { 
                success: true, 
                orderId, 
                newStatus: body.status,
                timestamp: new Date().toISOString()
            };
        }
        return { orderId, status: 'Pendente' };
    },
    
    '/api/tracking/location': (method, body) => {
        if (method === 'POST') {
            console.log('📍 Localização recebida:', {
                orderId: body.orderId,
                lat: body.latitude?.toFixed(6),
                lng: body.longitude?.toFixed(6),
                accuracy: body.accuracy ? `±${Math.round(body.accuracy)}m` : 'N/A',
                timestamp: body.timestamp
            });
            return { 
                success: true, 
                timestamp: new Date().toISOString(),
                message: 'Localização salva com sucesso'
            };
        }
        return { error: 'Method not allowed' };
    }
};

// Função para obter IP local
function getLocalIP() {
    const interfaces = require('os').networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                return interface.address;
            }
        }
    }
    return 'localhost';
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    
    console.log(`${new Date().toLocaleTimeString()} ${method} ${pathname}`);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (method === 'OPTIONS') {
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
                console.log('❌ Erro ao parsear body:', e.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
                return;
            }
            
            let response = { error: 'Not found' };
            
            try {
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
                    response = mockAPI['/api/orders/'](orderId, method, parsedBody);
                }
                // Location tracking
                else if (pathname === '/api/tracking/location') {
                    response = mockAPI['/api/tracking/location'](method, parsedBody);
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response, null, 2));
                
            } catch (error) {
                console.error('❌ Erro na API:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        });
        
        return;
    }
    
    // Serve static files
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);
    
    // Security check
    if (!filePath.startsWith(__dirname)) {
        console.log('🚫 Acesso negado:', filePath);
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.log('📄 Arquivo não encontrado, servindo index.html:', filePath);
                // Try to serve index.html for SPA routing
                fs.readFile(path.join(__dirname, 'index.html'), (err2, data2) => {
                    if (err2) {
                        console.log('❌ index.html não encontrado');
                        res.writeHead(404);
                        res.end('File not found');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(data2);
                    }
                });
            } else {
                console.error('❌ Erro no servidor:', err);
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            const ext = path.extname(filePath);
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
            console.log(`✅ Arquivo servido: ${path.basename(filePath)} (${data.length} bytes)`);
        }
    });
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Porta ${PORT} já está em uso!`);
        console.log('💡 Tente uma porta diferente ou pare o processo que está usando a porta 8080');
        console.log('💡 Para ver processos na porta 8080: netstat -ano | findstr :8080');
    } else {
        console.error('❌ Erro no servidor:', err);
    }
    process.exit(1);
});

server.listen(PORT, HOST, () => {
    const localIP = getLocalIP();
    
    console.log('\n🎉 Servidor iniciado com sucesso!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 URLs de acesso:');
    console.log(`   Local:    http://localhost:${PORT}`);
    console.log(`   Rede:     http://${localIP}:${PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 Para testar no celular:');
    console.log(`   1. Conecte o celular na mesma rede WiFi`);
    console.log(`   2. Acesse: http://${localIP}:${PORT}`);
    console.log(`   3. O navegador oferecerá opção de instalar o app`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 APIs disponíveis:');
    console.log(`   GET  http://localhost:${PORT}/api/health`);
    console.log(`   GET  http://localhost:${PORT}/api/orders/validate/:orderId`);
    console.log(`   PUT  http://localhost:${PORT}/api/orders/:orderId/status`);
    console.log(`   POST http://localhost:${PORT}/api/tracking/location`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏹️  Para parar: Ctrl+C');
    console.log('📊 Logs aparecerão abaixo...\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Encerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor encerrado com sucesso');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ Erro não capturado:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rejeitada:', reason);
    process.exit(1);
}); 