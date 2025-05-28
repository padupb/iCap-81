const http = require('http');

console.log('🧪 TESTE FINAL DO SISTEMA DE PERMISSÕES i-CAP 7.0');
console.log('================================================');

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
      timeout: 10000
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
        try {
          const jsonBody = JSON.parse(body);
          resolve({ 
            status: res.statusCode, 
            data: jsonBody, 
            headers: res.headers,
            cookie: res.headers['set-cookie'] ? res.headers['set-cookie'][0] : null
          });
        } catch (e) {
          resolve({ 
            status: res.statusCode, 
            data: body, 
            headers: res.headers,
            cookie: res.headers['set-cookie'] ? res.headers['set-cookie'][0] : null
          });
        }
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

async function testPermissions() {
  try {
    console.log('\n1️⃣ TESTANDO LOGIN DO KEYUSER...');
    
    // Teste 1: Login do KeyUser
    const loginResponse = await makeRequest('POST', '/api/auth/login', {
      email: 'padupb@admin.icap',
      password: '170824'
    });
    
    console.log(`Status: ${loginResponse.status}`);
    if (loginResponse.status === 200) {
      console.log('✅ Login do KeyUser realizado com sucesso');
      console.log('📋 Dados do usuário:', JSON.stringify(loginResponse.data.user, null, 2));
      
      const cookie = loginResponse.cookie;
      
      console.log('\n2️⃣ TESTANDO ACESSO ÀS ROTAS PROTEGIDAS...');
      
      // Teste 2: Verificar acesso às rotas
      const routes = [
        '/api/users',
        '/api/companies', 
        '/api/orders',
        '/api/products'
      ];
      
      for (const route of routes) {
        try {
          const response = await makeRequest('GET', route, null, cookie);
          console.log(`${route}: ${response.status === 200 ? '✅' : '❌'} Status ${response.status}`);
        } catch (error) {
          console.log(`${route}: ❌ Erro: ${error.message}`);
        }
      }
      
      console.log('\n3️⃣ TESTANDO CRIAÇÃO DE USUÁRIO DE TESTE...');
      
      // Teste 3: Criar usuário de teste
      const testUserResponse = await makeRequest('POST', '/api/create-test-user', null, cookie);
      console.log(`Status: ${testUserResponse.status}`);
      
      if (testUserResponse.status === 200) {
        console.log('✅ Usuário de teste criado com sucesso');
        console.log('📋 Dados:', JSON.stringify(testUserResponse.data, null, 2));
        
        console.log('\n4️⃣ TESTANDO LOGIN DO USUÁRIO DE TESTE...');
        
        // Teste 4: Login do usuário de teste
        const testLoginResponse = await makeRequest('POST', '/api/auth/login', {
          email: 'teste@exemplo.com',
          password: 'teste123'
        });
        
        console.log(`Status: ${testLoginResponse.status}`);
        if (testLoginResponse.status === 200) {
          console.log('✅ Login do usuário de teste realizado com sucesso');
          console.log('📋 Dados do usuário:', JSON.stringify(testLoginResponse.data.user, null, 2));
          
          const testCookie = testLoginResponse.cookie;
          
          console.log('\n5️⃣ TESTANDO PERMISSÕES DO USUÁRIO DE TESTE...');
          
          // Teste 5: Verificar permissões limitadas
          for (const route of routes) {
            try {
              const response = await makeRequest('GET', route, null, testCookie);
              const hasAccess = response.status === 200;
              console.log(`${route}: ${hasAccess ? '✅ PERMITIDO' : '❌ NEGADO'} Status ${response.status}`);
            } catch (error) {
              console.log(`${route}: ❌ Erro: ${error.message}`);
            }
          }
        } else {
          console.log('❌ Falha no login do usuário de teste');
          console.log('📋 Resposta:', JSON.stringify(testLoginResponse.data, null, 2));
        }
      } else {
        console.log('❌ Falha na criação do usuário de teste');
        console.log('📋 Resposta:', JSON.stringify(testUserResponse.data, null, 2));
      }
      
    } else {
      console.log('❌ Falha no login do KeyUser');
      console.log('📋 Resposta:', JSON.stringify(loginResponse.data, null, 2));
    }
    
    console.log('\n🏁 TESTE CONCLUÍDO');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

// Executar o teste
testPermissions(); 