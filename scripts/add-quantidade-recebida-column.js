
const { Pool } = require('@neondatabase/serverless');

async function addQuantidadeRecebidaColumn() {
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL não configurado. Este script só funciona em produção.');
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🔧 Verificando coluna quantidade_recebida na tabela orders...');

    // Verificar se a coluna já existe
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'quantidade_recebida'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Coluna quantidade_recebida já existe');
    } else {
      console.log('➕ Adicionando coluna quantidade_recebida...');
      
      await pool.query(`
        ALTER TABLE orders 
        ADD COLUMN quantidade_recebida DECIMAL(10,2)
      `);

      console.log('✅ Coluna quantidade_recebida adicionada com sucesso');
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Erro:', error);
    await pool.end();
    process.exit(1);
  }
}

addQuantidadeRecebidaColumn()
  .then(() => {
    console.log('✅ Script concluído');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
