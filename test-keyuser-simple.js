// Script de teste simples para verificar o keyuser
console.log('🔍 Testando configurações do keyuser...');

// Simular uma requisição de login
const testLogin = async () => {
  try {
    console.log('📡 Fazendo requisição de login...');
    
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'padupb@admin.icap',
        password: '170824'
      })
    });
    
    console.log('📊 Status da resposta:', response.status);
    
    const data = await response.json();
    console.log('📋 Dados da resposta:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('✅ Login bem-sucedido!');
      console.log('👤 Usuário:', data.user.name);
      console.log('🔑 É KeyUser:', data.user.isKeyUser);
      console.log('👨‍💻 É Developer:', data.user.isDeveloper);
    } else {
      console.log('❌ Falha no login:', data.message);
    }
    
  } catch (error) {
    console.error('❌ Erro na requisição:', error.message);
  }
};

// Executar o teste
testLogin(); 