import { pool } from "../server/db";

async function migrationFix2() {
  try {
    console.log("Iniciando migração para corrigir a estrutura do banco de dados...");

    // Verificar se a coluna já existe
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'documentos_carregados'
    `);

    if (checkColumn.rowCount === 0) {
      console.log("Adicionando coluna documentos_carregados à tabela orders");
      await pool.query(`
        ALTER TABLE orders ADD COLUMN documentos_carregados BOOLEAN DEFAULT false
      `);
      console.log("Coluna adicionada com sucesso");
    } else {
      console.log("Coluna documentos_carregados já existe na tabela orders");
    }

    // Verificar coluna documentos_info
    const checkDocumentosInfo = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'documentos_info'
    `);

    if (checkDocumentosInfo.rowCount === 0) {
      console.log("Adicionando coluna documentos_info à tabela orders");
      await pool.query(`
        ALTER TABLE orders ADD COLUMN documentos_info TEXT
      `);
      console.log("Coluna documentos_info adicionada com sucesso");
    } else {
      console.log("Coluna documentos_info já existe na tabela orders");
    }

    console.log("Migração concluída com sucesso");
  } catch (error) {
    console.error("Erro ao executar migração:", error);
  } finally {
    pool.end();
  }
}

migrationFix2();