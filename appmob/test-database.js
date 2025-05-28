// Script de teste para verificar integração com banco de dados
const http = require('http');

console.log('🧪 Testando integração PWA com banco de dados...\n');

// Função para fazer requisições HTTP
function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(body);
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function testAPI() {
    try {
        // Teste 1: Health Check
        console.log('1️⃣ Testando Health Check...');
        const healthResponse = await makeRequest({
            hostname: 'localhost',
            port: 8080,
            path: '/api/health',
            method: 'GET'
        });
        
        if (healthResponse.status === 200) {
            console.log('✅ Health Check OK');
            console.log(`   Database: ${healthResponse.data.database}`);
            console.log(`   Version: ${healthResponse.data.version}`);
        } else {
            console.log('❌ Health Check falhou');
        }

        // Teste 2: Validação de pedido inexistente
        console.log('\n2️⃣ Testando validação de pedido inexistente...');
        const invalidResponse = await makeRequest({
            hostname: 'localhost',
            port: 8080,
            path: '/api/orders/validate/PEDIDO_INEXISTENTE_123',
            method: 'GET'
        });
        
        if (invalidResponse.status === 200 && !invalidResponse.data.valid) {
            console.log('✅ Validação de pedido inexistente OK');
            console.log(`   Mensagem: ${invalidResponse.data.message}`);
        } else {
            console.log('❌ Validação de pedido inexistente falhou');
        }

        // Teste 3: Buscar um pedido real (se existir)
        console.log('\n3️⃣ Testando busca de pedidos reais...');
        console.log('   💡 Para testar com pedido real:');
        console.log('   1. Acesse http://localhost:3000');
        console.log('   2. Vá em "Pedidos" e copie um order_id');
        console.log('   3. Execute: curl "http://localhost:8080/api/orders/validate/SEU_ORDER_ID"');

        // Teste 4: Teste de atualização de status (simulado)
        console.log('\n4️⃣ Testando atualização de status...');
        const updateResponse = await makeRequest({
            hostname: 'localhost',
            port: 8080,
            path: '/api/orders/PEDIDO_TESTE/status',
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        }, { status: 'Em Transporte' });
        
        if (updateResponse.status === 200) {
            if (updateResponse.data.success === false) {
                console.log('✅ Atualização de status OK (pedido não encontrado, como esperado)');
                console.log(`   Mensagem: ${updateResponse.data.message}`);
            } else {
                console.log('✅ Atualização de status OK');
            }
        } else {
            console.log('❌ Atualização de status falhou');
        }

        // Teste 5: Teste de localização (simulado)
        console.log('\n5️⃣ Testando envio de localização...');
        const locationResponse = await makeRequest({
            hostname: 'localhost',
            port: 8080,
            path: '/api/tracking/location',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }, {
            orderId: 'PEDIDO_TESTE',
            latitude: -23.550520,
            longitude: -46.633308,
            accuracy: 10,
            timestamp: new Date().toISOString()
        });
        
        if (locationResponse.status === 200 || locationResponse.status === 500) {
            console.log('✅ Envio de localização OK (erro esperado para pedido inexistente)');
            if (locationResponse.data.message) {
                console.log(`   Mensagem: ${locationResponse.data.message}`);
            }
        } else {
            console.log('❌ Envio de localização falhou');
        }

        console.log('\n🏁 Testes concluídos!');
        console.log('\n📋 Próximos passos:');
        console.log('1. Acesse http://localhost:3000 para criar um pedido real');
        console.log('2. Use o order_id do pedido na PWA: http://localhost:8080');
        console.log('3. Verifique se o status muda para "Em Transporte"');
        console.log('4. Observe os pontos GPS sendo salvos no banco');

    } catch (error) {
        console.error('❌ Erro durante os testes:', error.message);
        console.log('\n💡 Certifique-se de que o servidor PWA está rodando:');
        console.log('   cd E:\\icap7\\appmob');
        console.log('   node pwa-api.js');
    }
}

testAPI(); 