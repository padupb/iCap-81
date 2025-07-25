
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
