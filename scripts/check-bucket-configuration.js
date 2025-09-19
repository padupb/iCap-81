
const fs = require('fs');

async function checkBucketConfiguration() {
  console.log('🔍 VERIFICANDO CONFIGURAÇÃO DO BUCKET\n');

  try {
    // 1. Verificar .replit file
    console.log('1. Verificando arquivo .replit...');
    const replitFile = '.replit';
    
    if (fs.existsSync(replitFile)) {
      const content = fs.readFileSync(replitFile, 'utf8');
      console.log('✅ Arquivo .replit encontrado');
      
      const bucketMatch = content.match(/defaultBucketID\s*=\s*"([^"]+)"/);
      if (bucketMatch) {
        const bucketId = bucketMatch[1];
        console.log(`📦 Bucket ID configurado: ${bucketId}`);
        
        // Verificar se o bucket ID parece válido
        if (bucketId.startsWith('replit-objstore-') && bucketId.length > 20) {
          console.log('✅ Formato do Bucket ID parece válido');
        } else {
          console.log('⚠️ Formato do Bucket ID pode estar incorreto');
        }
        
        // Verificar se é o bucket ID correto
        const expectedBucketId = 'replit-objstore-fbeb22e6-fccf-4b1c-92bc-eb3a0e56bd49';
        if (bucketId === expectedBucketId) {
          console.log('✅ Bucket ID corresponde ao esperado');
        } else {
          console.log(`⚠️ Bucket ID difere do esperado: ${expectedBucketId}`);
        }
      } else {
        console.log('❌ Bucket ID não encontrado no arquivo .replit');
        console.log('📋 Conteúdo do .replit:');
        console.log(content);
      }
    } else {
      console.log('❌ Arquivo .replit não encontrado');
    }

    // 2. Testar Object Storage
    console.log('\n2. Testando conexão com Object Storage...');
    
    try {
      const { Client } = require('@replit/object-storage');
      
      // Verificar se estamos no ambiente Replit
      if (!process.env.REPL_ID) {
        console.log('⚠️ Não está executando no Replit - Object Storage pode não funcionar');
      }
      
      const client = new Client();
      console.log('✅ Cliente Object Storage criado');
      
      // Tentar listar objetos com timeout
      console.log('🔍 Listando objetos no storage...');
      const objects = await Promise.race([
        client.list(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout na listagem')), 30000)
        )
      ]);
      
      console.log(`✅ Conexão bem-sucedida - ${objects.length} objetos encontrados`);
      
      // Procurar arquivos específicos do pedido CCM0809250026
      const orderFiles = objects.filter(obj => 
        obj.key.includes('CCM0809250026') || 
        obj.key.includes('orders/CCM0809250026')
      );
      
      if (orderFiles.length > 0) {
        console.log(`\n📋 Arquivos encontrados para CCM0809250026:`);
        orderFiles.forEach(obj => {
          console.log(`   • ${obj.key} (${(obj.size / 1024).toFixed(2)} KB)`);
        });
        
        // Tentar download de um arquivo específico
        const testFile = orderFiles.find(obj => obj.key.includes('certificado_pdf'));
        if (testFile) {
          console.log(`\n3. Testando download do arquivo: ${testFile.key}`);
          try {
            const downloadResult = await client.downloadAsBytes(testFile.key);
            
            if (downloadResult && downloadResult.length > 0) {
              console.log(`✅ Download bem-sucedido: ${downloadResult.length} bytes`);
              
              // Verificar se é um PDF válido
              const isValidPdf = downloadResult[0] === 0x25 && 
                                downloadResult[1] === 0x50 && 
                                downloadResult[2] === 0x44 && 
                                downloadResult[3] === 0x46;
              
              if (isValidPdf) {
                console.log('✅ Arquivo é um PDF válido');
              } else {
                console.log('⚠️ Arquivo pode estar corrompido (não é um PDF válido)');
              }
            } else {
              console.log('❌ Download retornou dados vazios');
            }
          } catch (downloadError) {
            console.log(`❌ Erro no download: ${downloadError.message}`);
            console.log(`   Stack: ${downloadError.stack}`);
          }
        }
      } else {
        console.log('⚠️ Nenhum arquivo encontrado para CCM0809250026');
        
        // Mostrar alguns arquivos para debug
        if (objects.length > 0) {
          console.log('\n📋 Primeiros 10 objetos no storage:');
          objects.slice(0, 10).forEach(obj => {
            console.log(`   • ${obj.key} (${(obj.size / 1024).toFixed(2)} KB)`);
          });
          
          // Procurar por qualquer arquivo de pedido
          const anyOrderFiles = objects.filter(obj => 
            obj.key.includes('.pdf') || 
            obj.key.includes('.xml') ||
            obj.key.includes('orders/') ||
            obj.key.match(/^(CCM|CAP|CNI|CO)/)
          );
          
          if (anyOrderFiles.length > 0) {
            console.log(`\n📄 Arquivos de pedidos encontrados (${anyOrderFiles.length}):`);
            anyOrderFiles.slice(0, 5).forEach(obj => {
              console.log(`   • ${obj.key}`);
            });
          }
        }
      }
      
    } catch (storageError) {
      console.log(`❌ Erro no Object Storage: ${storageError.message}`);
      
      if (storageError.message.includes('403') || storageError.message.includes('unauthorized')) {
        console.log('\n💡 POSSÍVEL SOLUÇÃO:');
        console.log('   • Bucket ID pode estar incorreto');
        console.log('   • Object Storage pode não estar habilitado');
        console.log('   • Permissões podem estar incorretas');
      }
    }

    // 3. Verificar variáveis de ambiente
    console.log('\n4. Verificando variáveis de ambiente...');
    console.log(`   • REPL_ID: ${process.env.REPL_ID || 'não definido'}`);
    console.log(`   • NODE_ENV: ${process.env.NODE_ENV || 'não definido'}`);

    console.log('\n📊 RESUMO:');
    console.log('   • Verifique se o Bucket ID no .replit está correto');
    console.log('   • Confirme se Object Storage está habilitado no Repl');
    console.log('   • Se necessário, recrie o bucket nas configurações do Repl');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Executar verificação
checkBucketConfiguration()
  .then(() => {
    console.log('\n✅ Verificação concluída');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro na verificação:', error);
    process.exit(1);
  });
