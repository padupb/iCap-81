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
- **Order Management**: Creation, tracking (real-time via Google Maps), status history, and rescheduling.
- **Purchase Order Management**: Creation, item management, and status control.
- **Document Management**: Upload and download of various document types (e.g., NF-e PDF/XML, certificates, photos). Automatic quantity extraction from NF-e XML.
- **Document Export (ZIP)**: Download all documents from filtered orders in a single ZIP file, organized by order ID.
- **QR Codes**: Automatic generation for quick access to order details.
- **Access Control**: Role-based system (`KeyUser` with full access, mobile authentication via Bearer token).
- **Master Data Management (KeyUser)**: CRUD operations for company categories, user roles, and units of measure.

### System Design Choices
- **Object Storage API Pattern**: All storage methods return `{ok: boolean, value: any}` or `{ok: boolean, error: string}`. A utility function `extractBufferFromStorageResult()` standardizes buffer extraction.
- **Document Download Fallback**: Prioritizes `documentos_info`, then Object Storage patterns, and finally local filesystem.
- **Order Rescheduling & Cancellation Rules**: Requires at least 3 days' notice from delivery date and specific order statuses (cannot be "Em Rota" or "Em transporte").
- **Database Safety**: Strict avoidance of manual SQL migrations; `npm run db:push` is the designated tool for schema synchronization.
- **Code Standards**: Strict TypeScript mode, Drizzle ORM for all database interactions, robust error handling with try/catch, and informative logging.

## External Dependencies

- **Database**: PostgreSQL (Neon).
- **Cloud Storage**: Replit Object Storage, Google Drive.
- **Mapping Service**: Google Maps API.
- **XML Parsing**: `fast-xml-parser` (for NF-e XML processing).
- **ZIP Generation**: `jszip` (for creating ZIP files with multiple documents).
- **Authentication Libraries**: Passport.js, `express-session`.
- **Frontend Libraries**: React, Wouter, Radix UI, Tailwind CSS, TanStack Query.
- **Backend Libraries**: Express, Drizzle ORM, tsx, multer, jszip.

## Recent Changes

### October 22, 2025 - Afternoon
- ✅ **Novo Sistema de Geração de IDs de Pedidos (CNI)**
  - Alterado prefixo de "CAP" para "CNI" (Consorcio Nova imigrantes)
  - Novo formato de ID: CNI{DD}{MM}{YY}{NNNN}
  - Exemplo: CNI2210250001 (22/10/2025, primeiro pedido do dia)
  - Estrutura: CNI (prefixo) + data (DDMMAA) + sequencial diário de 4 dígitos (0001-9999)
  - Contador sequencial reinicia automaticamente todos os dias
  - Atualizado em ambas implementações:
    - `DatabaseStorage.generateOrderId()` - para banco de dados PostgreSQL
    - `MemStorage.generateOrderId()` - para testes e ambiente de memória
  - Configuração padrão `order_id_pattern` atualizada para "CNI{DD}{MM}{YY}{NNNN}"
  - Garante unicidade através de verificação de duplicatas no banco
  - Architect review: PASS - ambas implementações geram IDs consistentes com reinício diário correto

### October 17, 2025 - Afternoon  
- ✅ **Critical Bug Fixes - Order Table & Settings**
  - Fixed OrderDetailDrawer crash: added null/undefined check for deliveryDate before calling .toString()
  - Corrected API data mapping from snake_case to camelCase across all order table operations:
    - Table display (order_id, product_id, supplier_id, delivery_date)
    - Column sorting (ID, product, supplier, deliveryDate)
    - Filters (product, date range)
    - Data export (CSV/XLSX)
  - Added missing `/api/settings` endpoints (GET, GET/:key, POST, PUT) to resolve "Failed to fetch settings" error
  - All endpoints tested and confirmed working (200/304 responses)
  - **Resolved "Invalid time value" errors throughout OrderDetailDrawer**:
    - Created `createValidDate()` helper function to safely handle date conversions
    - Added validation checks before all `new Date()` calls on deliveryDate
    - Protected all 6 locations where deliveryDate was used without validation
    - Fixed in: canRequestReschedule(), tab disable logic, QR code section, and document upload sections
  - **Fixed date formatting across entire frontend**:
    - Improved `formatDate()` function to handle multiple date formats from database
    - Now correctly processes: "YYYY-MM-DD", "YYYY-MM-DD HH:MM:SS", and "YYYY-MM-DDTHH:MM:SSZ"
    - Eliminates timezone conversion issues by extracting only date portion
    - Ensures consistent DD/MM/YYYY display format throughout the app
  - Architect review: PASS - flows function correctly, suggested future improvements for typed normalization helpers

### October 15, 2025 - Evening
- ✅ **Batch Document Download in ZIP Format**
  - Installed `jszip` library for ZIP file generation
  - Created POST `/api/pedidos/download-zip` endpoint that:
    - Accepts array of order IDs
    - Fetches all documents (nota_pdf, nota_xml, certificado_pdf, foto_confirmacao) for each order
    - Organizes files in folders by order ID within the ZIP
    - Returns a single ZIP file for download
  - Updated frontend "Download Documents" button to generate ZIP instead of individual downloads
  - ZIP file organization: `{orderId}/{filename}` for each order
  - ZIP filename format: `documentos_pedidos_YYYYMMDD.zip`
  - Includes delivery confirmation photos when available
  - Improved user experience: single download instead of multiple files
  - Fixed browser download trigger with credentials and DOM cleanup delay

### October 15, 2025 - Afternoon
- ✅ **Order Rescheduling & Cancellation Business Rules**
  - Implemented 3-day advance notice requirement for rescheduling and cancellations
  - Created `getDaysDifference()` utility function using `Math.floor` for accurate day calculation
  - Backend validation added to both cancellation and rescheduling endpoints
  - Frontend updated to hide action buttons when conditions not met
  - Status restrictions: blocks "Em Rota", "Em transporte", "Entregue", "Cancelado"
  - Protection against bypass when delivery_date is null

## API Endpoints

### Document Management
- `GET /api/pedidos/:id/documentos/:tipo` - Download individual document
  - Supported types: nota_pdf, nota_xml, certificado_pdf, foto_nota
  - Fallback strategy: documentos_info → Object Storage → local filesystem
  
- `POST /api/pedidos/download-zip` - Download documents as ZIP
  - Body: `{ pedidoIds: number[] }`
  - Returns ZIP file with all documents organized by order
  - Filters out orders with status "Registrado" or "Cancelado"
