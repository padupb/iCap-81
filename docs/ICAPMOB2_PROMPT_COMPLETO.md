
# 📱 iCapMob2 - Documentação Completa para Desenvolvimento

## 📋 Sumário

1. [Visão Geral](#visão-geral)
2. [Requisitos do Sistema](#requisitos-do-sistema)
3. [Stack Tecnológica](#stack-tecnológica)
4. [Estrutura do Projeto](#estrutura-do-projeto)
5. [Banco de Dados Backend (i-CAP 8.1)](#banco-de-dados-backend)
6. [Funcionalidades por Perfil](#funcionalidades-por-perfil)
7. [Implementação Detalhada](#implementação-detalhada)
8. [Configuração e Deploy](#configuração-e-deploy)
9. [Checklist de Aceite](#checklist-de-aceite)

---

## 🎯 Visão Geral

O **iCapMob2** é um aplicativo mobile Android que se integra ao backend existente do sistema i-CAP 8.1. Ele permite que transportadores e recebedores executem suas funções principais de forma offline-first, com sincronização automática quando a conexão é restaurada.

### Objetivo Principal
- Alteração do status de carregado para "em rota" (com tracking GPS de hora em hora)
- Confirmação de recebimento (conforme aba drawer do sistema web)

---

## 🔧 Requisitos do Sistema

### Backend Existente
- **Sistema:** i-CAP 8.1 (já em produção)
- **Banco de Dados:** PostgreSQL (Neon Cloud)
- **Autenticação:** JWT com refresh token
- **Base URL da API:** https://icap81.replit.app/api (ajustável via env)

### Permissões Android Necessárias
- Câmera (QR Code + foto de NF)
- Fotos/Galeria (upload de documentos)
- Localização (foreground + background para tracking)

---

## 🛠️ Stack Tecnológica

### Frontend Mobile
- **Framework:** React Native + Expo (TypeScript)
- **Gerenciamento de Estado:** Redux Toolkit + RTK Query
- **Offline Storage:** expo-sqlite (prioridade) ou WatermelonDB
- **Background Tasks:** Expo Task Manager + Background Fetch + expo-location
- **QR Code:** expo-barcode-scanner
- **Upload de Imagem:** expo-image-picker
- **Armazenamento Seguro:** expo-secure-store (tokens JWT)

### Qualidade de Código
- **Linting:** ESLint + Prettier
- **Testes:** Jest + Testing Library
- **API Mocking:** MSW (Mock Service Worker)

---

## 📁 Estrutura do Projeto

```
iCapMob2/
├── app/
│   ├── api/                    # Configuração RTK Query
│   ├── features/
│   │   ├── auth/              # Login, logout, refresh token
│   │   ├── sync/              # Sincronização offline→online
│   │   ├── tracking/          # Rastreamento GPS transportador
│   │   ├── recebimento/       # Confirmação de recebimento
│   │   ├── scanner/           # Scanner QR Code
│   │   └── home/              # Dashboard por perfil
│   ├── components/            # Componentes reutilizáveis
│   ├── db/                    # Configuração SQLite local
│   ├── hooks/                 # Hooks customizados
│   └── utils/                 # Funções utilitárias
├── assets/                    # Imagens, fontes, etc.
├── app.json
├── app.config.js             # Variáveis de ambiente
├── eas.json                  # Configuração EAS Build
├── package.json
└── README.md
```

---

## 🗄️ Banco de Dados Backend (i-CAP 8.1)

### Tabelas Principais Utilizadas

#### `users`
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  role_id INTEGER REFERENCES user_roles(id),
  can_confirm_delivery BOOLEAN DEFAULT FALSE,
  can_create_order BOOLEAN DEFAULT FALSE,
  primeiro_login BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `orders` (Pedidos)
```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL UNIQUE,
  product_id INTEGER REFERENCES products(id),
  quantity DECIMAL(10,2) NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  purchase_order_id INTEGER REFERENCES purchase_orders(id),
  status VARCHAR(50) DEFAULT 'pending',
  is_urgent BOOLEAN DEFAULT FALSE,
  delivery_date DATE,
  documentoscarregados BOOLEAN DEFAULT FALSE,
  documentosinfo JSONB,
  foto_confirmacao TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Status Possíveis:**
- `pending` - Aguardando aprovação
- `approved` - Aprovado
- `in_transit` / `Em Rota` - Em trânsito
- `delivered` / `Entregue` - Entregue
- `cancelled` - Cancelado
- `rejected` - Rejeitado

#### `tracking_points` (Rastreamento GPS)
```sql
CREATE TABLE tracking_points (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  user_id INTEGER REFERENCES users(id),
  status VARCHAR(50) NOT NULL,
  comment TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 👥 Funcionalidades por Perfil

### 🚚 Perfil: TRANSPORTADOR

#### Fluxo Principal
1. **Escanear QR Code** → identifica pedido/carregamento
2. **Confirmar Carregamento** → muda status para "Em Rota"
3. **Rastreamento Automático** → grava coordenada GPS a cada 1 hora (background)
4. **Finalizar Entrega** → encerra tracking, marca como entregue

#### Tela Home (Dashboard)
- Botão: "Escanear Carregamento"
- Botão: "Iniciar Rota" (se houver carregamento confirmado)
- Botão: "Finalizar Entrega"
- Indicadores: Online/Offline, Status da Rota, Fila de Sync

### 📦 Perfil: RECEBEDOR

#### Fluxo Principal
1. **Escanear QR Code** → identifica pedido
2. **Upload de Nota Fiscal** → câmera ou galeria (multipart/form-data)
3. **Confirmar Recebimento** → formulário com itens, quantidades, observações

#### Tela Home (Dashboard)
- Botão: "Confirmar Recebimento"
- Botão: "Escanear NF"
- Botão: "Upload NF"
- Indicadores: Online/Offline, Fila de Sync

---

## 🔧 Implementação Detalhada

### 1. Autenticação

#### Login (POST /api/auth/login)
```typescript
// Request
{
  email: string,
  password: string
}

// Response
{
  accessToken: string,
  refreshToken: string,
  role: "TRANSPORTADOR" | "RECEBEDOR",
  user: {
    id: number,
    name: string,
    email: string,
    companyId: number
  }
}
```

#### Armazenamento Seguro
```typescript
import * as SecureStore from 'expo-secure-store';

// Salvar tokens
await SecureStore.setItemAsync('accessToken', token);
await SecureStore.setItemAsync('refreshToken', refreshToken);

// Recuperar
const token = await SecureStore.getItemAsync('accessToken');
```

#### Interceptor RTK Query (Auto-refresh)
```typescript
import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);
  
  if (result.error?.status === 401) {
    // Tentar refresh
    const refreshResult = await baseQuery('/auth/refresh', api, extraOptions);
    
    if (refreshResult.data) {
      // Atualizar token e tentar novamente
      await SecureStore.setItemAsync('accessToken', refreshResult.data.accessToken);
      result = await baseQuery(args, api, extraOptions);
    } else {
      // Logout se refresh falhar
      await logout();
    }
  }
  
  return result;
};
```

---

### 2. Banco de Dados Local (SQLite)

#### Esquema de Tabelas

```typescript
// Tabela: usuarios
usuarios(
  id INTEGER PRIMARY KEY,
  nome TEXT,
  email TEXT,
  role TEXT,
  updatedAt TEXT
)

// Tabela: tracking_points
tracking_points(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedidoId INTEGER,
  lat REAL,
  lon REAL,
  accuracy REAL,
  createdAt TEXT,
  syncedAt TEXT NULL,
  status TEXT DEFAULT 'pending'  // 'pending' | 'synced' | 'error'
)

// Tabela: recebimentos
recebimentos(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedidoId INTEGER,
  status TEXT,
  observacao TEXT,
  updatedAt TEXT,
  syncedAt TEXT NULL
)

// Tabela: recebimento_itens
recebimento_itens(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recebimentoId INTEGER,
  insumoId INTEGER,
  descricao TEXT,
  qtdPrevista REAL,
  qtdConfirmada REAL,
  unidadeMedida TEXT
)

// Tabela: anexos (NF/imagens)
anexos(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entidade TEXT,           // 'recebimento' | 'tracking'
  entidadeId INTEGER,
  uriLocal TEXT,
  remoteUrl TEXT NULL,
  mime TEXT,
  createdAt TEXT,
  syncedAt TEXT NULL,
  status TEXT DEFAULT 'pending'
)
```

---

### 3. Rastreamento GPS (Transportador)

#### Configuração de Background Task

```typescript
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data as any;
    const location = locations[0];
    
    // Salvar no SQLite
    await db.runAsync(
      `INSERT INTO tracking_points (pedidoId, lat, lon, accuracy, createdAt, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [currentOrderId, location.coords.latitude, location.coords.longitude, 
       location.coords.accuracy, new Date().toISOString()]
    );
  }
});

// Iniciar tracking
async function startLocationTracking(pedidoId: number) {
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 60 * 60 * 1000, // 1 hora
    distanceInterval: 0,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'iCapMob2 - Rastreamento Ativo',
      notificationBody: 'Registrando sua localização'
    }
  });
}

// Parar tracking
async function stopLocationTracking() {
  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}
```

---

### 4. Upload de Nota Fiscal (Recebedor)

#### Captura de Imagem

```typescript
import * as ImagePicker from 'expo-image-picker';

async function captureNF() {
  // Solicitar permissão
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  
  if (status !== 'granted') {
    alert('Permissão de câmera necessária');
    return;
  }
  
  // Capturar foto
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    allowsEditing: true,
    aspect: [4, 3]
  });
  
  if (!result.canceled) {
    return result.assets[0].uri;
  }
}
```

#### Upload Multipart

```typescript
async function uploadNF(pedidoId: number, fileUri: string) {
  const formData = new FormData();
  
  formData.append('file', {
    uri: fileUri,
    type: 'image/jpeg',
    name: `nf-${pedidoId}-${Date.now()}.jpg`
  } as any);
  
  const response = await fetch(
    `${API_BASE_URL}/recebimentos/${pedidoId}/nf-upload`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData
    }
  );
  
  return response.json();
}
```

---

### 5. Sincronização Offline→Online

#### Sincronizador Principal

```typescript
class SyncService {
  async syncAll() {
    if (!await this.isOnline()) {
      console.log('Offline - sync cancelado');
      return;
    }
    
    // 1. Enviar anexos (NF)
    await this.syncAnexos();
    
    // 2. Enviar tracking_points
    await this.syncTrackingPoints();
    
    // 3. Enviar recebimentos
    await this.syncRecebimentos();
    
    // Atualizar lastSyncAt
    await AsyncStorage.setItem('lastSyncAt', new Date().toISOString());
  }
  
  async syncTrackingPoints() {
    const pendingPoints = await db.getAllAsync(
      `SELECT * FROM tracking_points WHERE status = 'pending' ORDER BY createdAt ASC`
    );
    
    for (const point of pendingPoints) {
      try {
        const response = await fetch(`${API_BASE_URL}/tracking_points`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            pedidoId: point.pedidoId,
            lat: point.lat,
            lon: point.lon,
            accuracy: point.accuracy,
            timestamp: point.createdAt
          })
        });
        
        if (response.ok) {
          // Marcar como sincronizado
          await db.runAsync(
            `UPDATE tracking_points SET status = 'synced', syncedAt = ? WHERE id = ?`,
            [new Date().toISOString(), point.id]
          );
        }
      } catch (error) {
        console.error('Erro sync tracking point:', error);
        // Incrementar retryCount, aplicar backoff exponencial
      }
    }
  }
  
  async isOnline(): Promise<boolean> {
    const netInfo = await NetInfo.fetch();
    return netInfo.isConnected === true;
  }
}
```

---

### 6. Contratos de API (Backend i-CAP 8.1)

#### Autenticação
```
POST /api/auth/login
Body: { email, password }
Response: { accessToken, refreshToken, role, user }

