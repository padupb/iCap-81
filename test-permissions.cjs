const http = require('http');

// Função para fazer requisições HTTP
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, data: jsonBody });
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

async function testPermissions() {
  console.log('🧪 Testando sistema de permissões...\n');

  try {
    // 1. Testar rota de menus do sistema
    console.log('1️⃣ Testando rota /api/system-menus...');
    const menusResponse = await makeRequest('GET', '/api/system-menus');
    console.log(`Status: ${menusResponse.status}`);
    if (menusResponse.status === 200) {
      console.log('✅ Menus do sistema carregados com sucesso:');
      menusResponse.data.forEach(menu => {
        console.log(`   - ${menu.name} (${menu.id}): ${menu.description}`);
      });
    } else {
      console.log('❌ Erro ao carregar menus:', menusResponse.data);
    }

    console.log('\n2️⃣ Testando rota /api/user-roles...');
    const rolesResponse = await makeRequest('GET', '/api/user-roles');
    console.log(`Status: ${rolesResponse.status}`);
    if (rolesResponse.status === 200) {
      console.log('✅ Funções de usuário carregadas com sucesso:');
      rolesResponse.data.forEach(role => {
        const permissionCount = role.permissions ? role.permissions.filter(p => p.startsWith('view_')).length : 0;
        console.log(`   - ${role.name}: ${permissionCount} permissões`);
        if (role.permissions && role.permissions.length > 0) {
          console.log(`     Permissões: ${role.permissions.join(', ')}`);
        }
      });
    } else {
      console.log('❌ Erro ao carregar funções:', rolesResponse.data);
    }

    console.log('\n✅ Teste concluído!');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

// Aguardar um pouco para o servidor inicializar
setTimeout(testPermissions, 3000); 