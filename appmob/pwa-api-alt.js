// API da PWA integrada com banco de dados i-CAP - PORTA ALTERNATIVA
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { Pool } = require('pg');

const PORT = 3001; // PORTA ALTERNATIVA
const HOST = '0.0.0.0';

// Configuração do banco de dados
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_sVLwi40aXDWd@ep-sparkling-surf-a6zclzez.us-west-2.aws.neon.tech:5432/neondb';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

console.log('🚀 Iniciando servidor PWA ALTERNATIVO...');
console.log(`📁 Diretório: ${__dirname}`);
console.log(`🌐 Porta: ${PORT} (ALTERNATIVA)`);

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

// Funções de banco de dados (mesmas da versão original)
async function validateOrderInDB(orderId) {
    try {
        const query = `
            SELECT 
                o.id,
                o.order_id,
                o.status,
                o.work_location,
                o.delivery_date,
                o.quantity,
                p.name as product_name,
                c.name as supplier_name,
                u.name as user_name
            FROM orders o
            LEFT JOIN products p ON o.product_id = p.id
            LEFT JOIN companies c ON o.supplier_id = c.id
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.order_id = $1
        `;
        
        const result = await pool.query(query, [orderId]);
        
        if (result.rows.length > 0) {
            const order = result.rows[0];
            return {
                valid: true,
                orderId: order.order_id,
                status: order.status,
                message: 'Pedido encontrado e válido',
                details: {
                    id: order.id,
                    workLocation: order.work_location,
                    deliveryDate: order.delivery_date,
                    quantity: order.quantity,
                    productName: order.product_name,
                    supplierName: order.supplier_name,
                    userName: order.user_name
                }
            };
        } else {
            return {
                valid: false,
                orderId,
                message: 'Pedido não encontrado no sistema'
            };
        }
    } catch (error) {
        console.error('Erro ao validar pedido no banco:', error);
        return {
            valid: false,
            orderId,
            message: 'Erro interno do servidor'
        };
    }
}

// APIs da PWA
const pwaAPI = {
    '/api/health': async () => {
        console.log('📊 Health check solicitado');
        
        try {
            await pool.query('SELECT 1');
            return { 
                status: 'ok', 
                timestamp: new Date().toISOString(),
                server: 'i-CAP Tracker PWA ALTERNATIVO',
                version: '2.1.0',
                port: PORT,
                database: 'connected'
            };
        } catch (error) {
            return { 
                status: 'error', 
                timestamp: new Date().toISOString(),
                server: 'i-CAP Tracker PWA ALTERNATIVO',
                version: '2.1.0',
                port: PORT,
                database: 'disconnected',
                error: error.message
            };
        }
    },
    
    '/api/orders/validate/': async (orderId) => {
        console.log(`✅ Validando pedido no banco: ${orderId}`);
        return await validateOrderInDB(orderId);
    }
};

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

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    
    console.log(`${new Date().toLocaleTimeString()} ${method} ${pathname}`);
    
    // CORS headers mais permissivos
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Handle API routes
    if (pathname.startsWith('/api/')) {
        let response = { error: 'Not found' };
        
        try {
            if (pathname === '/api/health') {
                response = await pwaAPI['/api/health']();
            }
            else if (pathname.startsWith('/api/orders/validate/')) {
                const orderId = pathname.split('/').pop();
                response = await pwaAPI['/api/orders/validate/'](orderId);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response, null, 2));
            
        } catch (error) {
            console.error('❌ Erro na API:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            }));
        }
        
        return;
    }
    
    // Serve static files
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);
    
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.readFile(path.join(__dirname, 'index.html'), (err2, data2) => {
                    if (err2) {
                        res.writeHead(404);
                        res.end('File not found');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
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

server.listen(PORT, HOST, () => {
    const localIP = getLocalIP();
    
    console.log('\n🎉 Servidor PWA ALTERNATIVO iniciado!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 URLs ALTERNATIVAS:');
    console.log(`   Local:    http://localhost:${PORT}`);
    console.log(`   Rede:     http://${localIP}:${PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 APIs disponíveis:');
    console.log(`   GET  http://localhost:${PORT}/api/health`);
    console.log(`   GET  http://localhost:${PORT}/api/orders/validate/:orderId`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏹️  Para parar: Ctrl+C\n');
});

process.on('SIGINT', () => {
    console.log('\n👋 Encerrando servidor alternativo...');
    pool.end(() => {
        server.close(() => {
            console.log('✅ Servidor alternativo encerrado');
            process.exit(0);
        });
    });
}); 