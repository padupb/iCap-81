
const { Pool } = require('@neondatabase/serverless');

async function addDeliveredQuantityColumn() {
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL não configurado. Este script só funciona em produção.');
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🔧 Verificando e adicionando coluna delivered_quantity na tabela orders...');

    // Verificar se a coluna já existe
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivered_quantity'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Coluna delivered_quantity já existe na tabela orders');
    } else {
      console.log('➕ Adicionando coluna delivered_quantity na tabela orders...');
      
      // Adicionar a nova coluna
      await pool.query(`
        ALTER TABLE orders 
        ADD COLUMN delivered_quantity DECIMAL(10,2)
      `);

      console.log('✅ Coluna delivered_quantity adicionada com sucesso à tabela orders');
    }

    // Verificar estrutura final
    const finalCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name IN ('delivered_quantity', 'quantity')
      ORDER BY column_name
    `);

    console.log('\n📋 Estrutura das colunas de quantidade:');
    finalCheck.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}`);
    });

  } catch (error) {
    console.error('❌ Erro ao adicionar coluna delivered_quantity:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  addDeliveredQuantityColumn()
    .then(() => {
      console.log('\n🎉 Script executado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erro na execução do script:', error);
      process.exit(1);
    });
}

module.exports = { addDeliveredQuantityColumn };
