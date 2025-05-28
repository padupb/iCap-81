const http = require('http');

// Função para fazer requisições HTTP
function makeRequest(method, path, data = null, cookie = null) {
  return new Promise((resolve, reject) => {
    console.log(`📡 Fazendo requisição: ${method} ${path}`);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (cookie) {
      options.headers['Cookie'] = cookie;
      console.log(`🍪 Usando cookie: ${cookie.substring(0, 50)}...`);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        console.log(`📥 Resposta recebida: ${res.statusCode}`);
        try {
          const jsonBody = JSON.parse(body);
          resolve({ 
            status: res.statusCode, 
            data: jsonBody, 
            headers: res.headers,
            cookie: res.headers['set-cookie']
          });
        } catch (e) {
          console.log(`⚠️ Erro ao parsear JSON, retornando texto: ${e.message}`);
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`❌ Erro na requisição: ${err.message}`);
      reject(err);
    });

    if (data) {
      const jsonData = JSON.stringify(data);
      console.log(`📤 Enviando dados: ${jsonData}`);
      req.write(jsonData);
    }

    req.end();
  });
}

async function testPermissions() {
  console.log('🧪 Testando Sistema de Permissões\n');

  try {
    // 1. Fazer login como KeyUser
    console.log('1️⃣ Fazendo login como KeyUser...');
    const loginResponse = await makeRequest('POST', '/api/auth/login', {
      email: 'padupb@admin.icap',
      password: '170824'
    });

    console.log('Status do login:', loginResponse.status);
    console.log('Resposta do login:', JSON.stringify(loginResponse.data, null, 2));

    if (loginResponse.status !== 200) {
      console.log('❌ Falha no login do KeyUser');
      return;
    }

    console.log('✅ Login do KeyUser realizado com sucesso');
    const sessionCookie = loginResponse.cookie ? loginResponse.cookie[0] : null;
    console.log('🍪 Cookie de sessão:', sessionCookie);

    // 2. Verificar informações do usuário
    console.log('\n2️⃣ Verificando informações do usuário...');
    const meResponse = await makeRequest('GET', '/api/auth/me', null, sessionCookie);
    console.log('Status /api/auth/me:', meResponse.status);
    console.log('Dados do usuário:', JSON.stringify(meResponse.data, null, 2));

    // 3. Testar acesso a uma rota protegida
    console.log('\n3️⃣ Testando acesso a rota protegida /api/users...');
    const usersResponse = await makeRequest('GET', '/api/users', null, sessionCookie);
    console.log('Status /api/users:', usersResponse.status);
    console.log('Resposta /api/users:', JSON.stringify(usersResponse.data, null, 2));

    console.log('\n🎉 Teste concluído!');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testPermissions().catch(console.error); 