POST /api/auth/refresh
Body: { refreshToken }
Response: { accessToken }

GET /api/auth/me
Headers: { Authorization: Bearer {token} }
Response: { user }
```

#### Carregamentos/Pedidos
```
GET /api/carregamentos/:codigo
Response: { pedidoId, orderId, productId, quantity, companyId, status, ... }

POST /api/carregamentos/:pedidoId/confirmar-carregamento
Response: { status: "Em Rota" }
```

#### Tracking
```
POST /api/tracking_points
Body: [{ pedidoId, lat, lon, accuracy, timestamp }]
Response: { success: true }
```

#### Recebimento
```
POST /api/recebimentos/:id/confirmar
Body: { itens: [...], observacao }
Response: { success: true }

POST /api/recebimentos/:id/nf-upload
Content-Type: multipart/form-data
Body: file, metadata
Response: { success: true, url }
```

---

## ⚙️ Configuração e Deploy

### 1. Criar Projeto Expo

```bash
npx create-expo-app iCapMob2 --template blank-typescript
cd iCapMob2
```

### 2. Instalar Dependências

```bash
# Core
npm install @reduxjs/toolkit react-redux @react-native-async-storage/async-storage

# Expo modules
npx expo install expo-location expo-task-manager expo-background-fetch expo-barcode-scanner expo-image-picker expo-file-system expo-secure-store expo-sqlite

