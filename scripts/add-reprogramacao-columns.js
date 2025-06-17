
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addReprogramacaoColumns() {
  try {
    console.log('🔧 Adicionando colunas para reprogramação de entrega...');

    // Adicionar colunas na tabela orders
    await pool.query(`
      DO $$ 
      BEGIN
        -- Adicionar coluna para nova data de entrega
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'nova_data_entrega') THEN
          ALTER TABLE orders ADD COLUMN nova_data_entrega TIMESTAMP;
          RAISE NOTICE 'Coluna nova_data_entrega adicionada';
        ELSE
          RAISE NOTICE 'Coluna nova_data_entrega já existe';
        END IF;

        -- Adicionar coluna para justificativa da reprogramação
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'justificativa_reprogramacao') THEN
          ALTER TABLE orders ADD COLUMN justificativa_reprogramacao TEXT;
          RAISE NOTICE 'Coluna justificativa_reprogramacao adicionada';
        ELSE
          RAISE NOTICE 'Coluna justificativa_reprogramacao já existe';
        END IF;

        -- Adicionar coluna para data da solicitação de reprogramação
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'data_solicitacao_reprogramacao') THEN
          ALTER TABLE orders ADD COLUMN data_solicitacao_reprogramacao TIMESTAMP;
          RAISE NOTICE 'Coluna data_solicitacao_reprogramacao adicionada';
        ELSE
          RAISE NOTICE 'Coluna data_solicitacao_reprogramacao já existe';
        END IF;

        -- Adicionar coluna para usuário que solicitou a reprogramação
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'usuario_reprogramacao') THEN
          ALTER TABLE orders ADD COLUMN usuario_reprogramacao INTEGER REFERENCES users(id);
          RAISE NOTICE 'Coluna usuario_reprogramacao adicionada';
        ELSE
          RAISE NOTICE 'Coluna usuario_reprogramacao já existe';
        END IF;
      END $$;
    `);

    console.log('✅ Colunas de reprogramação adicionadas com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao adicionar colunas:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  addReprogramacaoColumns()
    .then(() => {
      console.log('\n🎉 Script executado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erro na execução:', error);
      process.exit(1);
    });
}

module.exports = addReprogramacaoColumns;
