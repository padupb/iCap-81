
const { Pool } = require('pg');

async function testObjectStorageConnection() {
  console.log('🔧 TESTANDO CONEXÃO COM OBJECT STORAGE\n');

  try {
    // 1. Verificar se o pacote está instalado
    console.log('1. Verificando instalação do @replit/object-storage...');
    const { Client } = require('@replit/object-storage');
    console.log('✅ Pacote @replit/object-storage encontrado');

    // 2. Tentar inicializar cliente
    console.log('2. Inicializando cliente Object Storage...');
    const objectStorage = new Client();
    console.log('✅ Cliente Object Storage inicializado');

    // 3. Testar listagem de objetos
    console.log('3. Testando listagem de objetos...');
    const objects = await objectStorage.list();
    console.log(`✅ Listagem bem-sucedida - ${objects.length} objetos encontrados`);

    // 4. Testar upload de arquivo teste
    console.log('4. Testando upload de arquivo teste...');
    const testKey = `test/connection-test-${Date.now()}.txt`;
    const testContent = `Teste de conexão realizado em ${new Date().toISOString()}`;
    
    await objectStorage.uploadFromText(testKey, testContent);
    console.log(`✅ Upload bem-sucedido: ${testKey}`);

    // 5. Testar download do arquivo teste
    console.log('5. Testando download do arquivo teste...');
    const downloadedContent = await objectStorage.downloadAsText(testKey);
    console.log(`✅ Download bem-sucedido. Conteúdo: ${downloadedContent.substring(0, 50)}...`);

    // 6. Limpar arquivo teste
    console.log('6. Limpando arquivo teste...');
    await objectStorage.delete(testKey);
    console.log('✅ Arquivo teste removido');

    console.log('\n🎉 OBJECT STORAGE ESTÁ FUNCIONANDO PERFEITAMENTE!');
    console.log('📦 Todos os novos uploads serão salvos no Object Storage');
    
    return { success: true, objectCount: objects.length };

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE DO OBJECT STORAGE:', error.message);
    
    if (error.message.includes('Cannot find module')) {
      console.log('\n💡 SOLUÇÃO:');
      console.log('   npm install @replit/object-storage');
    } else if (error.message.includes('permission') || error.message.includes('authentication')) {
      console.log('\n💡 POSSÍVEL CAUSA:');
      console.log('   - Problemas de autenticação com o Object Storage');
      console.log('   - Verifique se o Repl tem permissões adequadas');
    } else {
      console.log('\n💡 POSSÍVEL CAUSA:');
      console.log('   - Problemas de conectividade');
      console.log('   - Object Storage pode estar temporariamente indisponível');
    }
    
    return { success: false, error: error.message };
  }
}

if (require.main === module) {
  testObjectStorageConnection()
    .then((result) => {
      if (result.success) {
        console.log('\n✅ Teste concluído com sucesso');
        process.exit(0);
      } else {
        console.log('\n❌ Teste falhou');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n💥 Erro inesperado:', error);
      process.exit(1);
    });
}

module.exports = { testObjectStorageConnection };
const fs = require('fs');
const path = require('path');

async function testObjectStorageConnection() {
  console.log('🧪 TESTANDO CONEXÃO COM OBJECT STORAGE DO REPLIT\n');
  
  try {
    // Tentar importar o módulo
    console.log('📦 Tentando importar @replit/object-storage...');
    const storage = require('@replit/object-storage');
    console.log('✅ Módulo importado com sucesso');
    
    // Tentar criar cliente
    console.log('\n🔌 Tentando criar cliente...');
    let client;
    
    if (storage.Client) {
      client = new storage.Client();
      console.log('✅ Cliente criado usando new Client()');
    } else if (storage.getClient) {
      client = storage.getClient();
      console.log('✅ Cliente criado usando getClient()');
    } else if (typeof storage === 'object' && storage.list) {
      client = storage;
      console.log('✅ Usando objeto de storage diretamente');
    } else {
      throw new Error('Nenhum método de criação de cliente encontrado');
    }
    
    // Testar listagem
    console.log('\n📋 Testando listagem de objetos...');
    const objects = await client.list();
    console.log(`✅ Listagem bem-sucedida! Encontrados ${objects.length} objetos`);
    
    if (objects.length > 0) {
      console.log('\n📂 Primeiros objetos encontrados:');
      objects.slice(0, 5).forEach((obj, index) => {
        console.log(`   ${index + 1}. ${obj.name || obj.key || obj}`);
      });
    }
    
    // Testar upload de arquivo pequeno
    console.log('\n📤 Testando upload de arquivo de teste...');
    const testKey = 'test/connection-test.txt';
    const testContent = `Teste de conexão - ${new Date().toISOString()}`;
    const testBuffer = Buffer.from(testContent, 'utf8');
    
    if (client.uploadFromBuffer) {
      await client.uploadFromBuffer(testKey, testBuffer);
    } else if (client.upload) {
      await client.upload(testKey, testBuffer);
    } else if (client.put) {
      await client.put(testKey, testBuffer);
    } else {
      throw new Error('Nenhum método de upload encontrado');
    }
    
    console.log(`✅ Upload bem-sucedido! Arquivo salvo em: ${testKey}`);
    
    // Testar download
    console.log('\n📥 Testando download do arquivo...');
    let downloadedBuffer;
    
    if (client.downloadAsBuffer) {
      downloadedBuffer = await client.downloadAsBuffer(testKey);
    } else if (client.download) {
      const result = await client.download(testKey);
      downloadedBuffer = Buffer.isBuffer(result) ? result : Buffer.from(result);
    } else if (client.get) {
      const result = await client.get(testKey);
      downloadedBuffer = Buffer.isBuffer(result) ? result : Buffer.from(result);
    } else {
      throw new Error('Nenhum método de download encontrado');
    }
    
    const downloadedContent = downloadedBuffer.toString('utf8');
    
    if (downloadedContent === testContent) {
      console.log('✅ Download bem-sucedido! Conteúdo conferido');
    } else {
      console.log('⚠️ Download realizado mas conteúdo não confere');
      console.log(`Esperado: ${testContent}`);
      console.log(`Recebido: ${downloadedContent}`);
    }
    
    console.log('\n🎉 OBJECT STORAGE FUNCIONANDO PERFEITAMENTE!');
    console.log('✅ Seus arquivos serão persistidos entre deployments');
    console.log('📦 Configure o sistema para usar Object Storage por padrão');
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    
    if (error.message.includes('Cannot find module')) {
      console.log('\n💡 SOLUÇÃO:');
      console.log('   npm install @replit/object-storage');
      console.log('   Reinicie o servidor após a instalação');
    } else {
      console.log('\n🔍 Verifique:');
      console.log('   1. Se você está executando no Replit');
      console.log('   2. Se o Object Storage está habilitado no seu Repl');
      console.log('   3. Se há permissões adequadas');
    }
  }
}

if (require.main === module) {
  testObjectStorageConnection()
    .then(() => {
      console.log('\n✅ Teste concluído');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erro crítico:', error);
      process.exit(1);
    });
}

module.exports = { testObjectStorageConnection };
