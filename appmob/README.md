# 📱 i-CAP Tracker - PWA

Aplicativo Progressive Web App (PWA) para rastreamento de entregas do sistema i-CAP.

## 🚀 Funcionalidades

### ✅ Principais Recursos
- **Scanner QR Code**: Leitura automática de códigos QR dos pedidos
- **Rastreamento GPS**: Localização em tempo real com alta precisão
- **Modo Offline**: Funciona sem conexão, sincroniza quando volta online
- **Interface Responsiva**: Otimizada para dispositivos móveis
- **Notificações**: Alertas sobre status de conexão e rastreamento
- **PWA Completa**: Instalável como app nativo

### 🎯 Fluxo de Uso
1. **Escanear QR Code** do pedido ou inserir código manualmente
2. **Iniciar rastreamento** - status muda para "Em Rota"
3. **GPS ativo** - localização enviada automaticamente para o servidor
4. **Controles disponíveis**: Pausar, retomar ou finalizar entrega
5. **Finalizar entrega** - status muda para "Entregue"

## 🛠️ Tecnologias Utilizadas

- **HTML5**: Estrutura semântica e acessível
- **CSS3**: Design moderno com gradientes e animações
- **JavaScript ES6+**: Lógica da aplicação com classes e async/await
- **Service Worker**: Cache offline e sincronização em background
- **Geolocation API**: Rastreamento GPS de alta precisão
- **html5-qrcode**: Biblioteca para scanner QR Code
- **Web App Manifest**: Configuração PWA

## 📁 Estrutura de Arquivos

```
appmob/
├── index.html          # Página principal da PWA
├── styles.css          # Estilos CSS responsivos
├── app.js             # Lógica principal da aplicação
├── sw.js              # Service Worker para cache offline
├── manifest.json      # Configuração PWA
├── README.md          # Esta documentação
└── icons/             # Ícones da PWA (a serem criados)
    ├── icon-72x72.png
    ├── icon-96x96.png
    ├── icon-128x128.png
    ├── icon-144x144.png
    ├── icon-152x152.png
    ├── icon-192x192.png
    ├── icon-384x384.png
    └── icon-512x512.png
```

## 🚀 Como Instalar e Usar

### 1. Configuração do Servidor
A PWA precisa se comunicar com o backend i-CAP. Certifique-se de que as seguintes rotas estejam disponíveis:

```javascript
// Rotas necessárias no backend
GET  /api/health                    # Verificar status do servidor
GET  /api/orders/validate/:orderId  # Validar se pedido existe
PUT  /api/orders/:orderId/status    # Atualizar status do pedido
POST /api/tracking/location         # Receber dados de localização
```

### 2. Servir a PWA
A PWA deve ser servida via HTTPS (exceto localhost). Opções:

#### Opção A: Servidor Local Simples
```bash
# Navegar para a pasta appmob
cd appmob

# Servir com Python (se disponível)
python -m http.server 8080

# Ou com Node.js (se disponível)
npx serve -p 8080
```

#### Opção B: Integrar ao Servidor i-CAP
Copie os arquivos da pasta `appmob` para uma pasta pública do seu servidor Node.js e configure uma rota estática:

```javascript
// No seu server/index.ts
app.use('/tracker', express.static(path.join(__dirname, '../appmob')));
```

### 3. Acessar a PWA
1. Abra o navegador no dispositivo móvel
2. Acesse `http://localhost:8080` (ou URL do seu servidor)
3. O navegador oferecerá opção de "Instalar App"
4. Aceite para instalar como app nativo

### 4. Configurar Permissões
A PWA solicitará permissões para:
- **Câmera**: Para scanner QR Code
- **Localização**: Para rastreamento GPS
- **Notificações**: Para alertas (opcional)

## 📱 Como Usar

### Scanner QR Code
1. Toque em "Iniciar Scanner"
2. Posicione a câmera sobre o QR Code do pedido
3. O código será lido automaticamente
4. Rastreamento iniciará imediatamente

### Entrada Manual
1. Digite o código do pedido no campo "Ex: CAP2405250630"
2. Toque em "Iniciar"
3. Sistema validará o pedido no servidor

