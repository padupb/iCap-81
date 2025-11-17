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

## External Dependencies

- **Database**: PostgreSQL (Neon).
- **Cloud Storage**: Replit Object Storage, Google Drive.
- **Mapping Service**: Google Maps API.
- **XML Parsing**: `fast-xml-parser` (for NF-e XML processing).
- **ZIP Generation**: `jszip` (for creating ZIP files with multiple documents).
- **Authentication Libraries**: Passport.js, `express-session`.
- **Frontend Libraries**: React, Wouter, Radix UI, Tailwind CSS, TanStack Query.
- **Backend Libraries**: Express, Drizzle ORM, tsx, multer.