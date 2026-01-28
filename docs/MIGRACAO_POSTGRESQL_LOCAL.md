# Guia de Migração: Neon para PostgreSQL Local

Este documento descreve passo a passo como migrar o ICAP do banco de dados Neon (nuvem) para um PostgreSQL local, permitindo executar a aplicação em uma rede sem internet.

---

## Pré-requisitos

Antes de iniciar, certifique-se de ter instalado:

- **PostgreSQL** (versão 14 ou superior)
- **pgAdmin 4** (para gerenciamento visual do banco)
- **Node.js** (versão 18 ou superior)

---

## Passo 1: Instalar PostgreSQL Local

### Windows
1. Baixe o instalador em: https://www.postgresql.org/download/windows/
2. Execute o instalador e siga as instruções
3. Defina uma senha para o usuário `postgres`
4. Mantenha a porta padrão `5432`

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### macOS
```bash
brew install postgresql@14
brew services start postgresql@14
```

---

## Passo 2: Criar o Banco de Dados

### Via pgAdmin
1. Abra o pgAdmin
2. Conecte ao servidor PostgreSQL local
3. Clique com botão direito em "Databases" > "Create" > "Database"
4. Nome: `icap`
5. Owner: `postgres`
6. Clique em "Save"

### Via Terminal
```bash
sudo -u postgres psql
CREATE DATABASE icap;
\q
```

---

## Passo 3: Modificar Dependências do Projeto

### 3.1 Remover pacote Neon
```bash
npm uninstall @neondatabase/serverless
```

### 3.2 Instalar driver PostgreSQL padrão
```bash
npm install pg
npm install -D @types/pg
```

---

## Passo 4: Modificar o Arquivo `server/db.ts`

Substitua todo o conteúdo do arquivo por:

```typescript
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL não configurado. Configure a variável de ambiente.");
}

let pool: Pool | null = null;
let db: any = null;

if (process.env.DATABASE_URL) {
  console.log('DATABASE_URL configurada:', process.env.DATABASE_URL?.substring(0, 30) + '...');
  
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL
  });
  
  db = drizzle(pool, { schema });
} else {
  console.log('🔧 DATABASE_URL não configurada');
  pool = null;
  db = null;
}

export { pool, db };
```

---

## Passo 5: Configurar Variável de Ambiente

### 5.1 Criar arquivo `.env` na raiz do projeto

```env
DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/icap
```

> **Importante:** Substitua `SUA_SENHA` pela senha definida na instalação do PostgreSQL.

### 5.2 Formato da Connection String

```
postgresql://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO
```

Exemplo:
```
postgresql://postgres:minhasenha123@localhost:5432/icap
```

---

## Passo 6: Atualizar Scripts (Opcional)

Se você usa os scripts da pasta `/scripts/`, remova a configuração SSL de cada um:

### Antes:
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
```

### Depois:
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
```

---

## Passo 7: Executar Migrations

Após configurar tudo, execute as migrations para criar as tabelas:

```bash
npm run db:push
```

Ou:
```bash
npx drizzle-kit push
```

---

## Passo 8: Verificar Conexão

Inicie a aplicação para verificar se a conexão está funcionando:

```bash
npm run dev
```

Você deve ver no console:
```
DATABASE_URL configurada: postgresql://postgres:...
```

---

## Estrutura Final das Dependências

### package.json (trecho relevante)

```json
{
  "dependencies": {
    "pg": "^8.11.3",
    "drizzle-orm": "^0.39.3"
  },
  "devDependencies": {
    "@types/pg": "^8.10.9",
    "drizzle-kit": "^0.30.6"
  }
}
```

---

## Backup e Restauração

### Exportar dados do Neon (antes da migração)
```bash
pg_dump "postgresql://user:pass@neon.tech/db" > backup_neon.sql
```

### Importar para PostgreSQL local
```bash
psql -U postgres -d icap -f backup_neon.sql
```

---

## Solução de Problemas

### Erro: "ECONNREFUSED"
- Verifique se o PostgreSQL está rodando
- Confirme a porta (padrão: 5432)

### Erro: "password authentication failed"
- Verifique a senha no arquivo `.env`
- Confirme as credenciais no pgAdmin

### Erro: "database does not exist"
- Crie o banco de dados `icap` conforme Passo 2

---

## Checklist Final

- [ ] PostgreSQL instalado e rodando
- [ ] Banco de dados `icap` criado
- [ ] Pacote `@neondatabase/serverless` removido
- [ ] Pacote `pg` instalado
- [ ] Arquivo `server/db.ts` atualizado
- [ ] Arquivo `.env` configurado com DATABASE_URL
- [ ] Migrations executadas (`npm run db:push`)
- [ ] Aplicação testada e funcionando

---

## Notas Importantes

1. **Schema:** O schema do banco (em `shared/schema.ts`) não precisa de alterações
2. **Drizzle:** Continua funcionando normalmente com o driver `pg`
3. **pgAdmin:** Pode ser usado para visualizar e gerenciar os dados
4. **Offline:** Após a migração, a aplicação funciona sem internet

---

*Documento criado em: Janeiro 2026*
*Versão: 1.0*
