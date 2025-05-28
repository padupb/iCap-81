// Teste com pedido real
const http = require('http');

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

async function testRealOrder() {
    const orderId = 'CAP2505260002'; // Pedido real do banco
    
    try {
        console.log(`🧪 Testando pedido real: ${orderId}\n`);
        
        // Teste 1: Validação
        console.log('1️⃣ Testando validação...');
        const validateResponse = await makeRequest({
            hostname: 'localhost',
            port: 8080,
            path: `/api/orders/validate/${orderId}`,
            method: 'GET'
        });
        
        console.log(`Status HTTP: ${validateResponse.status}`);
        console.log('Resposta:', JSON.stringify(validateResponse.data, null, 2));
        
        if (validateResponse.data.valid) {
            console.log('✅ Pedido válido! Testando atualização de status...\n');
            
            // Teste 2: Atualização de status
            console.log('2️⃣ Testando atualização de status para "Em Transporte"...');
            const updateResponse = await makeRequest({
                hostname: 'localhost',
                port: 8080,
                path: `/api/orders/${orderId}/status`,
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            }, { status: 'Em Transporte' });
            
            console.log(`Status HTTP: ${updateResponse.status}`);
            console.log('Resposta:', JSON.stringify(updateResponse.data, null, 2));
            
            if (updateResponse.data.success) {
                console.log('\n✅ Status atualizado com sucesso!');
                console.log('\n🎯 AGORA TESTE NA PWA:');
                console.log(`1. Acesse: http://localhost:8080`);
                console.log(`2. Digite: ${orderId}`);
                console.log(`3. Deve funcionar perfeitamente!`);
            } else {
                console.log('\n❌ Erro ao atualizar status:', updateResponse.data.message);
            }
            
        } else {
            console.log('❌ Pedido inválido:', validateResponse.data.message);
        }
        
    } catch (error) {
        console.error('❌ Erro durante teste:', error.message);
        console.log('\n💡 Verifique se o servidor PWA está rodando:');
        console.log('   node pwa-api.js');
    }
}

testRealOrder(); 