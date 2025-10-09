# Configuração do Google Maps API

## Problema Identificado

A chave do Google Maps está sendo carregada corretamente dos Secrets do Replit, mas o Google Maps retorna erro **InvalidKeyMapError**. Isso ocorre porque a chave precisa ser configurada corretamente no Google Cloud Console.

## Solução Passo a Passo

### 1. Acesse o Google Cloud Console
- Vá para: https://console.cloud.google.com/
- Faça login com sua conta Google
- Selecione o projeto onde a API Key foi criada

### 2. Habilite as APIs Necessárias
- No menu lateral, vá em **APIs & Services** > **Library**
- Procure e habilite as seguintes APIs:
  - ✅ **Maps JavaScript API** (obrigatório)
  - ✅ **Geocoding API** (recomendado)
  - ✅ **Places API** (opcional)

### 3. Configure as Restrições da API Key

#### Passo 3.1: Acesse as Credentials
- No menu lateral, vá em **APIs & Services** > **Credentials**
- Encontre sua API Key (`AIzaSyBS_TMgZfqMle79oUmh_GwV-u22wo1C4T5`)
- Clique no ícone de editar (lápis)

#### Passo 3.2: Configurar Application Restrictions
Você tem duas opções:

**Opção A: Sem Restrições (Desenvolvimento - Menos Seguro)**
- Em **Application restrictions**, selecione: `None`
- ⚠️ Aviso: Use apenas para desenvolvimento

**Opção B: Com Restrições HTTP referrers (Produção - Recomendado)**
- Em **Application restrictions**, selecione: `HTTP referrers (web sites)`
- Adicione os seguintes referrers:
  ```
  https://*.replit.dev/*
  https://*.repl.co/*
  http://localhost:*/*
  http://127.0.0.1:*/*
  ```

#### Passo 3.3: Configurar API Restrictions
- Em **API restrictions**, selecione: `Restrict key`
- Marque as seguintes APIs:
  - ✅ Maps JavaScript API
  - ✅ Geocoding API (se usar)
  - ✅ Places API (se usar)

#### Passo 3.4: Salvar as Configurações
- Clique em **Save**
- ⚠️ **IMPORTANTE**: As mudanças podem levar até 5 minutos para propagar

### 4. Teste a Configuração

Após salvar, aguarde 5 minutos e então:

1. Recarregue a página do i-CAP
2. Faça login no sistema
3. Abra o Dashboard ou qualquer pedido com rastreamento
4. Verifique se o mapa carrega corretamente

### 5. Verificação Rápida

Para verificar se a configuração está correta:

```bash
# No console do navegador, verifique se não há erro
# O erro anterior era: "InvalidKeyMapError"
# Após a configuração correta, o mapa deve carregar normalmente
```

## Troubleshooting

### Erro persiste após configuração
1. Aguarde 5-10 minutos após salvar as mudanças
2. Limpe o cache do navegador (Ctrl+Shift+Del)
3. Verifique se a API Key está correta nos Secrets do Replit
4. Verifique se as APIs estão habilitadas no projeto correto

### Como verificar qual domínio está sendo usado
Abra o console do navegador (F12) e veja a URL atual. Use esse domínio nos HTTP referrers.

### Quota excedida
Se você receber erro de quota:
- Vá em **APIs & Services** > **Quotas**
- Verifique o limite diário de requisições
- Considere ativar billing se necessário

## Estado Atual do Sistema

✅ **Backend configurado corretamente**
- Endpoint `/api/google-maps-key` funcionando
- Secret `GOOGLE_MAPS_API_KEY` carregado corretamente
- Chave sendo retornada para o frontend

❌ **Google Maps retornando erro**
- Erro: `InvalidKeyMapError`
- Causa: Restrições da API Key bloqueando o domínio Replit
- **Solução**: Seguir os passos acima para configurar a API Key

## Componentes que Usam o Google Maps

1. **Dashboard** (`DashboardTrackingMap.tsx`)
   - Mostra todos os pedidos "Em Rota" em um mapa
   - Usa endpoint: `/api/google-maps-key`

2. **Order Detail Drawer** (`OrderDetailDrawer.tsx` + `MapComponent.tsx`)
   - Mostra localização de um pedido específico
   - Usa endpoint: `/api/google-maps-key`

3. **GoogleMapsTracking.tsx**
   - ⚠️ Componente não utilizado (legacy)
   - Pode ser removido no futuro

## Links Úteis

- [Google Cloud Console](https://console.cloud.google.com/)
- [Maps JavaScript API Documentation](https://developers.google.com/maps/documentation/javascript)
- [API Key Best Practices](https://developers.google.com/maps/api-security-best-practices)
- [Error Messages Reference](https://developers.google.com/maps/documentation/javascript/error-messages)
