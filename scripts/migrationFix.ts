import { pool } from "../server/db";

async function migrationFix() {
  try {
    console.log("Iniciando migração para corrigir a estrutura do banco de dados...");

    // Verificar se a coluna já existe
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'quantidade_recebida'
    `);

    if (checkColumn.rowCount === 0) {
      console.log("Adicionando coluna quantidade_recebida à tabela orders");
      await pool.query(`
        ALTER TABLE orders ADD COLUMN quantidade_recebida DECIMAL(10,2)
      `);
      console.log("Coluna adicionada com sucesso");
    } else {
      console.log("Coluna quantidade_recebida já existe na tabela orders");
    }

    console.log("Migração concluída com sucesso");
  } catch (error) {
    console.error("Erro ao executar migração:", error);
  } finally {
    pool.end();
  }
}

migrationFix();