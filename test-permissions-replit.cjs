const https = require('https');

// Função para fazer requisições HTTPS
function makeRequest(method, path, data = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'icap7-2.replit.app',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (cookie) {
      options.headers['Cookie'] = cookie;
    }

    const req = https.request(options, (res) => {
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
            cookie: res.headers['set-cookie']
          });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
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

async function testPermissions() {
  console.log('🧪 Testando Sistema de Permissões no Replit\n');

  try {
    // 1. Fazer login como KeyUser
    console.log('1️⃣ Fazendo login como KeyUser...');
    const loginResponse = await makeRequest('POST', '/api/auth/login', {
      email: 'padupb@admin.icap',
      password: '170824'
    });

    if (loginResponse.status !== 200) {
      console.log('❌ Falha no login:', loginResponse.data);
      return;
    }

    console.log('✅ Login realizado com sucesso');
    const sessionCookie = loginResponse.cookie ? loginResponse.cookie[0] : null;

    // 2. Verificar informações do usuário
    console.log('\n2️⃣ Verificando informações do usuário...');
    const meResponse = await makeRequest('GET', '/api/auth/me', null, sessionCookie);
    console.log('👤 Usuário:', {
      id: meResponse.data.user?.id,
      name: meResponse.data.user?.name,
      isKeyUser: meResponse.data.user?.isKeyUser,
      permissions: meResponse.data.user?.permissions
    });

    // 3. Criar usuário de teste com permissões limitadas
    console.log('\n3️⃣ Criando usuário de teste...');
    const testUserResponse = await makeRequest('POST', '/api/create-test-user', {}, sessionCookie);
    
    if (testUserResponse.status === 200) {
      console.log('✅ Usuário de teste criado:', testUserResponse.data.user.email);
      console.log('🔐 Permissões da função:', testUserResponse.data.role.permissions);
    } else {
      console.log('⚠️ Usuário de teste já existe ou erro:', testUserResponse.data);
    }

    // 4. Fazer logout do KeyUser
    console.log('\n4️⃣ Fazendo logout do KeyUser...');
    await makeRequest('POST', '/api/auth/logout', {}, sessionCookie);

    // 5. Fazer login como usuário de teste
    console.log('\n5️⃣ Fazendo login como usuário de teste...');
    const testLoginResponse = await makeRequest('POST', '/api/auth/login', {
      email: 'teste@teste.com',
      password: '123456'
    });

    if (testLoginResponse.status !== 200) {
      console.log('❌ Falha no login do usuário de teste:', testLoginResponse.data);
      return;
    }

    console.log('✅ Login do usuário de teste realizado');
    const testSessionCookie = testLoginResponse.cookie ? testLoginResponse.cookie[0] : null;

    // 6. Verificar informações do usuário de teste
    console.log('\n6️⃣ Verificando informações do usuário de teste...');
    const testMeResponse = await makeRequest('GET', '/api/auth/me', null, testSessionCookie);
    console.log('👤 Usuário de teste:', {
      id: testMeResponse.data.user?.id,
      name: testMeResponse.data.user?.name,
      isKeyUser: testMeResponse.data.user?.isKeyUser,
      permissions: testMeResponse.data.user?.permissions
    });

    // 7. Testar acesso a recursos permitidos (dashboard e pedidos)
    console.log('\n7️⃣ Testando acesso a recursos PERMITIDOS...');
    
    // Dashboard (permitido)
    const dashboardResponse = await makeRequest('GET', '/api/orders', null, testSessionCookie);
    console.log('📊 Dashboard/Pedidos:', dashboardResponse.status === 200 ? '✅ PERMITIDO' : '❌ NEGADO');

    // 8. Testar acesso a recursos NÃO permitidos (usuários, empresas, etc.)
    console.log('\n8️⃣ Testando acesso a recursos NÃO PERMITIDOS...');
    
    // Usuários (não permitido)
    const usersResponse = await makeRequest('GET', '/api/users', null, testSessionCookie);
    console.log('👥 Usuários:', usersResponse.status === 403 ? '✅ NEGADO (correto)' : '❌ PERMITIDO (erro)');
    
    // Empresas (não permitido)
    const companiesResponse = await makeRequest('GET', '/api/companies', null, testSessionCookie);
    console.log('🏢 Empresas:', companiesResponse.status === 403 ? '✅ NEGADO (correto)' : '❌ PERMITIDO (erro)');
    
    // Produtos (não permitido)
    const productsResponse = await makeRequest('GET', '/api/products', null, testSessionCookie);
    console.log('📦 Produtos:', productsResponse.status === 403 ? '✅ NEGADO (correto)' : '❌ PERMITIDO (erro)');

    console.log('\n🎉 Teste de permissões concluído!');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

testPermissions(); 