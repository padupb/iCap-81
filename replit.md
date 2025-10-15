# i-CAP 5.0 - Sistema de Gestão Logística

## Visão Geral
Sistema completo de gestão logística desenvolvido em React + Node.js/Express, com rastreamento em tempo real, gerenciamento de documentos, QR codes e controle de acesso baseado em roles.

## Arquitetura do Projeto

### Frontend (React + Vite)
- **Localização**: `client/src/`
- **Framework**: React 18 com TypeScript
- **Roteamento**: Wouter
- **UI**: Radix UI + Tailwind CSS
- **State Management**: TanStack Query + Context API
- **Maps**: Google Maps API

### Backend (Node.js + Express)
- **Localização**: `server/`
- **Runtime**: Node.js com TypeScript (tsx)
- **Database**: PostgreSQL (Neon) via Drizzle ORM
- **Autenticação**: Passport.js + express-session
- **Storage**: Replit Object Storage + Google Drive

### Schema do Banco de Dados
- **Localização**: `shared/schema.ts`
- **ORM**: Drizzle ORM com PostgreSQL

## Funcionalidades Principais

1. **Gestão de Pedidos**
   - Criação e acompanhamento de pedidos
   - Rastreamento em tempo real via Google Maps
   - Histórico de status e reprogramações

2. **Ordens de Compra**
   - Gerenciamento de OCs com itens
   - Controle de validade e status
   - Endpoints principais:
     - `GET /api/ordem-compra/:id/itens` - Buscar itens
     - `PUT /api/ordem-compra/:id` - Editar ordem de compra
     - `POST /api/ordem-compra-nova` - Criar ordem de compra

3. **Documentos**
   - Upload/download de documentos (NF-e PDF/XML, certificados, fotos)
   - Storage: Replit Object Storage (preferencial) + Google Drive
   - Endpoint: `GET /api/pedidos/:id/documentos/:tipo`

4. **QR Codes**
   - Geração automática de QR codes para pedidos
   - Acesso rápido via mobile

5. **Controle de Acesso**
   - Sistema de roles e permissões
   - KeyUser: ID 1-5 (acesso total)
   - Mobile auth via Bearer token

6. **Gestão de Categorias, Funções e Unidades (KeyUser)**
   - Categorias de Empresa: `GET/POST/PUT/DELETE /api/company-categories`
   - Funções de Usuário: `GET/POST/PUT/DELETE /api/user-roles`
   - Unidades de Medida: `GET/POST/PUT/DELETE /api/units`
   - Todos os dados são buscados do banco via Drizzle ORM
   - Endpoints protegidos por `isKeyUser` (exceto GET)

## Estrutura de Pastas

```
.
├── client/              # Frontend React
│   └── src/
│       ├── components/  # Componentes reutilizáveis
│       ├── pages/       # Páginas da aplicação
│       └── lib/         # Utilitários e configurações
├── server/              # Backend Express
│   ├── routes.ts        # Rotas da API
│   ├── middleware/      # Auth e outros middlewares
│   ├── storage.ts       # Funções de storage
│   └── index.ts         # Entry point
├── shared/              # Código compartilhado
│   └── schema.ts        # Schema Drizzle
└── scripts/             # Scripts utilitários
```

## Configurações Importantes

### Object Storage (Replit)
- **Padrão de API**: Todos os métodos retornam `{ok: boolean, value: any}` ou `{ok: boolean, error: string}`
- **list()**: Retorna `{ok, value: [{name: string, ...}, ...]}`
- **downloadAsBytes()**: Retorna `{ok, value: [Buffer]}` (array com Buffer no índice 0)
- **uploadFromBytes()**: Requer Uint8Array como entrada

### Função Auxiliar para Object Storage
```typescript
// Localização: server/routes.ts linha ~121
function extractBufferFromStorageResult(result: any): Buffer | null
```
Esta função padroniza a extração de Buffer das respostas do Object Storage.

