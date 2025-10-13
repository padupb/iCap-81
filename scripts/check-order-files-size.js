
const { Pool } = require('pg');

async function checkOrderFilesSize(orderId = 'CCM0809250025') {
  console.log(`🔍 VERIFICANDO ARQUIVOS DO PEDIDO ${orderId}\n`);
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não configurada nos Secrets!');
    return;
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // 1. Buscar informações do pedido no banco
    console.log('📋 1. Consultando informações do pedido no banco...');
    const pedidoResult = await pool.query(`
      SELECT id, order_id, documentos_info, documentoscarregados 
      FROM orders 
      WHERE order_id = $1
    `, [orderId]);

    if (pedidoResult.rows.length === 0) {
      console.log(`❌ Pedido ${orderId} não encontrado no banco`);
      return;
    }

    const pedido = pedidoResult.rows[0];
    console.log(`✅ Pedido encontrado (ID: ${pedido.id})`);
    console.log(`   • Documentos carregados: ${pedido.documentoscarregados}`);

    if (!pedido.documentos_info) {
      console.log('❌ Nenhuma informação de documentos encontrada no banco');
      return;
    }

    const documentosInfo = typeof pedido.documentos_info === 'string' 
      ? JSON.parse(pedido.documentos_info) 
      : pedido.documentos_info;

    console.log('\n📄 2. Informações dos documentos no banco:');
    const arquivos = [];
    
    for (const [tipo, info] of Object.entries(documentosInfo)) {
      const tamanhoKB = (info.size / 1024).toFixed(2);
      console.log(`\n   ${tipo.toUpperCase()}:`);
      console.log(`     • Nome: ${info.filename}`);
      console.log(`     • Storage Key: ${info.storageKey}`);
      console.log(`     • Tamanho no banco: ${info.size} bytes (${tamanhoKB} KB)`);
      
      arquivos.push({
        tipo,
        filename: info.filename,
        storageKey: info.storageKey,
        tamanhoEsperado: info.size
      });
    }

    // 2. Verificar Object Storage
    console.log('\n☁️ 3. Verificando Object Storage...');
    let objectStorage = null;
    
    try {
      const { Client } = require('@replit/object-storage');
      objectStorage = new Client();
      console.log('✅ Object Storage inicializado');
    } catch (error) {
      console.log('❌ Object Storage não disponível:', error.message);
      return;
    }

    // 3. Fazer download e verificar cada arquivo
    console.log('\n📥 4. Fazendo download e verificando integridade...\n');
    
    const diagnostico = {
      sucesso: [],
      falhas: [],
      diferencasTamanho: []
    };

    for (const arquivo of arquivos) {
      console.log(`🔍 Verificando ${arquivo.tipo}...`);
      console.log(`   • Storage Key: ${arquivo.storageKey}`);
      
      try {
        // Fazer download
        const downloadStartTime = Date.now();
        const data = await objectStorage.downloadAsBytes(arquivo.storageKey);
        const downloadTime = Date.now() - downloadStartTime;

        // Verificar formato da resposta
        let fileBuffer;
        if (data && typeof data === 'object' && data.ok && data.value) {
          fileBuffer = Buffer.from(data.value);
        } else if (data instanceof Uint8Array) {
          fileBuffer = Buffer.from(data);
        } else if (Buffer.isBuffer(data)) {
          fileBuffer = data;
        } else if (Array.isArray(data)) {
          fileBuffer = Buffer.from(data);
        } else {
          throw new Error(`Formato de dados inesperado: ${typeof data}`);
        }

        const tamanhoDownload = fileBuffer.length;
        const tamanhoKB = (tamanhoDownload / 1024).toFixed(2);
        
        console.log(`   ✅ Download concluído em ${downloadTime}ms`);
        console.log(`   📊 Tamanho baixado: ${tamanhoDownload} bytes (${tamanhoKB} KB)`);
        
        // Comparar tamanhos
        if (tamanhoDownload === arquivo.tamanhoEsperado) {
          console.log(`   ✅ Integridade OK - Tamanhos iguais!`);
          diagnostico.sucesso.push(arquivo.tipo);
        } else {
          console.log(`   ❌ DIVERGÊNCIA DE TAMANHO DETECTADA!`);
          console.log(`      • Esperado: ${arquivo.tamanhoEsperado} bytes`);
          console.log(`      • Recebido: ${tamanhoDownload} bytes`);
          console.log(`      • Diferença: ${Math.abs(tamanhoDownload - arquivo.tamanhoEsperado)} bytes`);
          
          diagnostico.diferencasTamanho.push({
            tipo: arquivo.tipo,
            esperado: arquivo.tamanhoEsperado,
            recebido: tamanhoDownload,
            diferenca: Math.abs(tamanhoDownload - arquivo.tamanhoEsperado)
          });
        }

        // Verificar tipo de arquivo
        if (arquivo.tipo.includes('pdf')) {
          const isPdf = fileBuffer[0] === 0x25 && 
                       fileBuffer[1] === 0x50 && 
                       fileBuffer[2] === 0x44 && 
                       fileBuffer[3] === 0x46;
          console.log(`   📄 Formato PDF válido: ${isPdf ? 'Sim' : 'Não'}`);
          
          if (!isPdf) {
            console.log(`   ⚠️ Primeiros bytes: ${Array.from(fileBuffer.slice(0, 10)).map(b => b.toString(16)).join(' ')}`);
          }
        }

        console.log('');

      } catch (error) {
        console.log(`   ❌ Erro no download: ${error.message}`);
        diagnostico.falhas.push({
          tipo: arquivo.tipo,
          erro: error.message
        });
        console.log('');
      }
    }

    // 4. Resumo e diagnóstico
    console.log('═'.repeat(60));
    console.log('📊 RESUMO DA VERIFICAÇÃO');
    console.log('═'.repeat(60));
    
    console.log(`\n✅ Arquivos íntegros: ${diagnostico.sucesso.length}`);
    if (diagnostico.sucesso.length > 0) {
      diagnostico.sucesso.forEach(tipo => console.log(`   • ${tipo}`));
    }

    if (diagnostico.diferencasTamanho.length > 0) {
      console.log(`\n❌ Arquivos com divergência de tamanho: ${diagnostico.diferencasTamanho.length}`);
      diagnostico.diferencasTamanho.forEach(item => {
        console.log(`\n   • ${item.tipo}:`);
        console.log(`     Esperado: ${item.esperado} bytes (${(item.esperado / 1024).toFixed(2)} KB)`);
        console.log(`     Recebido: ${item.recebido} bytes (${(item.recebido / 1024).toFixed(2)} KB)`);
        console.log(`     Diferença: ${item.diferenca} bytes`);
      });
    }

    if (diagnostico.falhas.length > 0) {
      console.log(`\n❌ Arquivos com erro no download: ${diagnostico.falhas.length}`);
      diagnostico.falhas.forEach(item => {
        console.log(`   • ${item.tipo}: ${item.erro}`);
      });
    }

    // 5. Diagnóstico de possíveis causas
    if (diagnostico.diferencasTamanho.length > 0 || diagnostico.falhas.length > 0) {
      console.log('\n🔍 DIAGNÓSTICO DE POSSÍVEIS CAUSAS:\n');
      
      if (diagnostico.diferencasTamanho.length > 0) {
        console.log('📋 Divergência de tamanho pode indicar:');
        console.log('   1. Arquivo corrompido durante upload');
        console.log('   2. Problema na API do Object Storage (retornando dados incompletos)');
        console.log('   3. Encoding incorreto durante download');
        console.log('   4. Arquivo foi modificado após upload');
        console.log('   5. Informação incorreta salva no banco de dados\n');
        
        // Verificar se o tamanho recebido é consistente (43722 bytes = HTML de erro)
        const tamanhosRecebidos = diagnostico.diferencasTamanho.map(d => d.recebido);
        const todosIguais = tamanhosRecebidos.every(t => t === tamanhosRecebidos[0]);
        
        if (todosIguais && tamanhosRecebidos[0] === 43722) {
          console.log('⚠️ CAUSA IDENTIFICADA:');
          console.log('   Todos os arquivos retornam 43722 bytes (HTML de erro)');
          console.log('   Isso indica que o Object Storage está retornando página de erro');
          console.log('   ao invés do arquivo real.\n');
          console.log('💡 SOLUÇÃO:');
          console.log('   1. Verificar se os arquivos existem no Object Storage');
          console.log('   2. Verificar permissões de acesso');
          console.log('   3. Re-fazer upload dos arquivos');
        }
      }
      
      if (diagnostico.falhas.length > 0) {
        console.log('📋 Erros no download podem indicar:');
        console.log('   1. Arquivo não existe no Object Storage');
        console.log('   2. Storage Key incorreta no banco de dados');
        console.log('   3. Problemas de conectividade');
        console.log('   4. Timeout na API do Object Storage\n');
      }
      
      console.log('🔧 RECOMENDAÇÕES:');
      console.log('   1. Execute: node scripts/list-object-storage-files.js');
      console.log('   2. Verifique se os arquivos existem com as chaves corretas');
      console.log('   3. Se necessário, re-faça o upload dos documentos');
      console.log('   4. Verifique os logs do servidor durante o upload original');
    } else {
      console.log('\n🎉 RESULTADO: Todos os arquivos estão íntegros!');
    }

    console.log('\n✅ Verificação concluída!');

  } catch (error) {
    console.error('❌ Erro durante verificação:', error);
  } finally {
    await pool.end();
  }
}

// Aceitar order_id como argumento
const orderId = process.argv[2] || 'CCM0809250025';
checkOrderFilesSize(orderId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