### Durante o Rastreamento
- **Pausar**: Interrompe temporariamente o envio de localização
- **Retomar**: Volta a enviar localização
- **Finalizar Entrega**: Marca pedido como "Entregue"
- **Parar**: Interrompe completamente o rastreamento

### Configurações
- **Intervalo de atualização**: 10s, 30s, 1min ou 2min
- **URL do Servidor**: Endereço do backend i-CAP
- **Testar Conexão**: Verificar comunicação com servidor

## 🔧 Configurações Avançadas

### Personalizar Intervalos de Atualização
Edite o arquivo `app.js`:

```javascript
// Linha ~12
this.settings = {
    updateInterval: 30000, // 30 segundos (padrão)
    serverUrl: 'http://localhost:3000'
};
```

### Configurar URLs da API
Edite as URLs das APIs no arquivo `app.js`:

```javascript
// Validação de pedido
async validateOrder(orderId) {
    const response = await fetch(`${this.settings.serverUrl}/api/orders/validate/${orderId}`);
    return response.ok;
}

// Atualizar status
async updateOrderStatus(orderId, status) {
    const response = await fetch(`${this.settings.serverUrl}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    return response.ok;
}

// Enviar localização
async sendLocationToServer(locationData) {
    const response = await fetch(`${this.settings.serverUrl}/api/tracking/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationData)
    });
    return response.json();
}
```

## 🎨 Personalização Visual

### Cores do Tema
Edite o arquivo `styles.css`:

```css
/* Cores principais */
:root {
    --primary-color: #2563eb;
    --secondary-color: #667eea;
    --success-color: #10b981;
    --warning-color: #f59e0b;
    --danger-color: #ef4444;
}
```

### Gradiente de Fundo
```css
body {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

## 📊 Dados Enviados

### Estrutura da Localização
```javascript
{
    orderId: "CAP2405250630",
    latitude: -23.550520,
    longitude: -46.633308,
    accuracy: 10,           // Precisão em metros
    speed: 25.5,           // Velocidade em m/s (pode ser null)
    timestamp: "2024-05-25T14:30:00.000Z"
}
```

### Estrutura de Status
```javascript
{
    status: "Em Rota"      // ou "Entregue"
}
```

## 🔒 Segurança

### HTTPS Obrigatório
- PWAs requerem HTTPS em produção
- Geolocalização só funciona com HTTPS
- Service Workers só funcionam com HTTPS

### Validação de Dados
- Todos os dados são validados no frontend
- Códigos de pedido são verificados no servidor
- Localização tem verificação de precisão

## 🐛 Solução de Problemas

### Scanner QR Code Não Funciona
- Verificar permissão de câmera
- Testar em HTTPS
- Verificar se dispositivo tem câmera

### GPS Não Funciona
- Verificar permissão de localização
- Testar em ambiente externo
- Verificar se GPS está ativado

### Não Conecta com Servidor
- Verificar URL nas configurações
- Testar conexão com "Testar Conexão"
- Verificar se servidor está rodando

### App Não Instala
- Verificar se está em HTTPS
- Verificar se manifest.json está acessível
- Tentar em navegador diferente

## 🔄 Atualizações

### Versioning
Para atualizar a PWA:

1. Altere a versão no `sw.js`:
```javascript
const CACHE_NAME = 'icap-tracker-v1.0.1';
```

2. Altere a versão no `manifest.json`:
```json
{
    "version": "1.0.1"
}
```

3. O Service Worker atualizará automaticamente

## 📈 Próximas Funcionalidades

- [ ] Integração com n8n para automação
- [ ] Notificações push
- [ ] Histórico de entregas
- [ ] Relatórios de performance
- [ ] Modo escuro automático
- [ ] Suporte a múltiplos idiomas
- [ ] Integração com mapas
- [ ] Fotos de comprovação de entrega

## 🤝 Contribuição

Para contribuir com melhorias:

1. Faça fork do projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto faz parte do sistema i-CAP e segue a mesma licença do projeto principal.

---

**Desenvolvido para o sistema i-CAP 7** 🚛📱 