### KeyUser
- **Email**: padupb@admin.icap
- **Password**: 170824
- **IDs**: 1-5 (acesso total ao sistema)
- **Permissões**: ['*'] (todas)

### Download de Documentos
Endpoint: `GET /api/pedidos/:id/documentos/:tipo`
- **Tipos**: nota_pdf, nota_xml, certificado_pdf, foto_nota
- **Estratégia de fallback**:
  1. Buscar em `documentos_info` do pedido
  2. Busca direta no Object Storage (por padrão de nome)
  3. Sistema de arquivos local (temporário)

## Comandos Úteis

### Desenvolvimento
```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run db:push      # Sincroniza schema com banco
npm run db:push --force  # Força sincronização (com warnings)
```

### Migrations
⚠️ **NUNCA** escreva migrations SQL manuais. Use `npm run db:push` ou `npm run db:push --force`.

## Problemas Conhecidos e Soluções

### 1. Object Storage API Pattern (RESOLVIDO ✅)
**Problema**: Downloads falhavam porque o código não tratava corretamente o formato de resposta do Object Storage.

**Solução**: Implementada função `extractBufferFromStorageResult()` que:
- Trata `{ok, value: [Buffer]}` (array com Buffer)
- Trata `{ok, value: Buffer}` (Buffer direto)
- Trata Buffer/Uint8Array direto
- Suporta arrays de bytes

### 2. Download de Documentos sem documentos_info (RESOLVIDO ✅)
**Problema**: Pedidos com `documentos_info` vazio não conseguiam baixar documentos.

**Solução**: Implementado sistema de fallback que:
1. Tenta `documentos_info` primeiro
2. Lista todos os objetos no storage e busca por padrões
3. Usa padrões: `{orderId}/{tipo}-*`, `orders/{orderId}/{tipo}-*`
4. Fallback para sistema local se necessário

### 3. Tracking Points - Schema Mismatch (RESOLVIDO ✅)
**Problema**: Mapa do dashboard não exibia pontos de rastreamento devido a incompatibilidade de tipos.
- Schema Drizzle tinha `tracking_points.orderId` como INTEGER
- Banco de dados tinha `order_id` como TEXT (para armazenar códigos alfanuméricos)
- Endpoint buscava com ID numérico mas banco esperava código (ex: "CCM0809250025")
- Coordenadas lat/lng retornavam como strings mas Google Maps precisa de números

**Solução**:
1. Atualizado schema Drizzle: `orderId: text("order_id").notNull()` (shared/schema.ts)
2. Endpoint agora busca primeiro o código do pedido e depois os tracking points (server/routes.ts linhas 4207-4229)
3. Frontend converte lat/lng para números com `parseFloat()` (DashboardTrackingMap.tsx linhas 157-158)
4. Adicionado filtro defensivo para coordenadas inválidas (NaN)

### 4. Confirmação de Entrega - Endpoint Incorreto (RESOLVIDO ✅)
**Problema**: Erro ao confirmar entrega de pedido com foto da nota fiscal assinada.
- Frontend chamava `/api/pedidos/:id/confirmar` (endpoint não existia)
- Backend tinha apenas `/api/pedidos/:id/confirmar-entrega` (sem suporte a upload de foto)
- Frontend enviava FormData com `quantidadeRecebida` + `fotoNotaAssinada`
- Backend esperava JSON com `quantidadeEntregue`
- Middleware multer configurado mas não usado

**Solução**:
1. Criado endpoint `/api/pedidos/:id/confirmar` com middleware multer (server/routes.ts linha 3755)
2. Suporte a FormData com campos: `quantidadeRecebida` e `fotoNotaAssinada`
3. Upload de foto para Object Storage com padrão: `{pedidoId}/foto-nota-assinada-{timestamp}.{ext}`
4. Atualização de `documentos_info` do pedido para incluir path da foto
5. Validações de permissão, quantidade vs ordem de compra, e foto obrigatória
6. Endpoint legado `/api/pedidos/:id/confirmar-entrega` mantido para compatibilidade

