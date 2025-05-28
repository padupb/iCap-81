# Documentação Técnica Completa: i-CAP 5.0

## Sumário

1. Visão Geral
2. Estrutura de Banco de Dados
3. Frontend
   - 3.1 Esquema de Cores
   - 3.2 Componentes UI
   - 3.3 Páginas
   - 3.4 Validação de Formulários
4. Backend
   - 4.1 Estrutura de API
   - 4.2 Autenticação
   - 4.3 Rotas
   - 4.4 Manipulação de Dados
5. Funcionalidades Principais
   - 5.1 Gestão de Usuários
   - 5.2 Gestão de Empresas
   - 5.3 Gestão de Produtos
   - 5.4 Gestão de Ordens de Compra
   - 5.5 Gestão de Pedidos
6. Instruções de Implementação

---

## 1. Visão Geral

O i-CAP 5.0 é um sistema de gestão logística que facilita o controle de pedidos, ordens de compra, produtos e empresas. Ele foi projetado para otimizar a cadeia de suprimentos com funcionalidades robustas de gestão de documentos e processamento de pedidos.

**Tecnologias Principais:**
- Frontend: React com TypeScript
- Backend: Express.js com TypeScript
- Banco de Dados: PostgreSQL
- ORM: Drizzle
- Autenticação: Passport.js com JWT
- UI: Tailwind CSS com shadcn/ui

## 2. Estrutura de Banco de Dados

### Tabelas Principais

#### users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### companies
```sql
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18) UNIQUE,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  category_id INTEGER REFERENCES categories(id),
  contract_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### categories
```sql
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  receives_purchase_orders BOOLEAN DEFAULT FALSE,
  requires_contract BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### products
