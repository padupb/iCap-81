
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function migrateOCPdfsToStorage() {
  console.log('🔄 MIGRANDO PDFs DAS ORDENS DE COMPRA PARA OBJECT STORAGE (Pasta OC)\n');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não configurada nos Secrets!');
    return;
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  // Configurar Object Storage
  let objectStorage = null;
  try {
    const { Client } = require('@replit/object-storage');
    objectStorage = new Client();
    console.log("✅ Object Storage do Replit configurado e inicializado");
  } catch (error) {
    console.error("❌ Object Storage não disponível:", error.message);
    console.log("📦 Certifique-se de que @replit/object-storage está instalado");
    return;
  }

  try {
    // 1. Buscar todas as ordens de compra do banco
    const ordensResult = await pool.query(`
      SELECT id, numero_ordem, pdf_info 
      FROM ordens_compra 
      ORDER BY data_criacao DESC
    `);

    console.log(`📋 Encontradas ${ordensResult.rows.length} ordens de compra para verificar\n`);

    let totalMigradas = 0;
    let totalErros = 0;

    for (const ordem of ordensResult.rows) {
      const numeroOrdem = ordem.numero_ordem;
      console.log(`🔄 Processando ordem: ${numeroOrdem}`);
      
      // 2. Verificar se já tem PDF no Object Storage
      if (ordem.pdf_info) {
        try {
          const pdfInfo = typeof ordem.pdf_info === 'string' 
            ? JSON.parse(ordem.pdf_info) 
            : ordem.pdf_info;

          if (pdfInfo.storageKey && pdfInfo.storageKey.startsWith('OC/')) {
            console.log(`  ✅ PDF já está na pasta OC: ${pdfInfo.storageKey}`);
            continue;
          }
        } catch (error) {
          console.log(`  ⚠️ Erro ao processar pdf_info: ${error.message}`);
        }
      }

      // 3. Procurar arquivo PDF local
      const uploadsPath = path.join(process.cwd(), "uploads", `${numeroOrdem}.pdf`);
      
      if (!fs.existsSync(uploadsPath)) {
        console.log(`  ❌ PDF não encontrado localmente: ${uploadsPath}`);
        totalErros++;
        continue;
      }

      try {
        // 4. Ler o arquivo PDF
        const pdfBuffer = fs.readFileSync(uploadsPath);
        console.log(`  📄 PDF encontrado (${pdfBuffer.length} bytes)`);

        // 5. Fazer upload para pasta OC no Object Storage
        const storageKey = `OC/${numeroOrdem}.pdf`;
        
        // Usar o método correto do Replit Object Storage
        const uint8Array = new Uint8Array(pdfBuffer);
        await objectStorage.uploadFromBytes(storageKey, uint8Array);
        
        console.log(`  📤 Upload realizado: ${storageKey}`);

        // 6. Verificar se o arquivo foi salvo
        try {
          const downloadTest = await objectStorage.downloadAsBytes(storageKey);
          if (downloadTest && downloadTest.length > 0) {
            console.log(`  ✅ Arquivo verificado no Object Storage (${downloadTest.length} bytes)`);
          } else {
            throw new Error("Arquivo não encontrado após upload");
          }
        } catch (verifyError) {
          console.log(`  ⚠️ Upload realizado mas verificação falhou: ${verifyError.message}`);
        }

        // 7. Atualizar pdf_info no banco de dados
        const pdfInfo = {
          name: `${numeroOrdem}.pdf`,
          filename: `${numeroOrdem}.pdf`,
          size: pdfBuffer.length,
          path: uploadsPath,
          storageKey: storageKey,
          date: new Date().toISOString()
        };

        await pool.query(
          `UPDATE ordens_compra SET pdf_info = $1 WHERE id = $2`,
          [JSON.stringify(pdfInfo), ordem.id]
        );

        console.log(`  💾 Banco de dados atualizado`);
        totalMigradas++;

      } catch (error) {
        console.error(`  ❌ Erro ao migrar ${numeroOrdem}:`, error.message);
        totalErros++;
      }

      console.log(''); // Linha em branco para separar
    }

    console.log('🎉 Migração concluída!');
    console.log(`📊 Estatísticas:`);
    console.log(`  • Total de ordens processadas: ${ordensResult.rows.length}`);
    console.log(`  • PDFs migrados com sucesso: ${totalMigradas}`);
    console.log(`  • Erros encontrados: ${totalErros}`);

    // 8. Listar arquivos na pasta OC para confirmação
    try {
      console.log('\n📁 Verificando pasta OC no Object Storage...');
      const objects = await objectStorage.list();
      const ocFiles = objects.filter(obj => obj.key.startsWith('OC/'));
      
      console.log(`📋 Encontrados ${ocFiles.length} arquivos na pasta OC:`);
      ocFiles.forEach(file => {
        console.log(`  • ${file.key} (${(file.size / 1024).toFixed(2)} KB)`);
      });
      
    } catch (listError) {
      console.log(`⚠️ Erro ao listar arquivos da pasta OC: ${listError.message}`);
    }
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    await pool.end();
  }
}

// Executar migração
if (require.main === module) {
  migrateOCPdfsToStorage()
    .then(() => {
      console.log('\n✅ Script concluído');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erro no script:', error);
      process.exit(1);
    });
}

module.exports = { migrateOCPdfsToStorage };
