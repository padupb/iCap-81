
const { Pool } = require('pg');

async function addPdfInfoColumn() {
  console.log('🔧 ADICIONANDO COLUNA pdf_info NA TABELA ordens_compra\n');
  
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

  try {
    // Verificar se a coluna já existe
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ordens_compra' 
      AND column_name = 'pdf_info'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Coluna pdf_info já existe na tabela ordens_compra');
      return;
    }

    // Adicionar a coluna pdf_info
    await pool.query(`
      ALTER TABLE ordens_compra 
      ADD COLUMN pdf_info JSONB
    `);

    console.log('✅ Coluna pdf_info adicionada com sucesso à tabela ordens_compra');

    // Verificar estrutura da tabela
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'ordens_compra' 
      ORDER BY ordinal_position
    `);

    console.log('\n📊 Estrutura atual da tabela ordens_compra:');
    tableStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

  } catch (error) {
    console.error('❌ Erro ao adicionar coluna pdf_info:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  addPdfInfoColumn()
    .then(() => {
      console.log('\n🎉 Script concluído!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erro na execução do script:', error);
      process.exit(1);
    });
}

module.exports = { addPdfInfoColumn };
