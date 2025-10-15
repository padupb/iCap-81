# Guia de Fuso Horário - Cuiabá (GMT-4)

## ✅ Mudanças Implementadas

Todo o sistema foi atualizado para usar o fuso horário de **Cuiabá (GMT-4)** em todas as operações de gravação no banco de dados.

## 🔧 Funções Utilitárias Criadas

Arquivo: `server/utils/timezone.ts`

### Funções Disponíveis:

1. **`getCuiabaDateTime()`** - Retorna a data/hora atual em Cuiabá (GMT-4)
   ```typescript
   const agora = getCuiabaDateTime();
   ```

2. **`toCuiabaISOString(date)`** - Converte qualquer data para ISO no fuso de Cuiabá
   ```typescript
   const isoString = toCuiabaISOString(new Date());
   ```

3. **`convertToLocalDate(dateString)`** - Converte string de data para Cuiabá
   ```typescript
   const dataCuiaba = convertToLocalDate("2025-10-15");
   ```

## 📝 Operações Atualizadas

### ✅ Pedidos (Orders)
- Criação de pedidos: data de entrega convertida para GMT-4
- Datas de comparação com ordens de compra: usando GMT-4
- Logs de pedidos: usando `getCuiabaDateTime()`

### ✅ Ordens de Compra (Purchase Orders)
- Criação: `valido_desde`, `valido_ate` e `data_criacao` em GMT-4
- Edição: datas atualizadas em GMT-4
- Listagem: datas retornadas em formato ISO de Cuiabá

### ✅ Upload de Documentos
- `uploadDate` dos documentos em GMT-4
- Metadados de fotos e PDFs em GMT-4

### ✅ Logs do Sistema
- Todos os logs criados com `getCuiabaDateTime()`
- Timestamps consistentes em GMT-4

### ✅ Timestamps Automáticos
- Conversões de resposta da API usando `toCuiabaISOString()`
- Fallbacks para datas nulas usando `toCuiabaISOString(new Date())`

## 🚀 Como Usar no Código

### Backend (server/)

**Ao criar timestamps:**
```typescript
import { getCuiabaDateTime } from "./utils/timezone";

const agora = getCuiabaDateTime(); // Em vez de new Date()
```

**Ao converter datas para ISO:**
```typescript
import { toCuiabaISOString } from "./utils/timezone";

const isoString = toCuiabaISOString(data); // Em vez de data.toISOString()
```

**Ao receber datas do frontend:**
```typescript
import { convertToLocalDate } from "./utils/timezone";

const dataCuiaba = convertToLocalDate(dataRecebida);
```

### Frontend (client/src/)

**Ao enviar datas para o backend:**
- Enviar no formato `YYYY-MM-DD` (string)
- O backend fará a conversão para GMT-4 automaticamente

**Exemplo:**
```typescript
const deliveryDate = "2025-10-15"; // Formato string
// Não usar: new Date().toISOString() 
// Não usar: Date.UTC()
```

## ⚠️ Regras Importantes

1. **NUNCA** usar `new Date()` diretamente para timestamps de gravação
2. **SEMPRE** usar `getCuiabaDateTime()` para data/hora atual
3. **SEMPRE** usar `toCuiabaISOString()` para converter datas para ISO
4. **Frontend**: enviar datas como string no formato `YYYY-MM-DD`
5. **Backend**: converter datas recebidas usando as funções utilitárias

## 📊 Arquivos Modificados

- ✅ `server/utils/timezone.ts` - Funções utilitárias (NOVO)
- ✅ `server/routes.ts` - Rotas de API atualizadas
- ✅ `server/storage.ts` - Storage atuali zado para usar GMT-4
- ⏳ `client/src/pages/Orders.tsx` - Pendente de revisão
- ⏳ `client/src/pages/PurchaseOrdersNovo.tsx` - Pendente de revisão

## 🔍 Como Testar

1. Criar um pedido e verificar a data de entrega no banco
2. Criar uma ordem de compra e verificar as datas de validade
3. Fazer upload de documento e verificar o uploadDate
4. Verificar logs do sistema para confirmar timestamps

Todas as datas devem estar em GMT-4 (Cuiabá).
