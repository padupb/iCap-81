# i-CAP 5.0 - Sistema de Gestão Logística

## Overview
i-CAP 5.0 is a comprehensive logistics management system built with React and Node.js/Express. Its primary purpose is to streamline logistics operations through real-time tracking, robust document management (including QR codes), and a role-based access control system. The project aims to provide an efficient and transparent solution for managing orders, purchases, and deliveries, with a focus on enhancing operational visibility and control.

## User Preferences
- I prefer clear and concise explanations.
- I appreciate direct answers and actionable advice.
- Please ask for confirmation before implementing significant changes or refactoring large parts of the codebase.
- When suggesting code modifications, provide the rationale behind the changes.
- I prefer to avoid manual SQL migrations; always use Drizzle ORM for schema synchronization.
- Do not make changes to the existing structure of the `shared/schema.ts` without prior discussion.
- I expect detailed logging for critical operations, especially for data modifications.

## System Architecture

### UI/UX Decisions
- **Framework**: React 18 with TypeScript.
- **Routing**: Wouter for lightweight client-side routing.
- **UI Components**: Radix UI for accessible and customizable components, styled with Tailwind CSS for utility-first styling.
- **Maps**: Google Maps API for real-time tracking visualization.

### Technical Implementations
- **Frontend**: `client/src/`
    - **State Management**: TanStack Query for server-state management and Context API for local state.
- **Backend**: `server/`
    - **Runtime**: Node.js with TypeScript (`tsx`).
    - **ORM**: Drizzle ORM for PostgreSQL.
    - **Authentication**: Passport.js with `express-session` for user authentication.
    - **Storage**: Replit Object Storage (primary) and Google Drive for document storage.
- **Shared Code**: `shared/schema.ts` defines the Drizzle ORM database schema.

### Feature Specifications
- **Order Management**: Creation, real-time tracking, status history, and rescheduling.
- **Purchase Order Management**: Creation, item management, and status control.
- **Document Management**: Upload/download of various document types (e.g., NF-e PDF/XML, certificates, photos). Automatic quantity extraction from NF-e XML.
- **Document Export (ZIP)**: Download all documents from filtered orders in a single ZIP file, organized by order ID.
- **QR Codes**: Automatic generation for quick access to order details.
- **Access Control**: Role-based system (`KeyUser` with full access, mobile authentication via Bearer token), including granular permissions by specific construction sites and special unrestricted access for "Nova Rota do Oeste" company.
- **Master Data Management (KeyUser)**: CRUD operations for company categories, user roles, and units of measure.
- **Automated ID Generation**: System generates unique order IDs with a configurable pattern (e.g., CNI{DD}{MM}{YY}{NNNN}) including date and daily sequential number, with robust protection against duplicates and race conditions.

### System Design Choices
- **Object Storage API Pattern**: All storage methods return `{ok: boolean, value: any}` or `{ok: boolean, error: string}`.
- **Document Download Fallback**: Prioritizes `documentos_info`, then Object Storage patterns, and finally local filesystem.
- **Order Rescheduling & Cancellation Rules**: Requires at least 3 days' notice from delivery date and specific order statuses (cannot be "Em Rota" or "Em transporte").
- **Database Safety**: Strict avoidance of manual SQL migrations; `npm run db:push` is the designated tool for schema synchronization.
- **Code Standards**: Strict TypeScript mode, Drizzle ORM for all database interactions, robust error handling with try/catch, and informative logging.

## Recent Changes

### 2026-01-28: Parâmetros do sistema tornados configuráveis
- **Novos parâmetros no menu KeyUser > Configurações Gerais:**
  - `cancel_min_days`: Dias mínimos de antecedência para cancelar um pedido (padrão: 3)
  - `reschedule_min_days`: Dias mínimos de antecedência para reprogramar entrega (padrão: 3)
  - `default_reset_password`: Senha padrão ao resetar senha de usuário (padrão: icap123)
- **Parâmetros já existentes também configuráveis:**
  - `urgent_days_threshold`: Dias para considerar pedido urgente (padrão: 7)
  - `approval_timeout_hours`: Tempo limite para aprovação em horas (padrão: 48)
  - `app_name`: Nome da aplicação
  - `google_maps_api_key`: Chave da API Google Maps
- **Arquivos modificados:** `SettingsContext.tsx`, `_Settings.tsx`, `OrderDetailDrawer.tsx`, `routes.ts`
- **Segurança:** Senha padrão não é mais exposta nos logs ou respostas da API

### 2026-01-05: Correção na filtragem de Ordens de Compra
- **Problema**: Alguns usuários não conseguiam ver ordens de compra na página "Ordem de compras" enquanto outros viam perfeitamente.
- **Causa raiz**: A lógica de filtragem comparava incorretamente o campo `cnpj` da tabela `ordens_compra` (que contém o CNPJ da **obra de destino**) com o CNPJ da empresa do usuário (empresa **fornecedora**). Esses valores nunca correspondiam.
- **Solução**: Ajustada a lógica nos endpoints `/api/ordens-compra` e `/api/purchase-orders` para verificar:
  1. Se o usuário é da empresa fornecedora (`empresa_id = companyId`)
  2. OU se o usuário é da empresa obra de destino (`obra.id = companyId` via JOIN)
  3. OU fallback: se o CNPJ da obra corresponde ao CNPJ da empresa do usuário
- **Arquivos modificados**: `server/routes.ts` (linhas ~4035-4042 e ~4195-4204)

## External Dependencies

- **Database**: PostgreSQL (Neon).
- **Cloud Storage**: Replit Object Storage, Google Drive.
- **Mapping Service**: Google Maps API.
- **XML Parsing**: `fast-xml-parser` (for NF-e XML processing).
- **ZIP Generation**: `jszip` (for creating ZIP files with multiple documents).
- **Authentication Libraries**: Passport.js, `express-session`.
- **Frontend Libraries**: React, Wouter, Radix UI, Tailwind CSS, TanStack Query.
- **Backend Libraries**: Express, Drizzle ORM, tsx, multer.