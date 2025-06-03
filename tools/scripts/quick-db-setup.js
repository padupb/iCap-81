
#!/usr/bin/env node

// Script rápido para configurar banco de dados
// Uso: node scripts/quick-db-setup.js "postgresql://user:pass@host:port/db"

const fs = require('fs');
const path = require('path');

function updateDatabaseUrl(newUrl) {
  const envPath = path.join(__dirname, '../.env');
  
  // Fazer backup
  if (fs.existsSync(envPath)) {
    const backupPath = path.join(__dirname, '../.env.backup');
    fs.copyFileSync(envPath, backupPath);
    console.log('📦 Backup criado: .env.backup');
  }
  
  // Ler conteúdo atual
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Atualizar ou adicionar DATABASE_URL
  if (envContent.includes('DATABASE_URL=')) {
    envContent = envContent.replace(/DATABASE_URL=.+/, `DATABASE_URL=${newUrl}`);
  } else {
    envContent += `\nDATABASE_URL=${newUrl}\n`;
  }
  
  // Salvar
  fs.writeFileSync(envPath, envContent);
  
  console.log('✅ DATABASE_URL atualizada!');
  console.log(`📍 Nova URL: ${newUrl}`);
  
  return true;
}

// Verificar argumentos da linha de comando
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('💡 Uso:');
  console.log('node scripts/quick-db-setup.js "sua_url_completa_aqui"');
  console.log('\nExemplo:');
  console.log('node scripts/quick-db-setup.js "postgresql://user:pass@host:5432/db?sslmode=require"');
  process.exit(1);
}

const newUrl = args[0];
updateDatabaseUrl(newUrl);

console.log('\n🔄 Próximos passos:');
console.log('1. Execute: npx drizzle-kit push');
console.log('2. Reinicie a aplicação');
