
const { Pool } = require('@neondatabase/serverless');

async function addCanCreateOrderColumn() {
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL não configurado. Este script só funciona em produção.');
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🔧 Verificando e adicionando coluna can_create_order na tabela users...');

    // Verificar se a coluna já existe
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'can_create_order'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Coluna can_create_order já existe na tabela users');
    } else {
      console.log('➕ Adicionando coluna can_create_order na tabela users...');
      
      // Adicionar a nova coluna
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN can_create_order BOOLEAN DEFAULT false
      `);

      console.log('✅ Coluna can_create_order adicionada com sucesso à tabela users');
    }

    // Verificar se o usuário ID=1 existe e configurar suas permissões
    const userCheck = await pool.query(`
      SELECT id, name, email, can_create_order 
      FROM users 
      WHERE id = 1
    `);

    if (userCheck.rows.length > 0) {
      const user = userCheck.rows[0];
      console.log(`👤 Usuário ID=1 encontrado: ${user.name} (${user.email})`);
      
      // Definir a permissão como true para o KeyUser (ID = 1)
      await pool.query(`
        UPDATE users 
        SET can_create_order = true 
        WHERE id = 1
      `);

      console.log('✅ Permissão can_create_order definida como true para o KeyUser (ID = 1)');
      
      // Verificação final
      const finalCheck = await pool.query(`
        SELECT id, name, email, can_create_order, can_confirm_delivery 
        FROM users 
        WHERE id = 1
      `);
      
      const updatedUser = finalCheck.rows[0];
      console.log('\n📋 Configuração final do KeyUser:');
      console.log(`   ID: ${updatedUser.id}`);
      console.log(`   Nome: ${updatedUser.name}`);
      console.log(`   Email: ${updatedUser.email}`);
      console.log(`   Can Create Order: ${updatedUser.can_create_order}`);
      console.log(`   Can Confirm Delivery: ${updatedUser.can_confirm_delivery}`);
    } else {
      console.log('⚠️ Usuário ID=1 não encontrado na tabela');
    }

    // Listar todos os usuários e suas permissões para debug
    const allUsers = await pool.query(`
      SELECT id, name, email, can_create_order, can_confirm_delivery 
      FROM users 
      ORDER BY id
    `);

    console.log('\n📊 Todos os usuários e suas permissões:');
    allUsers.rows.forEach(user => {
      console.log(`   ID ${user.id}: ${user.name} - Create: ${user.can_create_order}, Delivery: ${user.can_confirm_delivery}`);
    });

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
      console.log('\n🎉 Script executado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erro na execução do script:', error);
      process.exit(1);
    });
}

module.exports = { addCanCreateOrderColumn };
