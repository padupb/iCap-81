const fetch = require('node-fetch');

async function testKeyuserLogin() {
  try {
    console.log('🔍 Testando login do keyuser...');
    
    // Fazer login
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'padupb@admin.icap',
        password: '170824'
      })
    });
    
    if (!loginResponse.ok) {
      const errorData = await loginResponse.json();
      console.error('❌ Erro no login:', errorData);
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login realizado com sucesso:', JSON.stringify(loginData, null, 2));
    
    // Extrair cookies da resposta
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('🍪 Cookies recebidos:', cookies);
    
    // Verificar informações do usuário
    const meResponse = await fetch('http://localhost:3000/api/auth/me', {
      headers: {
        'Cookie': cookies || ''
      }
    });
    
    if (!meResponse.ok) {
      console.error('❌ Erro ao verificar usuário');
      return;
    }
    
    const meData = await meResponse.json();
    console.log('👤 Dados do usuário:', JSON.stringify(meData, null, 2));
    
    // Verificar se é keyuser
    if (meData.user && meData.user.isKeyUser) {
      console.log('🎉 KeyUser identificado corretamente!');
      console.log('🔑 Permissões:', meData.user.permissions);
      console.log('👨‍💻 isDeveloper:', meData.user.isDeveloper);
    } else {
      console.log('❌ KeyUser não foi identificado corretamente');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Executar teste
testKeyuserLogin(); 