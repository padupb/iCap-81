// API da PWA integrada com banco de dados i-CAP
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { Pool } = require('pg');

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// Configuração do banco de dados
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_sVLwi40aXDWd@ep-sparkling-surf-a6zclzez.us-west-2.aws.neon.tech:5432/neondb';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

console.log('🚀 Iniciando servidor PWA i-CAP Tracker com banco de dados...');
console.log(`📁 Diretório: ${__dirname}`);
console.log(`🌐 Porta: ${PORT}`);
console.log(`🗄️ Banco: ${DATABASE_URL.split('@')[1]?.split('/')[0] || 'Configurado'}`);

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

// Funções de banco de dados
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

async function updateOrderStatusInDB(orderId, newStatus) {
    try {
        // Primeiro, verificar se o pedido existe
        const checkQuery = 'SELECT id FROM orders WHERE order_id = $1';
        const checkResult = await pool.query(checkQuery, [orderId]);
        
        if (checkResult.rows.length === 0) {
            return {
                success: false,
                message: 'Pedido não encontrado'
            };
        }
        
        const orderDbId = checkResult.rows[0].id;
        
        // Atualizar o status do pedido
        const updateQuery = 'UPDATE orders SET status = $1 WHERE order_id = $2';
        await pool.query(updateQuery, [newStatus, orderId]);
        
        // Registrar ponto de rastreamento (comentado temporariamente para debug)
        try {
            const trackingQuery = `
                INSERT INTO tracking_points (order_id, status, comment, user_id, created_at)
                VALUES ($1, $2, $3, $4, NOW())
            `;
            
            await pool.query(trackingQuery, [
                orderDbId,
                newStatus,
                `Status alterado via PWA para: ${newStatus}`,
                4 // ID do usuário PWA (funcionou no teste)
            ]);
            console.log(`📝 Ponto de rastreamento registrado para pedido ${orderId}`);
        } catch (trackingError) {
            console.error('⚠️ Erro ao registrar tracking point (continuando):', trackingError.message);
            // Não falhar a atualização por causa do tracking point
        }
        
        console.log(`✅ Status do pedido ${orderId} atualizado para: ${newStatus}`);
        
        return {
            success: true,
            orderId,
            newStatus,
            timestamp: new Date().toISOString(),
            message: 'Status atualizado com sucesso'
        };
        
    } catch (error) {
        console.error('Erro ao atualizar status no banco:', error);
        return {
            success: false,
            message: 'Erro interno do servidor'
        };
    }
}

async function saveLocationToDB(locationData) {
    try {
        // Buscar o ID do pedido no banco
        const orderQuery = 'SELECT id FROM orders WHERE order_id = $1';
        const orderResult = await pool.query(orderQuery, [locationData.orderId]);
        
        if (orderResult.rows.length === 0) {
            return {
                success: false,
                message: 'Pedido não encontrado'
            };
        }
        
        const orderDbId = orderResult.rows[0].id;
        
        // Tentar salvar ponto de rastreamento com localização
        try {
            const trackingQuery = `
                INSERT INTO tracking_points (
                    order_id, 
                    status, 
                    comment, 
                    user_id, 
                    latitude, 
                    longitude, 
                    created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `;
            
            const comment = `GPS: Lat ${locationData.latitude.toFixed(6)}, Lng ${locationData.longitude.toFixed(6)}, Precisão: ±${Math.round(locationData.accuracy)}m`;
            
            await pool.query(trackingQuery, [
                orderDbId,
                'Em Transporte',
                comment,
                4, // ID do usuário PWA (funcionou no teste)
                locationData.latitude,
                locationData.longitude,
                locationData.timestamp
            ]);
            
            console.log(`📍 Localização salva para pedido ${locationData.orderId}:`, {
                lat: locationData.latitude.toFixed(6),
                lng: locationData.longitude.toFixed(6),
                accuracy: `±${Math.round(locationData.accuracy)}m`
            });
            
            return {
                success: true,
                timestamp: new Date().toISOString(),
                message: 'Localização salva com sucesso'
            };
            
        } catch (trackingError) {
            console.error('⚠️ Erro ao salvar tracking point:', trackingError.message);
            
            // Retornar sucesso mesmo com erro no tracking (para não quebrar o fluxo)
            return {
                success: true,
                timestamp: new Date().toISOString(),
                message: 'Localização processada (erro no tracking point)',
                warning: trackingError.message
            };
        }
        
    } catch (error) {
        console.error('Erro ao salvar localização no banco:', error);
        return {
            success: false,
            message: 'Erro interno do servidor'
        };
    }
}

// APIs da PWA
const pwaAPI = {
    '/api/health': async () => {
        console.log('📊 Health check solicitado');
        
        // Testar conexão com banco
        try {
            await pool.query('SELECT 1');
            return { 
                status: 'ok', 
                timestamp: new Date().toISOString(),
                server: 'i-CAP Tracker PWA',
                version: '2.0.0',
                database: 'connected'
            };
        } catch (error) {
            return { 
                status: 'error', 
                timestamp: new Date().toISOString(),
                server: 'i-CAP Tracker PWA',
                version: '2.0.0',
                database: 'disconnected',
                error: error.message
            };
        }
    },
    
    '/api/orders/validate/': async (orderId) => {
        console.log(`✅ Validando pedido no banco: ${orderId}`);
        return await validateOrderInDB(orderId);
    },
    
    '/api/orders/': async (orderId, method, body) => {
        if (method === 'PUT') {
            console.log(`🔄 Atualizando status do pedido ${orderId}:`, body);
            return await updateOrderStatusInDB(orderId, body.status);
        }
        return { error: 'Method not allowed' };
    },
    
    '/api/tracking/location': async (method, body) => {
        if (method === 'POST') {
            return await saveLocationToDB(body);
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

const server = http.createServer(async (req, res) => {
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
        
        req.on('end', async () => {
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
                    response = await pwaAPI['/api/health']();
                }
                // Validate order
                else if (pathname.startsWith('/api/orders/validate/')) {
                    const orderId = pathname.split('/').pop();
                    response = await pwaAPI['/api/orders/validate/'](orderId);
                }
                // Update order status
                else if (pathname.match(/^\/api\/orders\/[^\/]+\/status$/)) {
                    const orderId = pathname.split('/')[3];
                    response = await pwaAPI['/api/orders/'](orderId, method, parsedBody);
                }
                // Location tracking
                else if (pathname === '/api/tracking/location') {
                    response = await pwaAPI['/api/tracking/location'](method, parsedBody);
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

// Testar conexão com banco na inicialização
pool.query('SELECT 1')
    .then(() => {
        console.log('✅ Conexão com banco de dados estabelecida');
    })
    .catch((error) => {
        console.error('❌ Erro ao conectar com banco de dados:', error.message);
    });

server.listen(PORT, HOST, () => {
    const localIP = getLocalIP();
    
    console.log('\n🎉 Servidor PWA iniciado com sucesso!');
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
    console.log('🔧 APIs disponíveis (conectadas ao banco):');
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
    pool.end(() => {
        console.log('🗄️ Conexão com banco encerrada');
        server.close(() => {
            console.log('✅ Servidor encerrado com sucesso');
            process.exit(0);
        });
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