```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  code VARCHAR(50),
  unit_id INTEGER REFERENCES units(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### units
```sql
CREATE TABLE units (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### purchase_orders
```sql
CREATE TABLE purchase_orders (
  id SERIAL PRIMARY KEY,
  numero_ordem VARCHAR(10) NOT NULL,
  empresa_id INTEGER REFERENCES companies(id),
  obra_id INTEGER REFERENCES companies(id),
  valido_ate DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'ativo',
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### purchase_order_items
```sql
CREATE TABLE purchase_order_items (
  id SERIAL PRIMARY KEY,
  ordem_compra_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
  produto_id INTEGER REFERENCES products(id),
  quantidade DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### orders
```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  product_id INTEGER REFERENCES products(id),
  quantity DECIMAL(10,2) NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  purchase_order_id INTEGER REFERENCES purchase_orders(id),
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 3. Frontend

### 3.1 Esquema de Cores

```css
:root {
  /* Base */
  --background: 0 0% 100%;          /* #FFFFFF */
  --foreground: 222.2 84% 4.9%;     /* #0F172A */
  
  /* Card */
  --card: 0 0% 100%;                /* #FFFFFF */
  --card-foreground: 222.2 84% 4.9%; /* #0F172A */
  
  /* Popover */
  --popover: 0 0% 100%;             /* #FFFFFF */
  --popover-foreground: 222.2 84% 4.9%; /* #0F172A */
  
  /* Primary */
  --primary: 221 83% 53%;           /* #3B82F6 */
  --primary-foreground: 210 40% 98%; /* #F8FAFC */
  
  /* Secondary */
  --secondary: 210 40% 96.1%;       /* #F1F5F9 */
  --secondary-foreground: 222.2 47.4% 11.2%; /* #1E293B */
  
  /* Muted */
  --muted: 210 40% 96.1%;           /* #F1F5F9 */
  --muted-foreground: 215.4 16.3% 46.9%; /* #64748B */
  
  /* Accent */
  --accent: 210 40% 96.1%;          /* #F1F5F9 */
  --accent-foreground: 222.2 47.4% 11.2%; /* #1E293B */
  
  /* Destructive */
  --destructive: 0 84.2% 60.2%;     /* #EF4444 */
  --destructive-foreground: 210 40% 98%; /* #F8FAFC */
  
  /* Border */
  --border: 214.3 31.8% 91.4%;      /* #E2E8F0 */
  --input: 214.3 31.8% 91.4%;       /* #E2E8F0 */
  --ring: 221 83% 53%;              /* #3B82F6 */
  
  /* Radius */
  --radius: 0.5rem;
}

.dark {
  --background: 222.2 84% 4.9%;     /* #0F172A */
  --foreground: 210 40% 98%;        /* #F8FAFC */
  
  --card: 222.2 84% 4.9%;           /* #0F172A */
  --card-foreground: 210 40% 98%;   /* #F8FAFC */
  
  --popover: 222.2 84% 4.9%;        /* #0F172A */
  --popover-foreground: 210 40% 98%; /* #F8FAFC */
  
  --primary: 217.2 91.2% 59.8%;     /* #3B82F6 */
  --primary-foreground: 210 40% 98%; /* #F8FAFC */
  
  --secondary: 217.2 32.6% 17.5%;   /* #1E293B */
  --secondary-foreground: 210 40% 98%; /* #F8FAFC */
  
  --muted: 217.2 32.6% 17.5%;       /* #1E293B */
  --muted-foreground: 215 20.2% 65.1%; /* #94A3B8 */
  
  --accent: 217.2 32.6% 17.5%;      /* #1E293B */
  --accent-foreground: 210 40% 98%; /* #F8FAFC */
  
  --destructive: 0 62.8% 30.6%;     /* #7F1D1D */
  --destructive-foreground: 210 40% 98%; /* #F8FAFC */
  
  --border: 217.2 32.6% 17.5%;      /* #1E293B */
  --input: 217.2 32.6% 17.5%;       /* #1E293B */
  --ring: 224.3 76.3% 48%;          /* #3B82F6 */
}
```

### 3.2 Componentes UI

O sistema utiliza componentes shadcn/ui, uma biblioteca baseada em Tailwind CSS e Radix UI, que proporciona componentes acessíveis e estilizáveis.

**Componentes principais:**

1. **Button**
   - Variantes: default, destructive, outline, secondary, ghost, link
   - Tamanhos: default, sm, lg, icon

2. **Card**
   - Subcomponentes: CardHeader, CardTitle, CardDescription, CardContent, CardFooter

3. **Dialog**
   - Subcomponentes: DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter

4. **Form**
   - Subcomponentes: FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage
   - Integração com react-hook-form e zod para validação

5. **Table**
   - Subcomponentes: TableHeader, TableBody, TableRow, TableHead, TableCell

6. **Select**
   - Subcomponentes: SelectTrigger, SelectValue, SelectContent, SelectItem

7. **Input**
   - Tipos: text, number, date, password

8. **Badge**
   - Variantes: default, secondary, destructive, outline

9. **AlertDialog**
   - Usado para confirmações de ações destrutivas

### 3.3 Páginas

#### Dashboard
- Visão geral com estatísticas principais
- Gráficos de resumo para pedidos e ordens de compra
- Lista de pedidos urgentes

#### Pedidos (Orders)
- Tabela de pedidos com filtros
- Formulário de criação de novos pedidos
- Verificação de saldo em ordens de compra
- Detalhes de pedidos em diálogo

#### Ordens de Compra (PurchaseOrders)
- Tabela de ordens de compra com filtros
- Formulário de criação de novas ordens
- Visualização detalhada de produtos e saldos por ordem
- Exclusão de ordens com confirmação

#### Empresas (Companies)
- Tabela de empresas com filtros
- Formulário de criação/edição de empresas
- Associação de categorias e contratos

#### Produtos (Products)
- Tabela de produtos com filtros
- Formulário de criação/edição de produtos
- Associação de unidades de medida

#### Usuários (Users)
- Tabela de usuários com filtros
- Formulário de criação/edição de usuários
- Gestão de permissões

#### Configurações (Settings)
- Configurações gerais do sistema
- Preferências de notificações
- Configurações de relatórios

### 3.4 Validação de Formulários

Todos os formulários utilizam react-hook-form com validação zod. Exemplos:

#### Validação de Ordem de Compra
```typescript
const purchaseOrderSchema = z.object({
  orderNumber: z.string()
    .min(5, "Número da ordem deve ter 5 dígitos")
    .max(5, "Número da ordem deve ter 5 dígitos")
    .regex(/^\d+$/, "Número da ordem deve conter apenas dígitos"),
  companyId: z.string().min(1, "Fornecedor é obrigatório"),
  obraId: z.string().min(1, "Obra é obrigatória"),
  validUntil: z.string()
    .min(1, "Data de validade é obrigatória")
    .refine((date) => {
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    }, "A data deve ser igual ou posterior a hoje"),
  items: z.array(z.object({
    productId: z.string().min(1, "Produto é obrigatório"),
    quantity: z.string()
      .min(1, "Quantidade é obrigatória")
      .refine((val) => parseInt(val) > 0, "A quantidade deve ser maior que zero"),
  })).min(1, "Pelo menos um produto é obrigatório").max(4, "Máximo 4 produtos por ordem"),
});
```

#### Validação de Pedido
```typescript
const orderSchema = z.object({
  productId: z.string().min(1, "Produto é obrigatório"),
  quantity: z.string()
    .min(1, "Quantidade é obrigatória")
    .refine((val) => parseFloat(val) > 0, "A quantidade deve ser maior que zero"),
  companyId: z.string().min(1, "Empresa é obrigatória"),
  purchaseOrderId: z.string().min(1, "Ordem de compra é obrigatória"),
  priority: z.enum(["low", "normal", "high", "urgent"], {
    required_error: "Prioridade é obrigatória",
  }),
  notes: z.string().optional(),
});
```

## 4. Backend

### 4.1 Estrutura de API

O backend é construído com Express.js e TypeScript, seguindo uma arquitetura de API RESTful. Os principais componentes são:

- **Routes**: Define os endpoints da API
- **Controllers**: Contém a lógica de negócio
- **Models**: Define a estrutura de dados usando Drizzle ORM
- **Middleware**: Inclui autenticação, validação e tratamento de erros

### 4.2 Autenticação

A autenticação é realizada através de Passport.js com estratégia JWT:

```typescript
// Configuração Passport
passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async (email, password, done) => {
    try {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.email, email)
      });
      
      if (!user) {
        return done(null, false, { message: 'Usuário não encontrado' });
      }
      
      const isValid = await bcrypt.compare(password, user.password);
      
      if (!isValid) {
        return done(null, false, { message: 'Senha incorreta' });
      }
      
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// Middleware de autenticação
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('jwt', { session: false }, (err: any, user: any) => {
    if (err || !user) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }
    req.user = user;
    next();
  })(req, res, next);
};
```

### 4.3 Rotas

#### Autenticação
```typescript
router.post('/auth/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ success: false, message: info.message });
    
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });
    
    return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
  })(req, res, next);
});

