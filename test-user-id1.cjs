const http = require('http');

const testUserLogin = (email, password, description) => {
  console.log(`🧪 ${description}`);
  
  const postData = JSON.stringify({
    email: email,
    password: password
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response:', data);
      
      try {
        const response = JSON.parse(data);
        if (response.success && response.user) {
          console.log('✅ LOGIN FUNCIONANDO!');
          console.log('👤 ID:', response.user.id);
          console.log('👤 Nome:', response.user.name);
          console.log('📧 Email:', response.user.email);
          console.log('🔑 É KeyUser:', response.user.isKeyUser);
          console.log('🛠️ É Developer:', response.user.isDeveloper);
          console.log('🎯 Permissões:', response.user.permissions);
          
          if (response.user.isKeyUser) {
            console.log('🎉 USUÁRIO TEM PERMISSÕES DE KEYUSER!');
          }
        } else {
          console.log('❌ Login falhou');
          console.log('📄 Resposta:', response);
        }
      } catch (error) {
        console.log('❌ Erro ao parsear resposta:', error.message);
      }
      console.log('---');
    });
  });

  req.on('error', (error) => {
    console.log('❌ Erro na requisição:', error.message);
  });

  req.write(postData);
  req.end();
};

// Aguardar um pouco para o servidor inicializar
setTimeout(() => {
  // Testar com diferentes usuários
  testUserLogin('padupb@gmail.com', '170824', 'Testando padupb@gmail.com');
  
  setTimeout(() => {
    testUserLogin('admin@test.com', 'admin@test.com', 'Testando admin@test.com (se existir)');
  }, 1000);
  
  setTimeout(() => {
    testUserLogin('user@test.com', 'user@test.com', 'Testando user@test.com (se existir)');
  }, 2000);
}, 3000); 