### 5. Segurança (PENDENTE ⚠️)
- Mobile auth aceita qualquer Bearer token
- KeyUser baseado apenas em ID (1-5)
- Necessário implementar validação JWT adequada

### 6. Extração Automática de Quantidade do XML da NF-e (IMPLEMENTADO ✅)
**Funcionalidade**: Ao fazer upload do XML da nota fiscal, o sistema automaticamente extrai a quantidade e atualiza o pedido.

**Implementação**:
1. Biblioteca `fast-xml-parser` instalada para parsing de XML
2. Função `extractQuantityFromXML()` criada (server/routes.ts linhas 30-124)
   - Extrai quantidade do campo `<qCom>` (quantidade comercial) ou `<qTrib>` (tributária)
   - Suporta múltiplos itens na NF-e (soma todas as quantidades)
   - Trata diferentes estruturas de XML (nfeProc, NFe, infNFe)
3. Integração no endpoint `/api/pedidos/:id/documentos` (linhas 3831-3841)
   - Detecta quando nota_xml é enviada
   - Processa XML automaticamente
   - Extrai quantidade e informações do produto
4. Atualização automática do pedido (linhas 3891-3941)
   - Busca quantidade atual do pedido
   - Atualiza com quantidade do XML
   - Registra log de auditoria com detalhes da correção
5. Log detalhado com:
   - Quantidade anterior vs nova quantidade
   - Diferença entre valores
   - Nome e código do produto do XML
   - Rastreabilidade completa da alteração

**Comportamento**:
- ✅ Processa XML automaticamente após upload
- ✅ Atualiza quantidade do pedido
- ✅ Registra log de auditoria
- ✅ Não falha upload se extração falhar (apenas avisa)
- ✅ Retorna informações da quantidade extraída na resposta

## Mudanças Recentes

### 15/10/2025 - Tarde
- ✅ Corrigido botão de download de PDF das ordens de compra
- ✅ Identificado problema: PDFs salvos em `orders/ordens_compra_...` mas download procurava em `OC/`
- ✅ Criada função `saveOrdemCompraPdfToStorage()` para salvar PDFs diretamente na pasta `OC/`
- ✅ Atualizada rota de upload `/api/ordem-compra/:id/upload-pdf` para usar nova função
- ✅ PDFs agora são salvos corretamente em `OC/${numeroOrdem}.pdf` no Object Storage
- ⚠️ **Importante**: PDFs antigos (antes desta correção) não funcionarão - necessário re-upload

### 14/10/2025 - Tarde
- ✅ Corrigido erro ao editar ordem de compra
- ✅ Criado endpoint `PUT /api/ordem-compra/:id` que estava faltando
- ✅ Endpoint retorna JSON corretamente (antes retornava HTML causando erro de parse)
- ✅ Implementada validação de dados, autenticação e log de auditoria
- ✅ Documentação atualizada com endpoints de ordens de compra

### 13/10/2025 - Noite (Parte 2)
- ✅ Criados endpoints CRUD para Categorias: `/api/company-categories` (GET/POST/PUT/DELETE)
- ✅ Criados endpoints CRUD para Funções: `/api/user-roles` (GET/POST/PUT/DELETE)
- ✅ Criados endpoints CRUD para Unidades: `/api/units` (GET/POST/PUT/DELETE)
- ✅ Todos os dados são buscados do banco via Drizzle ORM
- ✅ Endpoints POST/PUT/DELETE protegidos por middleware `isKeyUser`
- ✅ Menu keyuser atualizado: removida aba "API Keys" e seções desnecessárias

