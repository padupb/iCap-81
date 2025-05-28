// Teste específico para salvamento de localização GPS
const http = require('http');

async function testLocationSave() {
    console.log('🧪 TESTE DE SALVAMENTO DE LOCALIZAÇÃO GPS');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════\n');
    
    // Dados de localização simulados
    const locationData = {
        orderId: 'CAP2505250003',
        latitude: -25.4284,
        longitude: -49.2733,
        accuracy: 10,
        speed: 0,
        timestamp: new Date().toISOString()
    };
    
    console.log('📍 Dados de localização a serem enviados:');
    console.log(JSON.stringify(locationData, null, 2));
    console.log('');
    
    const postData = JSON.stringify(locationData);
    
    const options = {
        hostname: '192.168.0.40',
        port: 8080,
        path: '/api/tracking/location',
        method: 'POST',
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
                        console.log('✅ LOCALIZAÇÃO SALVA COM SUCESSO!');
                        console.log(`   - Timestamp: ${response.timestamp}`);
                        console.log(`   - Mensagem: ${response.message}`);
                    } else {
                        console.log('❌ FALHA AO SALVAR LOCALIZAÇÃO!');
                        console.log(`   - Motivo: ${response.message || 'Erro desconhecido'}`);
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

// Executar teste
testLocationSave()
    .then(() => {
        console.log('\n🏁 Teste de localização concluído!');
    })
    .catch((error) => {
        console.error('\n❌ Erro no teste:', error.message);
    }); 