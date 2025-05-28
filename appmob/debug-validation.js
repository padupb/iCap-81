// Script de debug para testar a validação de pedidos
const http = require('http');

async function testValidation(orderId) {
    console.log(`🔍 Testando validação do pedido: ${orderId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const options = {
        hostname: 'localhost',
        port: 8080,
        path: `/api/orders/validate/${orderId}`,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
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
                    console.log(`📄 Resposta completa:`, JSON.stringify(response, null, 2));
                    
                    if (response.valid === true) {
                        console.log('✅ PEDIDO VÁLIDO!');
                        console.log(`   - ID: ${response.orderId}`);
                        console.log(`   - Status: ${response.status}`);
                        console.log(`   - Produto: ${response.details?.productName}`);
                        console.log(`   - Fornecedor: ${response.details?.supplierName}`);
                    } else {
                        console.log('❌ PEDIDO INVÁLIDO!');
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
        
        req.end();
    });
}

async function testMultipleOrders() {
    const testOrders = [
        'CAP2505260002',
        'CAP2505260001', 
        'CAP2505250003',
        'INVALID123',
        'CAP2405250612'
    ];
    
    console.log('🧪 TESTE DE VALIDAÇÃO DE PEDIDOS');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════\n');
    
    for (const orderId of testOrders) {
        try {
            await testValidation(orderId);
            console.log('\n');
        } catch (error) {
            console.error(`❌ Falha no teste do pedido ${orderId}:`, error.message);
            console.log('\n');
        }
    }
    
    console.log('🏁 Testes concluídos!');
}

// Executar testes
testMultipleOrders(); 