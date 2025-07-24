
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function fixMissingUploadDirectories() {
  console.log('🔨 Iniciando correção de diretórios de upload ausentes...');

  // Configuração do banco de dados
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Buscar todos os pedidos que têm documentos carregados
    const result = await pool.query(`
      SELECT id, order_id, documentoscarregados, documentosinfo, status
      FROM orders 
      WHERE documentoscarregados = true OR documentosinfo IS NOT NULL
      ORDER BY order_id
    `);

    console.log(`📊 Encontrados ${result.rows.length} pedidos com documentos`);

    const uploadBaseDir = path.join(process.cwd(), 'uploads');
    
    // Garantir que o diretório base existe
    if (!fs.existsSync(uploadBaseDir)) {
      fs.mkdirSync(uploadBaseDir, { recursive: true });
      console.log(`📂 Diretório base criado: ${uploadBaseDir}`);
    }

    for (const order of result.rows) {
      const orderDir = path.join(uploadBaseDir, order.order_id);
      
      console.log(`\n📋 Verificando pedido ${order.order_id} (ID: ${order.id})`);
      console.log(`📂 Diretório esperado: ${orderDir}`);
      console.log(`📂 Existe: ${fs.existsSync(orderDir)}`);
      console.log(`📋 Status: ${order.status}`);
      
      if (!fs.existsSync(orderDir)) {
        console.log(`🔨 Criando diretório ausente: ${orderDir}`);
        try {
          fs.mkdirSync(orderDir, { recursive: true });
          
          if (fs.existsSync(orderDir)) {
            console.log(`✅ Diretório criado com sucesso`);
          } else {
            console.log(`❌ Falha ao criar diretório`);
          }
        } catch (error) {
          console.error(`❌ Erro ao criar diretório: ${error.message}`);
        }
      } else {
        // Verificar conteúdo do diretório
        try {
          const files = fs.readdirSync(orderDir);
          console.log(`📁 Arquivos no diretório (${files.length}): ${files.join(', ')}`);
        } catch (error) {
          console.error(`❌ Erro ao ler diretório: ${error.message}`);
        }
      }
    }

    // Verificar diretórios órfãos
    console.log(`\n🔍 Verificando diretórios órfãos...`);
    const existingDirs = fs.readdirSync(uploadBaseDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    const validOrderIds = result.rows.map(row => row.order_id);

    for (const dirName of existingDirs) {
      if (!validOrderIds.includes(dirName)) {
        console.log(`🗑️ Diretório órfão encontrado: ${dirName}`);
        const orphanDir = path.join(uploadBaseDir, dirName);
        const files = fs.readdirSync(orphanDir);
        console.log(`📁 Arquivos: ${files.join(', ')}`);
      }
    }

    console.log(`\n✅ Correção concluída!`);

  } catch (error) {
    console.error('❌ Erro durante a correção:', error);
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  fixMissingUploadDirectories().catch(console.error);
}

module.exports = { fixMissingUploadDirectories };
