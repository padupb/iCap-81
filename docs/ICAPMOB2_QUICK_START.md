
# 🚀 iCapMob2 - Guia Rápido de Início

## Passo a Passo Completo

### 1️⃣ Criar Projeto (5 min)

```bash
# Criar projeto Expo
npx create-expo-app iCapMob2 --template blank-typescript
cd iCapMob2

# Instalar dependências principais
npm install @reduxjs/toolkit react-redux @react-native-async-storage/async-storage

# Instalar módulos Expo
npx expo install expo-location expo-task-manager expo-background-fetch \
  expo-barcode-scanner expo-image-picker expo-file-system \
  expo-secure-store expo-sqlite

# Dev tools
npm install --save-dev jest @testing-library/react-native eslint prettier
```

### 2️⃣ Estrutura de Pastas (2 min)

```bash
mkdir -p app/{api,features/{auth,sync,tracking,recebimento,scanner,home},components,db,hooks,utils}
mkdir -p assets
```

### 3️⃣ Configurar Ambiente (3 min)

Criar **app.config.js:**
```javascript
export default {
  expo: {
    name: "iCapMob2",
    slug: "icapmob2",
    version: "1.0.0",
    extra: {
      apiBaseUrl: "https://icap81.replit.app/api",
      trackingIntervalMinutes: 60
    },
    android: {
      package: "com.icap.mob2",
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE"
      ]
    }
  }
};
```

### 4️⃣ Testar Localmente

```bash
# Instalar Expo Go no celular Android
# Escanear QR Code que aparece ao rodar:
npx expo start
```

### 5️⃣ Build APK (quando pronto)

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login e configurar
eas login
eas build:configure

# Gerar APK
eas build -p android --profile preview
```

## 📝 Templates de Código Base

### Store Redux (app/api/store.ts)
```typescript
import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';
import authReducer from '../features/auth/authSlice';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### API Base (app/api/api.ts)
```typescript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const baseQuery = fetchBaseQuery({
  baseUrl: Constants.expoConfig?.extra?.apiBaseUrl,
  prepareHeaders: async (headers) => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),
  }),
});

export const { useLoginMutation } = api;
```

### SQLite Setup (app/db/database.ts)
```typescript
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('icapmob2.db');

export async function initDatabase() {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS tracking_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedidoId INTEGER,
      lat REAL,
      lon REAL,
      accuracy REAL,
      createdAt TEXT,
      syncedAt TEXT,
      status TEXT DEFAULT 'pending'
    );
    
    CREATE TABLE IF NOT EXISTS recebimentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedidoId INTEGER,
      status TEXT,
      observacao TEXT,
      updatedAt TEXT,
      syncedAt TEXT
    );
  `);
}

export default db;
```

## 🎯 Ordem de Implementação Recomendada

1. ✅ Configuração inicial e estrutura
2. ✅ Autenticação (login, tokens, secure store)
3. ✅ Scanner QR Code
4. ✅ Dashboard por perfil (transportador/recebedor)
5. ✅ Banco SQLite local
6. ✅ Tracking GPS (transportador)
7. ✅ Upload NF (recebedor)
8. ✅ Confirmação recebimento
9. ✅ Sincronizador offline→online
10. ✅ Testes e build final

## 📞 Comandos Úteis

```bash
# Desenvolvimento
npx expo start              # Iniciar servidor dev
npx expo start --clear      # Limpar cache
npx expo install --check    # Verificar dependências

# Build
eas build -p android --profile preview    # APK preview
eas build -p android --profile production # AAB produção

# Testes
npm test                    # Rodar testes
npm run lint                # Verificar código
```

## ⚠️ Pontos de Atenção

1. **Background Location:** Testar em dispositivo físico (não funciona bem em emulador)
2. **Permissões:** Sempre pedir permissões antes de usar recursos
3. **Offline-first:** Testar em modo avião regularmente
4. **Battery Optimization:** Android pode matar background tasks - configurar adequadamente

---

Documentação completa em: `ICAPMOB2_PROMPT_COMPLETO.md`
