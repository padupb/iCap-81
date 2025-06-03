import { pool } from "../server/db.js";

async function alterarTabela() {
  try {
    await pool.query(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS documentoscarregados BOOLEAN DEFAULT false;`,
    );
    await pool.query(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS documentosinfo JSONB;`,
    );
    console.log("Alterações aplicadas com sucesso.");
  } catch (error) {
    console.error("Erro ao aplicar alterações:", error);
  } finally {
    process.exit();
  }
}

alterarTabela();