### 13/10/2025 - Noite (Parte 1)
- ✅ Implementado extração automática de quantidade do XML da NF-e
- ✅ Instalada biblioteca fast-xml-parser para parsing de XML
- ✅ Criada função extractQuantityFromXML() para processar NF-e
- ✅ Integração automática no endpoint de upload de documentos
- ✅ Atualização automática da quantidade do pedido baseado no XML
- ✅ Log de auditoria detalhado para rastrear correções de quantidade

### 09/10/2025 - Noite
- ✅ Corrigido endpoint de confirmação de entrega com upload de foto
- ✅ Criado `/api/pedidos/:id/confirmar` com suporte a FormData e multer
- ✅ Implementado upload de foto da nota assinada para Object Storage
- ✅ Validações de quantidade, permissões e foto obrigatória
- ✅ Confirmação de entrega agora funciona corretamente com foto

### 09/10/2025 - Tarde
- ✅ Corrigido schema mismatch em tracking_points (INTEGER → TEXT)
- ✅ Endpoint `/api/tracking-points/:orderId` agora traduz ID numérico para código alfanumérico
- ✅ Frontend converte coordenadas de string para number antes de renderizar mapa
- ✅ Validação defensiva para coordenadas inválidas (filtra NaN)
- ✅ Mapa do dashboard agora exibe pontos de rastreamento corretamente

### 09/10/2025 - Manhã
- ✅ Corrigido padrão de resposta do Object Storage (`{ok, value: [Buffer]}`)
- ✅ Implementada função auxiliar `extractBufferFromStorageResult()`
- ✅ Corrigido download de documentos com fallback para busca direta no storage
- ✅ Endpoint `/api/pedidos/:id/documentos/:tipo` totalmente funcional
- ✅ Endpoint `/api/ordem-compra/:id/itens` implementado com snake_case
- ✅ Removidos logs de debug excessivos

### Histórico Anterior
- Implementação de upload de documentos para Object Storage
- Sistema de rastreamento com Google Maps
- Gestão de ordens de compra e itens
- Sistema de permissões e roles

## Variáveis de Ambiente

```bash
DATABASE_URL=<Neon PostgreSQL connection string>
JWT_SECRET=<Opcional - para JWT token validation>
GOOGLE_MAPS_API_KEY=<Para Google Maps - ver GOOGLE_MAPS_SETUP.md>
```

### Configuração do Google Maps
⚠️ **IMPORTANTE**: A chave do Google Maps precisa ser configurada corretamente no Google Cloud Console. Consulte `GOOGLE_MAPS_SETUP.md` para instruções detalhadas.

**Problema Comum**: Se você vir erro `InvalidKeyMapError` no console do navegador, a chave precisa:
1. Ter a **Maps JavaScript API** habilitada
2. Permitir o domínio do Replit nos **HTTP referrers**
3. Ter as **API restrictions** configuradas corretamente

## Notas de Desenvolvimento

### Database Safety
- ⚠️ **NUNCA** mude tipos de colunas ID (serial ↔ varchar)
- Sempre verifique schema existente antes de mudanças
- Use `npm run db:push --force` para sync seguro

### Object Storage Best Practices
1. Sempre usar função `extractBufferFromStorageResult()` para downloads
2. Converter Buffer para Uint8Array antes de upload
3. Validar tamanho do arquivo (> 1 byte para evitar corrupção)
4. Implementar fallbacks para robustez

### Padrões de Código
- TypeScript strict mode
- Drizzle ORM para queries (não SQL direto)
- Error handling com try/catch
- Logs informativos com emojis para debug

## Deployment

O sistema está configurado para deploy no Replit:
- Frontend servido via Vite dev server (porta 5000)
- Backend Express (porta 5000)
- Database: Neon PostgreSQL
- Storage: Replit Object Storage (persistente)

### Próximos Passos Sugeridos
1. Configurar deploy production usando `deploy_config_tool`
2. Implementar validação JWT adequada
3. Migrar autenticação mobile para JWT
4. Adicionar testes automatizados
5. Implementar rate limiting
6. Adicionar monitoramento e logs estruturados
