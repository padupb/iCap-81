
const { Pool } = require('pg');

async function addCanEditPurchaseOrdersUserColumn() {
  console.log('🔧 Adicionando coluna can_edit_purchase_orders na tabela users...');
  
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
      WHERE table_name = 'users' 
      AND column_name = 'can_edit_purchase_orders'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Coluna can_edit_purchase_orders já existe na tabela users');
      return;
    }

    // Adicionar a coluna
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN can_edit_purchase_orders BOOLEAN DEFAULT FALSE
    `);

    console.log('✅ Coluna can_edit_purchase_orders adicionada com sucesso');

    // Definir como true para o keyuser (ID = 1)
    await pool.query(`
      UPDATE users 
      SET can_edit_purchase_orders = TRUE 
      WHERE id = 1
    `);

    console.log('✅ Keyuser configurado para poder editar ordens de compra');

    // Verificar estrutura da tabela
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name LIKE '%purchase%'
      ORDER BY ordinal_position
    `);

    console.log('\n📊 Colunas relacionadas a ordens de compra na tabela users:');
    tableStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (default: ${row.column_default || 'null'})`);
    });

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

addCanEditPurchaseOrdersUserColumn();
