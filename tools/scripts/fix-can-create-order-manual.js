
const { Pool } = require('@neondatabase/serverless');

async function fixCanCreateOrderManual() {
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL não configurado. Este script só funciona em produção.');
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🔧 Corrigindo coluna can_create_order manualmente...');

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

    // Verificar estrutura final da tabela users
    const finalStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Estrutura final da tabela users:');
    finalStructure.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });

    // Configurar permissão para o usuário ID=1 (KeyUser)
    await pool.query(`
      UPDATE users 
      SET can_create_order = true 
      WHERE id = 1
    `);

    console.log('✅ Permissão can_create_order definida como true para o KeyUser (ID = 1)');

    // Verificação final do usuário KeyUser
    const keyUserCheck = await pool.query(`
      SELECT id, name, email, can_create_order, can_confirm_delivery, primeiro_login
      FROM users 
      WHERE id = 1
    `);

    if (keyUserCheck.rows.length > 0) {
      const user = keyUserCheck.rows[0];
      console.log('\n📊 Configuração final do KeyUser:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Nome: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Can Create Order: ${user.can_create_order}`);
      console.log(`   Can Confirm Delivery: ${user.can_confirm_delivery}`);
      console.log(`   Primeiro Login: ${user.primeiro_login}`);
    }

  } catch (error) {
    console.error('❌ Erro ao corrigir coluna can_create_order:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  fixCanCreateOrderManual()
    .then(() => {
      console.log('\n🎉 Script de correção executado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erro na execução do script:', error);
      process.exit(1);
    });
}

module.exports = { fixCanCreateOrderManual };
