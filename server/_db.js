import pkg from "pg";
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não definida.");
}

export const pool = new Pool({
  connectionString,
});
