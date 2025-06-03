
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function importDatabaseConfig() {
  console.log('🔧 Importador de Configurações de Banco de Dados\n');
  
  try {
    // Opções de importação
    console.log('Escolha uma opção:');
    console.log('1. Inserir URL de conexão manualmente');
    console.log('2. Importar de arquivo .env de outro projeto');
    console.log('3. Configurar com dados individuais (host, port, user, etc.)');
    
    const option = await question('\nOpção (1-3): ');
    
    let newDatabaseUrl = '';
    
    switch(option) {
      case '1':
        newDatabaseUrl = await question('\nDigite a URL completa do banco de dados:\n');
        break;
        
      case '2':
        const envPath = await question('\nDigite o caminho para o arquivo .env do outro projeto:\n');
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf8');
          const match = envContent.match(/DATABASE_URL=(.+)/);
          if (match) {
            newDatabaseUrl = match[1];
            console.log(`✅ URL encontrada: ${newDatabaseUrl}`);
          } else {
            console.log('❌ DATABASE_URL não encontrada no arquivo .env');
            return;
          }
        } else {
          console.log('❌ Arquivo .env não encontrado');
          return;
        }
        break;
        
      case '3':
        console.log('\n📝 Digite os dados de conexão:');
        const host = await question('Host: ');
        const port = await question('Porta (padrão 5432): ') || '5432';
        const user = await question('Usuário: ');
        const password = await question('Senha: ');
        const database = await question('Nome do banco: ');
        const ssl = await question('Usar SSL? (s/n): ');
        
        const sslParam = ssl.toLowerCase() === 's' ? '?sslmode=require' : '';
        newDatabaseUrl = `postgresql://${user}:${password}@${host}:${port}/${database}${sslParam}`;
        break;
        
      default:
        console.log('❌ Opção inválida');
        return;
    }
    
    if (!newDatabaseUrl) {
      console.log('❌ URL de banco de dados não fornecida');
      return;
    }
    
    // Fazer backup do .env atual
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const backupPath = path.join(__dirname, '../.env.backup');
      fs.copyFileSync(envPath, backupPath);
      console.log('📦 Backup do .env criado em .env.backup');
    }
    
    // Atualizar .env
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    if (envContent.includes('DATABASE_URL=')) {
      envContent = envContent.replace(/DATABASE_URL=.+/, `DATABASE_URL=${newDatabaseUrl}`);
    } else {
      envContent += `\nDATABASE_URL=${newDatabaseUrl}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Configuração atualizada com sucesso!');
    console.log(`📍 Nova URL: ${newDatabaseUrl}`);
    
    // Verificar conexão
    const testConnection = await question('\nDeseja testar a conexão? (s/n): ');
    if (testConnection.toLowerCase() === 's') {
      console.log('\n🔍 Testando conexão...');
      
      try {
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: newDatabaseUrl });
        
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Conexão bem-sucedida!');
        console.log(`⏰ Hora do servidor: ${result.rows[0].now}`);
        
        await pool.end();
      } catch (error) {
        console.log('❌ Erro na conexão:');
        console.log(error.message);
      }
    }
    
    // Executar migrações
    const runMigrations = await question('\nDeseja executar as migrações do Drizzle? (s/n): ');
    if (runMigrations.toLowerCase() === 's') {
      console.log('\n🔄 Executando migrações...');
      const { spawn } = require('child_process');
      
      const migration = spawn('npx', ['drizzle-kit', 'push'], { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      migration.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Migrações executadas com sucesso!');
        } else {
          console.log('❌ Erro ao executar migrações');
        }
        process.exit(code);
      });
      
      return;
    }
    
  } catch (error) {
    console.log('❌ Erro:', error.message);
  } finally {
    rl.close();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  importDatabaseConfig();
}

module.exports = { importDatabaseConfig };