# Dev tools
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native msw
```

### 3. Configurar Variáveis de Ambiente

**app.config.js:**
```javascript
export default {
  expo: {
    name: "iCapMob2",
    slug: "icapmob2",
    version: "1.0.0",
    extra: {
      apiBaseUrl: process.env.API_BASE_URL || "https://icap81.replit.app/api",
      trackingIntervalMinutes: process.env.TRACKING_INTERVAL_MINUTES || 60,
      imageMaxWidth: process.env.IMAGE_MAX_WIDTH || 1600
    },
    android: {
      package: "com.icap.mob2",
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    }
  }
};
```

### 4. Configurar EAS Build

**eas.json:**
```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

### 5. Build e Deploy

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login
eas login

# Build Preview (APK)
eas build -p android --profile preview

# Build Production (AAB)
eas build -p android --profile production
```

---

## ✅ Checklist de Aceite

### Funcionalidades Básicas
- [ ] Login com roles distintas (TRANSPORTADOR/RECEBEDOR)
- [ ] Redirecionamento correto por perfil
- [ ] Scanner QR funcional, resolvendo pedido/carregamento

### Transportador
- [ ] Confirmar carregamento → status "Em Rota"
- [ ] Grava coordenada GPS a cada 1h em background
- [ ] Finalizar entrega encerra tarefa e libera novo scan

### Recebedor
- [ ] Upload de NF (câmera/galeria) com envio multipart
- [ ] Formulário "Confirmar recebimento" com itens e quantidades
- [ ] Envio e sincronização de confirmação

### Offline-First
- [ ] App opera sem internet, mantém dados e fila
- [ ] Ao voltar conexão, sincroniza automaticamente
- [ ] Indicador visual de status online/offline
- [ ] Fila de sincronização visível ao usuário

### Segurança
- [ ] Tokens seguros em expo-secure-store
- [ ] Refresh automático de token no 401
- [ ] Tratamento de sessão expirada

### Deploy
- [ ] APK/AAB gerado via EAS
- [ ] APK instalável em Android
- [ ] Permissões solicitadas corretamente

---

## 📞 Suporte Técnico

### Documentação de Referência
- [Expo Documentation](https://docs.expo.dev/)
- [React Native](https://reactnative.dev/)
- [Redux Toolkit](https://redux-toolkit.js.org/)
- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)

### Contatos
- **Backend API:** https://icap81.replit.app

---

## 🚀 Próximos Passos

1. Criar projeto Expo conforme estrutura acima
2. Implementar autenticação e armazenamento de tokens
3. Criar banco SQLite local com esquema definido
4. Implementar scanner QR e integração com API
5. Desenvolver fluxo de transportador (tracking GPS)
6. Desenvolver fluxo de recebedor (upload NF + confirmação)
7. Implementar sincronizador offline→online
8. Testar em modo avião e online
9. Gerar APK via EAS Build
10. Documentar processo de instalação

---

**Versão do Documento:** 1.0  
**Data:** Janeiro 2025  
**Status:** Pronto para desenvolvimento
