// Teste específico para atualização de status
const http = require('http');

async function testStatusUpdate(orderId, newStatus) {
    console.log(`🔄 Testando atualização de status...`);
    console.log(`   Pedido: ${orderId}`);
    console.log(`   Novo Status: ${newStatus}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const postData = JSON.stringify({ status: newStatus });
    
    const options = {
        hostname: '192.168.0.40',
        port: 8080,
        path: `/api/orders/${orderId}/status`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            
            console.log(`📊 Status HTTP: ${res.statusCode}`);
            console.log(`📋 Headers:`, res.headers);
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log(`📄 Resposta:`, JSON.stringify(response, null, 2));
                    
                    if (response.success === true) {
                        console.log('✅ STATUS ATUALIZADO COM SUCESSO!');
                        console.log(`   - Pedido: ${response.orderId}`);
                        console.log(`   - Novo Status: ${response.newStatus}`);
                        console.log(`   - Timestamp: ${response.timestamp}`);
                    } else {
                        console.log('❌ FALHA NA ATUALIZAÇÃO!');
                        console.log(`   - Motivo: ${response.message}`);
                    }
                    
                    resolve(response);
                } catch (error) {
                    console.error('❌ Erro ao parsear resposta:', error);
                    console.log('📄 Resposta bruta:', data);
                    reject(error);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('❌ Erro na requisição:', error);
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}

async function testCompleteFlow() {
    const orderId = 'CAP2505250003';
    
    console.log('🧪 TESTE COMPLETO DE ATUALIZAÇÃO DE STATUS');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════\n');
    
    try {
        // 1. Verificar status atual
        console.log('1️⃣ Verificando status atual...');
        const validateResponse = await fetch(`http://192.168.0.40:8080/api/orders/validate/${orderId}`);
        const currentData = await validateResponse.json();
        console.log(`   Status atual: ${currentData.status}`);
        console.log('');
        
        // 2. Tentar atualizar para "Em Transporte"
        console.log('2️⃣ Atualizando para "Em Transporte"...');
        await testStatusUpdate(orderId, 'Em Transporte');
        console.log('');
        
        // 3. Verificar se foi atualizado
        console.log('3️⃣ Verificando se foi atualizado...');
        const validateResponse2 = await fetch(`http://192.168.0.40:8080/api/orders/validate/${orderId}`);
        const updatedData = await validateResponse2.json();
        console.log(`   Status após atualização: ${updatedData.status}`);
        
        if (updatedData.status === 'Em Transporte') {
            console.log('✅ SUCESSO! Status foi atualizado corretamente!');
        } else {
            console.log('❌ FALHA! Status não foi atualizado!');
        }
        
    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
    }
    
    console.log('\n🏁 Teste concluído!');
}

// Executar teste
testCompleteFlow(); 