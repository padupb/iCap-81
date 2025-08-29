
const { Pool } = require('pg');

async function fixMissingColumn() {
  console.log('🔧 Adicionando coluna can_create_purchase_order na tabela users...\n');

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
    // 1. Verificar se a coluna já existe
    const columnExists = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'can_create_purchase_order'
    `);

    if (columnExists.rows.length > 0) {
      console.log('✅ Coluna can_create_purchase_order já existe');
    } else {
      // 2. Adicionar a coluna
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN can_create_purchase_order BOOLEAN DEFAULT false
      `);
      console.log('✅ Coluna can_create_purchase_order adicionada com sucesso');
    }

    // 3. Definir a permissão como true para o KeyUser (ID = 1)
    await pool.query(`
      UPDATE users 
      SET can_create_purchase_order = true 
      WHERE id = 1
    `);
    console.log('✅ Permissão can_create_purchase_order definida como true para o KeyUser (ID = 1)');

    // 4. Verificação final
    const finalCheck = await pool.query(`
      SELECT id, name, email, can_create_order, can_confirm_delivery, can_create_purchase_order
      FROM users 
      WHERE id = 1
    `);
    
    if (finalCheck.rows.length > 0) {
      const user = finalCheck.rows[0];
      console.log('\n📋 Configuração do KeyUser:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Nome: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Can Create Order: ${user.can_create_order}`);
      console.log(`   Can Confirm Delivery: ${user.can_confirm_delivery}`);
      console.log(`   Can Create Purchase Order: ${user.can_create_purchase_order}`);
    }

    console.log('\n✅ Script executado com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao adicionar coluna:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  fixMissingColumn()
    .then(() => {
      console.log('\n🎉 Script concluído!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erro no script:', error);
      process.exit(1);
    });
}

module.exports = { fixMissingColumn };
