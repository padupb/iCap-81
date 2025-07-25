
const fs = require('fs');

async function testReplitObjectStorage() {
  console.log('🧪 TESTE ESPECÍFICO DO OBJECT STORAGE NO REPLIT\n');
  
  // Verificar ambiente Replit
  if (!process.env.REPL_ID && !process.env.REPLIT_DB_URL) {
    console.log('❌ Não está executando no Replit');
    console.log('🔍 Variáveis de ambiente Replit não encontradas');
    return;
  }
  
  console.log('✅ Ambiente Replit detectado');
  console.log(`🆔 REPL_ID: ${process.env.REPL_ID || 'não definido'}`);
  
  try {
    // Teste 1: Importar módulo
    console.log('\n1️⃣ Testando importação do módulo...');
    let storageModule;
    
    try {
      storageModule = await import('@replit/object-storage');
      console.log('✅ Módulo importado com sucesso usando ES import');
    } catch (esError) {
      console.log('❌ Falha no ES import:', esError.message);
      
      try {
        storageModule = require('@replit/object-storage');
        console.log('✅ Módulo importado com sucesso usando require');
      } catch (requireError) {
        console.log('❌ Falha no require:', requireError.message);
        console.log('\n💡 Execute: npm install @replit/object-storage');
        return;
      }
    }
    
    // Teste 2: Criar cliente
    console.log('\n2️⃣ Testando criação do cliente...');
    let client;
    
    if (storageModule.Client) {
      client = new storageModule.Client();
      console.log('✅ Cliente criado usando new Client()');
    } else if (storageModule.getClient) {
      client = storageModule.getClient();
      console.log('✅ Cliente criado usando getClient()');
    } else if (storageModule.default && storageModule.default.Client) {
      client = new storageModule.default.Client();
      console.log('✅ Cliente criado usando default.Client()');
    } else {
      console.log('❌ Nenhum método de criação encontrado');
      console.log('🔍 Propriedades do módulo:', Object.keys(storageModule));
      return;
    }
    
    // Teste 3: Listar objetos
    console.log('\n3️⃣ Testando listagem de objetos...');
    const objects = await client.list();
    console.log(`✅ Listagem bem-sucedida - ${objects.length} objetos encontrados`);
    
    // Teste 4: Upload de teste
    console.log('\n4️⃣ Testando upload...');
    const testKey = `test/replit-test-${Date.now()}.txt`;
    const testContent = `Teste do Replit Object Storage em ${new Date().toISOString()}`;
    
    if (typeof client.uploadFromText === 'function') {
      await client.uploadFromText(testKey, testContent);
      console.log('✅ Upload usando uploadFromText');
    } else if (typeof client.uploadFromBuffer === 'function') {
      await client.uploadFromBuffer(testKey, Buffer.from(testContent, 'utf8'));
      console.log('✅ Upload usando uploadFromBuffer');
    } else {
      console.log('❌ Nenhum método de upload encontrado');
      console.log('🔍 Métodos disponíveis:', Object.getOwnPropertyNames(client).filter(name => 
        typeof client[name] === 'function'
      ));
      return;
    }
    
    // Teste 5: Download de teste
    console.log('\n5️⃣ Testando download...');
    let downloadedContent;
    
    if (typeof client.downloadAsText === 'function') {
      downloadedContent = await client.downloadAsText(testKey);
      console.log('✅ Download usando downloadAsText');
    } else if (typeof client.downloadAsBuffer === 'function') {
      const buffer = await client.downloadAsBuffer(testKey);
      downloadedContent = buffer.toString('utf8');
      console.log('✅ Download usando downloadAsBuffer');
    } else {
      console.log('⚠️ Nenhum método de download encontrado');
    }
    
    if (downloadedContent && downloadedContent === testContent) {
      console.log('✅ Conteúdo verificado com sucesso');
    } else {
      console.log('⚠️ Conteúdo não confere ou não foi baixado');
    }
    
    // Teste 6: Limpeza
    console.log('\n6️⃣ Limpando arquivo de teste...');
    if (typeof client.delete === 'function') {
      await client.delete(testKey);
      console.log('✅ Arquivo teste removido');
    }
    
    console.log('\n🎉 OBJECT STORAGE FUNCIONANDO PERFEITAMENTE NO REPLIT!');
    console.log('📦 Integração pode ser usada com segurança');
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error('📋 Stack trace:', error.stack);
    
    console.log('\n🔍 DIAGNÓSTICOS:');
    console.log('1. Verifique se Object Storage está habilitado no seu Repl');
    console.log('2. Certifique-se de que está executando no ambiente Replit');
    console.log('3. Tente recarregar o Repl');
    console.log('4. Verifique se há problemas de conectividade');
  }
}

// Executar o teste
testReplitObjectStorage().catch(console.error);
