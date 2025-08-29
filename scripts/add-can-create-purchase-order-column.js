
const { Pool } = require('pg');

async function addCanCreatePurchaseOrderColumn() {
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
      console.log('⚠️ Coluna can_create_purchase_order já existe');
    } else {
      // 2. Adicionar a coluna
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN can_create_purchase_order BOOLEAN DEFAULT false
      `);
      console.log('✅ Coluna can_create_purchase_order adicionada com sucesso');
    }

    // 3. Definir a permissão como true para o KeyUser (ID = 1)
    const userCheck = await pool.query(`
      SELECT id, name, email 
      FROM users 
      WHERE id = 1
    `);

    if (userCheck.rows.length > 0) {
      const user = userCheck.rows[0];
      console.log(`👤 Usuário ID=1 encontrado: ${user.name} (${user.email})`);
      
      await pool.query(`
        UPDATE users 
        SET can_create_purchase_order = true 
        WHERE id = 1
      `);

      console.log('✅ Permissão can_create_purchase_order definida como true para o KeyUser (ID = 1)');
    } else {
      console.log('⚠️ Usuário ID=1 não encontrado na tabela');
    }

    // 4. Verificação final das permissões do KeyUser
    const finalCheck = await pool.query(`
      SELECT id, name, email, can_create_order, can_confirm_delivery, can_create_purchase_order
      FROM users 
      WHERE id = 1
    `);
    
    if (finalCheck.rows.length > 0) {
      const updatedUser = finalCheck.rows[0];
      console.log('\n📋 Configuração final do KeyUser:');
      console.log(`   ID: ${updatedUser.id}`);
      console.log(`   Nome: ${updatedUser.name}`);
      console.log(`   Email: ${updatedUser.email}`);
      console.log(`   Can Create Order: ${updatedUser.can_create_order}`);
      console.log(`   Can Confirm Delivery: ${updatedUser.can_confirm_delivery}`);
      console.log(`   Can Create Purchase Order: ${updatedUser.can_create_purchase_order}`);
    }

    // 5. Listar todos os usuários e suas permissões para debug
    console.log('\n👥 Resumo de todas as permissões de usuários:');
    const allUsers = await pool.query(`
      SELECT id, name, email, can_create_order, can_confirm_delivery, can_create_purchase_order
      FROM users 
      ORDER BY id
    `);

    for (const user of allUsers.rows) {
      console.log(`   User ${user.id}: ${user.name}`);
      console.log(`     • Create Order: ${user.can_create_order}`);
      console.log(`     • Confirm Delivery: ${user.can_confirm_delivery}`);
      console.log(`     • Create Purchase Order: ${user.can_create_purchase_order}`);
    }

  } catch (error) {
    console.error('❌ Erro ao adicionar coluna:', error);
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  addCanCreatePurchaseOrderColumn()
    .then(() => {
      console.log('\n🎉 Script concluído!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro no script:', error);
      process.exit(1);
    });
}

module.exports = { addCanCreatePurchaseOrderColumn };
