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
   - Endpoint: `GET /api/ordem-compra/:id/itens`

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

### 3. Segurança (PENDENTE ⚠️)
- Mobile auth aceita qualquer Bearer token
- KeyUser baseado apenas em ID (1-5)
- Necessário implementar validação JWT adequada

## Mudanças Recentes

### 09/10/2025
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
GOOGLE_MAPS_API_KEY=<Para Google Maps>
```

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
