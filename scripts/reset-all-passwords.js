const { Pool } = require('pg');

async function resetAllPasswords() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔄 Resetando todas as senhas do banco de dados...\n');

    // Verificar se a tabela users existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.error('❌ Tabela users não existe!');
      return;
    }

    // Buscar todos os usuários
    const usersResult = await pool.query('SELECT id, name, email FROM users ORDER BY id');

    if (usersResult.rows.length === 0) {
      console.log('⚠️ Nenhum usuário encontrado na tabela');
      return;
    }

    console.log(`📋 Encontrados ${usersResult.rows.length} usuários:\n`);
    usersResult.rows.forEach(user => {
      console.log(`   ID: ${user.id} | ${user.name} | ${user.email}`);
    });

    console.log('\n🔑 Resetando senhas...\n');

    // Importar bcrypt dinamicamente
    const bcrypt = await import('bcrypt');

    // Hash da senha padrão
    const hashedPassword = await bcrypt.hash('icap123', 10);

    // Atualizar todas as senhas
    const updateResult = await pool.query(`
      UPDATE users 
      SET password = $1, primeiro_login = true
      WHERE id IS NOT NULL
    `, [hashedPassword]);

    console.log(`✅ ${updateResult.rowCount} senhas foram resetadas para: icap123`);
    console.log('✅ Todos os usuários foram marcados como primeiro_login = true');

    // Verificar se existe o usuário keyuser configurado
    const keyuserEmail = 'padupb@admin.icap';
    const keyuserExists = await pool.query('SELECT id, email FROM users WHERE email = $1', [keyuserEmail]);

    if (keyuserExists.rows.length === 0) {
      console.log(`\n⚠️ Usuário keyuser (${keyuserEmail}) não existe na tabela users`);
      console.log('🔧 Criando usuário keyuser...');

      // Criar o usuário keyuser
      const newKeyuser = await pool.query(`
        INSERT INTO users (name, email, password, primeiro_login, company_id, role_id) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING id, name, email
      `, ['Super Administrador', keyuserEmail, hashedPassword, false, null, null]);

      console.log(`✅ Usuário keyuser criado:`, newKeyuser.rows[0]);
    } else {
      console.log(`\n✅ Usuário keyuser encontrado: ID ${keyuserExists.rows[0].id}`);

      // Garantir que o keyuser tem primeiro_login = false
      await pool.query(`
        UPDATE users 
        SET primeiro_login = false 
        WHERE email = $1
      `, [keyuserEmail]);

      console.log('✅ Keyuser configurado com primeiro_login = false');
    }

    // Mostrar status final
    console.log('\n📊 Status final dos usuários:');
    const finalResult = await pool.query(`
      SELECT id, name, email, primeiro_login 
      FROM users 
      ORDER BY id
    `);

    finalResult.rows.forEach(user => {
      console.log(`   ID: ${user.id} | ${user.name} | ${user.email} | Primeiro Login: ${user.primeiro_login}`);
    });

    console.log('\n🎉 Reset de senhas concluído!');
    console.log('📧 Email para login: padupb@admin.icap');
    console.log('🔑 Senha para todos os usuários: icap123');

  } catch (error) {
    console.error('❌ Erro ao resetar senhas:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

resetAllPasswords();