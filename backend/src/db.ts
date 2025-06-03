
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL não configurado. Usando armazenamento em memória para desenvolvimento local.");
  console.warn("⚠️  Para produção no Replit, configure DATABASE_URL nos Secrets.");
}

let pool: any = null;
let db: any = null;

if (process.env.DATABASE_URL) {
  console.log('DATABASE_URL configurada via Secrets:', process.env.DATABASE_URL?.substring(0, 50) + '...');
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
} else {
  console.log('🔧 Usando configuração local sem banco de dados');
  // Para desenvolvimento local, usar armazenamento em memória
  pool = null;
  db = null;
}

export { pool, db };
