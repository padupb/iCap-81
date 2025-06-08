
const { Pool } = require('pg');

// Configurar conexão com o banco usando as variáveis de ambiente
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createIcapMobTable() {
  try {
    console.log('🔧 Criando tabela icapmob...');
    
    // Criar tabela icapmob
    await pool.query(`
      CREATE TABLE IF NOT EXISTS icapmob (
        id SERIAL PRIMARY KEY,
        versao VARCHAR(20) NOT NULL,
        data DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabela icapmob criada com sucesso');
    
    // Inserir registro inicial se não existir
    const existingRecord = await pool.query('SELECT COUNT(*) FROM icapmob');
    if (parseInt(existingRecord.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO icapmob (versao, data)
        VALUES ('1.0.0', CURRENT_DATE);
      `);
      console.log('✅ Registro inicial inserido');
    }
    
    console.log('🎉 Configuração do iCapMob concluída!');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

createIcapMobTable();
