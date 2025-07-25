
const readline = require('readline');
const { pool } = require('../server/db.js');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(text) {
  return new Promise((resolve) => {
    rl.question(text, resolve);
  });
}

async function setupGoogleDrive() {
  console.log('🔧 Configuração do Google Drive para i-CAP 5.0\n');
  
  console.log('📋 Antes de continuar, você precisa:');
  console.log('1. Criar um projeto no Google Cloud Console');
  console.log('2. Ativar a Google Drive API');
  console.log('3. Criar uma Service Account');
  console.log('4. Baixar o arquivo JSON das credenciais\n');
  
  const continuar = await question('Deseja continuar? (s/n): ');
  if (continuar.toLowerCase() !== 's') {
    console.log('Configuração cancelada.');
    process.exit(0);
  }
  
  try {
    console.log('\n📝 Configurando credenciais...\n');
    
    const clientEmail = await question('Email da Service Account: ');
    const privateKey = await question('Chave privada (cole toda a chave incluindo -----BEGIN PRIVATE KEY-----): ');
    const projectId = await question('ID do projeto Google Cloud: ');
    
    if (!clientEmail || !privateKey || !projectId) {
      console.log('❌ Todos os campos são obrigatórios');
      process.exit(1);
    }
    
    // Salvar configurações no banco
    await pool.query(`
      INSERT INTO settings (key, value, description) 
      VALUES ($1, $2, $3)
      ON CONFLICT (key) DO UPDATE SET value = $2
    `, ['google_drive_client_email', clientEmail, 'Email da Service Account do Google Drive']);
    
    await pool.query(`
      INSERT INTO settings (key, value, description) 
      VALUES ($1, $2, $3)
      ON CONFLICT (key) DO UPDATE SET value = $2
    `, ['google_drive_private_key', privateKey, 'Chave privada da Service Account do Google Drive']);
    
    await pool.query(`
      INSERT INTO settings (key, value, description) 
      VALUES ($1, $2, $3)
      ON CONFLICT (key) DO UPDATE SET value = $2
    `, ['google_drive_project_id', projectId, 'ID do projeto Google Cloud']);
    
    console.log('\n✅ Configurações salvas com sucesso!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Reinicie o servidor i-CAP');
    console.log('2. Faça upload de um documento para testar');
    console.log('3. Os arquivos serão salvos no Google Drive e links públicos serão gerados');
    console.log('\n🔗 Os documentos ficarão em: Google Drive > i-CAP Documentos > [Número do Pedido]');
    
  } catch (error) {
    console.error('❌ Erro ao configurar Google Drive:', error);
  } finally {
    await pool.end();
    rl.close();
  }
}

setupGoogleDrive();
