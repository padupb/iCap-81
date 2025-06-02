
const { Pool } = require('@neondatabase/serverless');

async function addCanCreateOrderColumn() {
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL não configurado. Este script só funciona em produção.');
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🔧 Adicionando coluna can_create_order na tabela users...');

    // Verificar se a coluna já existe
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'can_create_order'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Coluna can_create_order já existe na tabela users');
      return;
    }

    // Adicionar a nova coluna
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN can_create_order BOOLEAN DEFAULT false
    `);

    console.log('✅ Coluna can_create_order adicionada com sucesso à tabela users');

    // Opcional: Definir a permissão como true para o KeyUser (ID = 1)
    await pool.query(`
      UPDATE users 
      SET can_create_order = true 
      WHERE id = 1
    `);

    console.log('✅ Permissão can_create_order definida como true para o KeyUser (ID = 1)');

  } catch (error) {
    console.error('❌ Erro ao adicionar coluna can_create_order:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  addCanCreateOrderColumn()
    .then(() => {
      console.log('🎉 Script executado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro na execução do script:', error);
      process.exit(1);
    });
}

module.exports = { addCanCreateOrderColumn };
