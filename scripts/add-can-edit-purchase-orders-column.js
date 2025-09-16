
const { Pool } = require('pg');

async function addCanEditPurchaseOrdersColumn() {
  console.log('🔧 Adicionando coluna can_edit_purchase_orders na tabela company_categories...');
  
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
      WHERE table_name = 'company_categories' 
      AND column_name = 'can_edit_purchase_orders'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Coluna can_edit_purchase_orders já existe na tabela company_categories');
      return;
    }

    // Adicionar a coluna
    await pool.query(`
      ALTER TABLE company_categories 
      ADD COLUMN can_edit_purchase_orders BOOLEAN DEFAULT FALSE
    `);

    console.log('✅ Coluna can_edit_purchase_orders adicionada com sucesso');

    // Verificar estrutura da tabela
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'company_categories' 
      ORDER BY ordinal_position
    `);

    console.log('\n📊 Estrutura atual da tabela company_categories:');
    tableStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (default: ${row.column_default || 'null'})`);
    });

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

addCanEditPurchaseOrdersColumn();
