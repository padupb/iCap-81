// Script de teste de rede para verificar conectividade
const http = require('http');
const os = require('os');

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                return interface.address;
            }
        }
    }
    return 'localhost';
}

const localIP = getLocalIP();
console.log('🔍 Testando conectividade de rede...');
console.log(`📍 IP Local: ${localIP}`);

// Teste 1: Servidor local na porta 8080
console.log('\n📡 Testando servidor PWA (porta 8080)...');
const req1 = http.request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/health',
    method: 'GET'
}, (res) => {
    console.log(`✅ Localhost:8080 - Status: ${res.statusCode}`);
    res.on('data', (data) => {
        console.log(`   Resposta: ${data.toString().substring(0, 100)}...`);
    });
});

req1.on('error', (err) => {
    console.log(`❌ Erro localhost:8080 - ${err.message}`);
});

req1.end();

// Teste 2: Servidor via IP na porta 8080
setTimeout(() => {
    console.log(`\n📡 Testando servidor PWA via IP (${localIP}:8080)...`);
    const req2 = http.request({
        hostname: localIP,
        port: 8080,
        path: '/api/health',
        method: 'GET'
    }, (res) => {
        console.log(`✅ ${localIP}:8080 - Status: ${res.statusCode}`);
        res.on('data', (data) => {
            console.log(`   Resposta: ${data.toString().substring(0, 100)}...`);
        });
    });

    req2.on('error', (err) => {
        console.log(`❌ Erro ${localIP}:8080 - ${err.message}`);
        console.log('💡 Possíveis causas:');
        console.log('   - Firewall bloqueando conexões');
        console.log('   - Servidor não está escutando em 0.0.0.0');
        console.log('   - Problema de rede');
    });

    req2.end();
}, 1000);

// Teste 3: Servidor principal na porta 3000
setTimeout(() => {
    console.log('\n📡 Testando servidor principal (porta 3000)...');
    const req3 = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/me',
        method: 'GET'
    }, (res) => {
        console.log(`✅ Localhost:3000 - Status: ${res.statusCode}`);
    });

    req3.on('error', (err) => {
        console.log(`❌ Erro localhost:3000 - ${err.message}`);
    });

    req3.end();
}, 2000);

// Teste 4: Servidor principal via IP na porta 3000
setTimeout(() => {
    console.log(`\n📡 Testando servidor principal via IP (${localIP}:3000)...`);
    const req4 = http.request({
        hostname: localIP,
        port: 3000,
        path: '/api/auth/me',
        method: 'GET'
    }, (res) => {
        console.log(`✅ ${localIP}:3000 - Status: ${res.statusCode}`);
    });

    req4.on('error', (err) => {
        console.log(`❌ Erro ${localIP}:3000 - ${err.message}`);
    });

    req4.end();
}, 3000);

setTimeout(() => {
    console.log('\n🏁 Teste concluído!');
    console.log('\n📱 URLs para testar no celular:');
    console.log(`   PWA: http://${localIP}:8080`);
    console.log(`   i-CAP: http://${localIP}:3000`);
    console.log('\n💡 Se houver erros de conexão via IP:');
    console.log('   1. Verifique se o celular está na mesma rede WiFi');
    console.log('   2. Desative temporariamente o firewall do Windows');
    console.log('   3. Verifique se o roteador permite comunicação entre dispositivos');
}, 4000); 