router.get('/auth/me', isAuthenticated, (req, res) => {
  res.json({ success: true, user: req.user });
});
```

#### Empresas
```typescript
router.get('/companies', isAuthenticated, async (req, res) => {
  try {
    const companies = await db.query.companies.findMany({
      with: {
        category: true
      }
    });
    res.json(companies);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao buscar empresas' });
  }
});

router.post('/companies', isAuthenticated, async (req, res) => {
  try {
    const validation = companySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, errors: validation.error.format() });
    }
    
    const newCompany = await db.insert(schema.companies).values(validation.data).returning();
    res.status(201).json(newCompany[0]);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao criar empresa' });
  }
});
```

#### Ordens de Compra
```typescript
router.get('/ordens-compra', isAuthenticated, async (req, res) => {
  try {
    const ordens = await db.query.purchase_orders.findMany({
      with: {
        empresa: true
      }
    });
    
    const formattedOrdens = ordens.map(ordem => ({
      id: ordem.id,
      numero_ordem: ordem.numero_ordem,
      empresa_id: ordem.empresa_id,
      empresa_nome: ordem.empresa?.name || 'Empresa não encontrada',
      valido_ate: ordem.valido_ate.toISOString(),
      status: ordem.status,
      data_criacao: ordem.data_criacao.toISOString()
    }));
    
    res.json(formattedOrdens);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao buscar ordens de compra' });
  }
});

router.get('/ordem-compra/:id/itens', isAuthenticated, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const items = await db.query.purchase_order_items.findMany({
      where: eq(schema.purchase_order_items.ordem_compra_id, orderId),
      with: {
        produto: true
      }
    });
    
    const formattedItems = items.map(item => ({
      id: item.id,
      ordem_compra_id: item.ordem_compra_id,
      produto_id: item.produto_id,
      quantidade: item.quantidade.toString(),
      produto_nome: item.produto?.name
    }));
    
    res.json(formattedItems);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao buscar itens da ordem' });
  }
});

