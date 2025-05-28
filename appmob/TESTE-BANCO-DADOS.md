# 🗄️ PWA i-CAP Tracker - Integração com Banco de Dados

## 🚀 Como Iniciar

### 1. Servidor PWA com Banco de Dados
```bash
cd E:\icap7\appmob
node pwa-api.js
```

### 2. Servidor Principal i-CAP (opcional)
```bash
cd E:\icap7
$env:NODE_ENV="development"; npx tsx server/index.ts
```

## 📋 Testando com Pedidos Reais

A PWA agora está conectada ao banco de dados real do i-CAP. Para testar:

### 1. **Verificar Pedidos Existentes**
- Acesse o sistema i-CAP principal: http://localhost:3000
- Vá em "Pedidos" para ver os pedidos cadastrados
- Anote o "Código do Pedido" (order_id) de algum pedido

### 2. **Testar na PWA**
- Acesse: http://localhost:8080 ou http://192.168.0.40:8080
- Digite o código do pedido real no campo manual
- Ou escaneie um QR Code com o código do pedido

## 🔄 Funcionalidades Implementadas

### ✅ **Validação de Pedidos**
- Busca pedidos reais no banco de dados
- Retorna informações completas: produto, fornecedor, local de trabalho
- Mostra status atual do pedido

### ✅ **Atualização de Status**
- Quando um pedido válido é inserido, o status muda para **"Em Transporte"**
- Atualização é salva na tabela `orders`
- Registro é criado na tabela `tracking_points`

### ✅ **Rastreamento GPS**
- Localização é salva na tabela `tracking_points`
- Inclui latitude, longitude e precisão
- Histórico completo de movimentação

## 🧪 Teste Completo

1. **Criar um Pedido de Teste**:
   - Acesse http://localhost:3000
   - Faça login como administrador (padupb@admin.icap / 170824)
   - Crie um novo pedido
   - Anote o código gerado

2. **Testar na PWA**:
   - Acesse http://localhost:8080
   - Digite o código do pedido
   - Verifique se o status muda para "Em Transporte"
   - Permita acesso à localização
   - Observe os pontos GPS sendo salvos

3. **Verificar no Sistema Principal**:
   - Volte para http://localhost:3000
   - Vá em "Pedidos" e encontre o pedido testado
   - Verifique se o status foi atualizado
   - Veja o histórico de rastreamento

## 📊 Logs e Debug

### Logs do Servidor PWA
```bash
# Ao iniciar pwa-api.js, você verá:
✅ Conexão com banco de dados estabelecida
🎉 Servidor PWA iniciado com sucesso!
```

### Logs de Validação
```bash
# Ao validar um pedido:
✅ Validando pedido no banco: ABC123
✅ Status do pedido ABC123 atualizado para: Em Transporte
```

### Logs de GPS
```bash
# Ao receber localização:
📍 Localização salva para pedido ABC123: lat: -23.550520, lng: -46.633308, accuracy: ±5m
```

## 🔧 Configurações

### Banco de Dados
- **Host**: ep-sparkling-surf-a6zclzez.us-west-2.aws.neon.tech
- **Database**: neondb
- **SSL**: Habilitado

### Status de Pedidos
- **Inicial**: "Registrado"
- **Ao iniciar rastreamento**: "Em Transporte"
- **Ao finalizar**: "Entregue"

### Usuário PWA
- **ID**: 9999 (usuário virtual para tracking points)
- **Nome**: Sistema PWA

## 🚨 Solução de Problemas

### Erro de Conexão com Banco
```bash
❌ Erro ao conectar com banco de dados: connection timeout
```
**Solução**: Verificar conexão com internet e configurações de firewall

### Pedido Não Encontrado
```bash
❌ Pedido não encontrado no sistema
```
**Solução**: Verificar se o código do pedido existe na tabela `orders`

### Erro de Permissão GPS
```bash
❌ Permissão de localização negada
```
**Solução**: Permitir acesso à localização no navegador

## 📱 URLs de Acesso

- **PWA Local**: http://localhost:8080
- **PWA Rede**: http://192.168.0.40:8080
- **i-CAP Principal**: http://localhost:3000
- **API Health**: http://localhost:8080/api/health 