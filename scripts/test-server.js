
const fetch = require('node-fetch');

async function testServer() {
  console.log('🔍 Testando conectividade do servidor...\n');
  
  const baseUrl = process.env.REPL_SLUG 
    ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
    : 'http://localhost:5000';
  
  console.log(`🌐 URL base: ${baseUrl}`);
  
  try {
    // Teste 1: Health check
    console.log('\n📊 Teste 1: Health check');
    const healthResponse = await fetch(`${baseUrl}/health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Health check passou:', healthData);
    } else {
      console.log('❌ Health check falhou:', healthResponse.status);
    }
    
    // Teste 2: Rota principal
    console.log('\n🏠 Teste 2: Rota principal');
    const mainResponse = await fetch(baseUrl);
    if (mainResponse.ok) {
      console.log('✅ Rota principal acessível');
      console.log('📄 Content-Type:', mainResponse.headers.get('content-type'));
    } else {
      console.log('❌ Rota principal inacessível:', mainResponse.status);
    }
    
    // Teste 3: API
    console.log('\n🔗 Teste 3: API de configurações');
    const apiResponse = await fetch(`${baseUrl}/api/settings`);
    if (apiResponse.ok) {
      console.log('✅ API acessível');
    } else {
      console.log('❌ API inacessível:', apiResponse.status);
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar servidor:', error.message);
  }
}

if (require.main === module) {
  testServer();
}

module.exports = testServer;