router.post('/ordem-compra-nova', isAuthenticated, async (req, res) => {
  const { numeroOrdem, empresaId, obraId, validoAte, produtos } = req.body;
  
  try {
    // Criar ordem de compra
    const [novaOrdem] = await db.insert(schema.purchase_orders).values({
      numero_ordem: numeroOrdem,
      empresa_id: empresaId,
      obra_id: obraId,
      valido_ate: new Date(validoAte),
      status: 'ativo'
    }).returning();
    
    // Adicionar produtos à ordem
    for (const produto of produtos) {
      await db.insert(schema.purchase_order_items).values({
        ordem_compra_id: novaOrdem.id,
        produto_id: produto.id,
        quantidade: produto.qtd
      });
    }
    
    res.json({ sucesso: true, ordem: novaOrdem });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao criar ordem de compra' });
  }
});
```

#### Verificação de Saldo
```typescript
router.get('/ordens-compra/:ordemId/produtos/:produtoId/saldo', isAuthenticated, async (req, res) => {
  try {
    const ordemId = parseInt(req.params.ordemId);
    const produtoId = parseInt(req.params.produtoId);
    
    // Buscar quantidade total na ordem
    const item = await db.query.purchase_order_items.findFirst({
      where: and(
        eq(schema.purchase_order_items.ordem_compra_id, ordemId),
        eq(schema.purchase_order_items.produto_id, produtoId)
      ),
      with: {
        produto: {
          with: {
            unit: true
          }
        }
      }
    });
    
    if (!item) {
      return res.json({ 
        sucesso: false, 
        mensagem: 'Produto não encontrado na ordem de compra' 
      });
    }
    
    // Buscar quantidade usada em pedidos
    const pedidos = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.purchase_order_id, ordemId),
        eq(schema.orders.product_id, produtoId)
      )
    });
    
    const quantidadeUsada = pedidos.reduce((acc, pedido) => acc + Number(pedido.quantity), 0);
    const quantidadeTotal = Number(item.quantidade);
    const saldoDisponivel = quantidadeTotal - quantidadeUsada;
    
    res.json({
      sucesso: true,
      produtoId,
      ordemId,
      quantidadeTotal,
      quantidadeUsada,
      saldoDisponivel,
      unidade: item.produto?.unit?.symbol || 'un'
    });
  } catch (error) {
    res.status(500).json({ 
      sucesso: false, 
      mensagem: 'Erro ao verificar saldo do produto na ordem de compra' 
    });
  }
});
```

### 4.4 Manipulação de Dados

O sistema utiliza o Drizzle ORM para interação com o banco de dados PostgreSQL:

```typescript
// Schema definition
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("user"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  cnpj: varchar("cnpj", { length: 18 }).unique(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  category_id: integer("category_id").references(() => categories.id),
  contract_number: varchar("contract_number", { length: 50 }),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

// Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  companies: many(companies)
}));

export const companiesRelations = relations(companies, ({ one }) => ({
  category: one(categories, {
    fields: [companies.category_id],
    references: [categories.id]
  })
}));
```

## 5. Funcionalidades Principais

### 5.1 Gestão de Usuários

- Cadastro de usuários com diferentes níveis de acesso (admin, gerente, operador)
- Login com autenticação JWT
- Edição de perfil e alteração de senha
- Gestão de permissões por função

### 5.2 Gestão de Empresas

- Cadastro de empresas com informações de contato
- Categorização de empresas (fornecedor, cliente, obra)
- Vinculação de contratos a empresas
- Filtros e busca avançada

### 5.3 Gestão de Produtos

- Cadastro de produtos com unidades de medida
- Categorização e codificação de produtos
- Associação de produtos a pedidos e ordens de compra

### 5.4 Gestão de Ordens de Compra

- Criação de ordens de compra vinculadas a empresas
- Adição de múltiplos produtos com quantidades
- Controle de validade e status da ordem
- Visualização detalhada de produtos e saldos
- Exclusão de ordens

### 5.5 Gestão de Pedidos

- Criação de pedidos vinculados a ordens de compra
- Verificação automática de saldo disponível
- Controle de status e prioridade
- Histórico de alterações

## 6. Instruções de Implementação

1. **Configuração do Banco de Dados:**
   - Criar banco PostgreSQL
   - Aplicar migrations com Drizzle: `npm run db:push`
   - Inserir dados iniciais: unidades, categorias e usuário admin

2. **Configuração do Backend:**
   - Instalar dependências: `npm install`
   - Configurar variáveis de ambiente no arquivo `.env`
   - Iniciar servidor de desenvolvimento: `npm run dev`

3. **Configuração do Frontend:**
   - Instalar dependências
   - Configurar conexão com backend
   - Iniciar aplicação React: `npm run dev`

4. **Implementação por Módulos:**
   - Iniciar pela autenticação e gestão de usuários
   - Configurar empresas e produtos
   - Implementar ordens de compra
   - Finalizar com pedidos e relatórios

5. **Testes:**
   - Testar cada módulo isoladamente
   - Testar integração entre módulos
   - Verificar regras de negócio e validações

---

Este documento fornece um guia completo para reconstruir o sistema i-CAP 5.0, incluindo todos os detalhes técnicos e regras de negócio necessários para sua implementação.