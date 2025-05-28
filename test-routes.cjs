const http = require('http');

console.log('🧪 TESTE DAS ROTAS CORRIGIDAS i-CAP 7.0');
console.log('=========================================');

// Função para fazer requisições HTTP
function makeRequest(method, path, data = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000
    };

    if (cookie) {
      options.headers['Cookie'] = cookie;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({ 
          status: res.statusCode, 
          headers: res.headers,
          cookie: res.headers['set-cookie'] ? res.headers['set-cookie'][0] : null
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testRoutes() {
  try {
    console.log('\n1️⃣ FAZENDO LOGIN...');
    
    // Login do KeyUser
    const loginResponse = await makeRequest('POST', '/api/auth/login', {
      email: 'padupb@admin.icap',
      password: '170824'
    });
    
    if (loginResponse.status !== 200) {
      console.log('❌ Falha no login');
      return;
    }
    
    console.log('✅ Login realizado com sucesso');
    const cookie = loginResponse.cookie;
    
    console.log('\n2️⃣ TESTANDO ROTAS DAS PÁGINAS...');
    
    // Testar as rotas das páginas (frontend)
    const frontendRoutes = [
      '/',
      '/pedidos',
      '/aprovacoes', 
      '/ordens-compra',
      '/empresas',
      '/usuarios',
      '/produtos',
      '/logs',
      '/configuracoes',
      '/dev'
    ];
    
    for (const route of frontendRoutes) {
      try {
        const response = await makeRequest('GET', route, null, cookie);
        const status = response.status === 200 ? '✅' : (response.status === 404 ? '❌ 404' : `⚠️ ${response.status}`);
        console.log(`${route}: ${status}`);
      } catch (error) {
        console.log(`${route}: ❌ Erro: ${error.message}`);
      }
    }
    
    console.log('\n3️⃣ TESTANDO ROTAS DA API...');
    
    // Testar as rotas da API
    const apiRoutes = [
      '/api/users',
      '/api/companies',
      '/api/orders',
      '/api/products',
      '/api/ordens-compra',
      '/api/logs'
    ];
    
    for (const route of apiRoutes) {
      try {
        const response = await makeRequest('GET', route, null, cookie);
        const status = response.status === 200 ? '✅' : (response.status === 403 ? '🔒 Sem permissão' : `❌ ${response.status}`);
        console.log(`${route}: ${status}`);
      } catch (error) {
        console.log(`${route}: ❌ Erro: ${error.message}`);
      }
    }
    
    console.log('\n🏁 TESTE CONCLUÍDO');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

// Executar o teste
testRoutes(); 