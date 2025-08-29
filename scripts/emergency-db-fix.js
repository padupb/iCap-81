
const { Pool } = require('pg');

async function emergencyDbFix() {
  console.log('🚨 SCRIPT DE EMERGÊNCIA - CORRIGINDO BANCO DE DADOS\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não configurada nos Secrets!');
    console.log('\n🔧 Para configurar:');
    console.log('1. Clique no ícone de "Secrets" no painel lateral');
    console.log('2. Adicione uma nova secret com key "DATABASE_URL"');
    console.log('3. Cole a URL do seu banco PostgreSQL');
    return;
  }

  console.log('🔗 Conectando ao banco de dados...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // 1. Testar conexão
    await pool.query('SELECT NOW()');
    console.log('✅ Conexão com banco de dados estabelecida\n');

    // 2. Verificar e corrigir estrutura da tabela users
    console.log('🔍 Verificando estrutura da tabela users...');
    
    const userTableExists = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'users' AND table_schema = 'public'
    `);

    if (userTableExists.rows.length === 0) {
      console.log('❌ Tabela users não existe! Criando...');
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          phone TEXT,
          password TEXT NOT NULL,
          "companyId" INTEGER,
          "roleId" INTEGER,
          "canConfirmDelivery" BOOLEAN DEFAULT false,
          "canCreateOrder" BOOLEAN DEFAULT false,
          "canCreatePurchaseOrder" BOOLEAN DEFAULT false,
          "primeiroLogin" BOOLEAN DEFAULT true,
          "createdAt" TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ Tabela users criada');
    } else {
      console.log('✅ Tabela users existe');
    }

    // 3. Verificar e adicionar colunas que podem estar faltando
    const columns = [
      { name: 'can_create_purchase_order', type: 'BOOLEAN', default: 'false' },
      { name: 'can_create_order', type: 'BOOLEAN', default: 'false' },
      { name: 'can_confirm_delivery', type: 'BOOLEAN', default: 'false' },
      { name: 'primeiro_login', type: 'BOOLEAN', default: 'true' }
    ];

    for (const column of columns) {
      const columnExists = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = $1
      `, [column.name]);

      if (columnExists.rows.length === 0) {
        console.log(`📝 Adicionando coluna ${column.name}...`);
        await pool.query(`
          ALTER TABLE users 
          ADD COLUMN ${column.name} ${column.type} DEFAULT ${column.default}
        `);
        console.log(`✅ Coluna ${column.name} adicionada`);
      } else {
        console.log(`✅ Coluna ${column.name} já existe`);
      }
    }

    // 4. Verificar se existe keyuser configurado
    console.log('\n🔍 Verificando configuração do KeyUser...');
    
    const settingsTableExists = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'settings' AND table_schema = 'public'
    `);

    if (settingsTableExists.rows.length === 0) {
      console.log('📝 Criando tabela settings...');
      await pool.query(`
        CREATE TABLE settings (
          id SERIAL PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL,
          description TEXT
        )
      `);
      console.log('✅ Tabela settings criada');
    }

    // 5. Configurar KeyUser padrão
    const keyUserEmail = 'padupb@admin.icap';
    const keyUserPassword = '170824';

    await pool.query(`
      INSERT INTO settings (key, value, description) 
      VALUES ('keyuser_email', $1, 'Email do super administrador')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `, [keyUserEmail]);

    await pool.query(`
      INSERT INTO settings (key, value, description) 
      VALUES ('keyuser_password', $2, 'Senha do super administrador')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `, [keyUserPassword]);

    console.log('✅ Configurações do KeyUser salvas');

    // 6. Verificar se existe um usuário com ID 1 e configurar permissões
    const userExists = await pool.query('SELECT * FROM users WHERE id = 1');
    
    if (userExists.rows.length > 0) {
      await pool.query(`
        UPDATE users 
        SET 
          can_create_order = true,
          can_confirm_delivery = true,
          can_create_purchase_order = true,
          primeiro_login = false
        WHERE id = 1
      `);
      console.log('✅ Permissões do usuário ID=1 configuradas');
    } else {
      console.log('⚠️ Usuário ID=1 não encontrado');
    }

    // 7. Mostrar resumo final
    console.log('\n📋 RESUMO DA CONFIGURAÇÃO:');
    console.log(`📧 KeyUser Email: ${keyUserEmail}`);
    console.log(`🔑 KeyUser Password: ${keyUserPassword}`);
    
    const allUsers = await pool.query(`
      SELECT id, name, email, can_create_order, can_confirm_delivery, can_create_purchase_order, primeiro_login
      FROM users 
      ORDER BY id
    `);
    
    if (allUsers.rows.length > 0) {
      console.log('\n👥 Usuários configurados:');
      allUsers.rows.forEach(user => {
        console.log(`   • ID ${user.id}: ${user.name} (${user.email})`);
        console.log(`     - Criar Pedidos: ${user.can_create_order}`);
        console.log(`     - Confirmar Entregas: ${user.can_confirm_delivery}`);
        console.log(`     - Criar Ordens de Compra: ${user.can_create_purchase_order}`);
        console.log(`     - Primeiro Login: ${user.primeiro_login}`);
      });
    } else {
      console.log('⚠️ Nenhum usuário encontrado na base de dados');
    }

    console.log('\n🎉 Correção de emergência concluída!');
    console.log('\n📌 Próximos passos:');
    console.log('1. Reinicie o servidor (Ctrl+C e npm run dev)');
    console.log('2. Acesse http://localhost:5000 no navegador');
    console.log('3. Faça login com: padupb@admin.icap / 170824');

  } catch (error) {
    console.error('❌ Erro crítico:', error);
    console.error('Stack trace:', error.stack);
    
    if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.log('\n💡 SOLUÇÃO SUGERIDA:');
      console.log('1. Acesse o painel "Database" no Replit');
      console.log('2. Clique em "Create a database"');
      console.log('3. Configure a DATABASE_URL nos Secrets');
      console.log('4. Execute este script novamente');
    }
    
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  emergencyDbFix()
    .then(() => {
      console.log('\n🚀 Sistema pronto para uso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Falha na correção de emergência:', error.message);
      process.exit(1);
    });
}

module.exports = { emergencyDbFix };
