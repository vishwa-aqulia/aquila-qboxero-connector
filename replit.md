# Keystone Connector

## Overview

This is a multi-tenant accounting data connector service that integrates with QuickBooks Online (QBO) and Xero accounting platforms. The application handles OAuth2 authentication flows, pulls financial data (accounts, reports), and loads the normalized data into Google BigQuery for analytics and reporting.

The system consists of a React frontend for configuration and connection management, an Express.js backend that serves the frontend and proxies requests, and a Python FastAPI service that handles the actual OAuth flows, API integrations, and BigQuery data loading.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack React Query for server state
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite with HMR support

### Backend Architecture
- **Primary Server**: Express.js (Node.js) running on port 5000
  - Serves the React frontend (static files in production, Vite dev server in development)
  - Provides API endpoints that proxy to the Python connector service
  - Uses in-memory storage for configuration and connection state
  
- **Connector Service**: Python FastAPI running on port 8080
  - Spawned as a child process from the Express server
  - Handles OAuth2 flows for QBO and Xero
  - Manages token refresh and storage
  - Pulls data from accounting APIs
  - Loads data into BigQuery

### Data Flow
1. User configures OAuth credentials and GCP settings via the React dashboard
2. User initiates OAuth flow for QBO or Xero
3. Python connector handles OAuth callback, stores tokens
4. On sync, connector pulls financial data from accounting APIs
5. Data is transformed/flattened and loaded into BigQuery tables

### Database Layer
- **Connector Database**: SQLAlchemy with SQLite (configurable via DATABASE_URL)
  - Stores OAuth connections and tokens
  - Tracks sync run history
- **Frontend Storage**: In-memory (MemStorage class)
  - Stores configuration and connection metadata
- **Analytics Storage**: Google BigQuery
  - Destination for all accounting data (accounts, contacts, reports, etc.)

### Key Design Patterns
- **Proxy Pattern**: Express proxies requests to the Python connector, allowing unified frontend access
- **Repository Pattern**: Storage interface (`IStorage`) abstracts data persistence
- **Transform Layer**: Dedicated flatteners convert hierarchical accounting reports to flat BigQuery rows

## External Dependencies

### Third-Party APIs
- **QuickBooks Online API**: OAuth2 authentication, accounting data retrieval
- **Xero API**: OAuth2 authentication, accounting data retrieval

### Cloud Services
- **Google Cloud BigQuery**: Data warehouse for accounting data
  - Requires `GCP_PROJECT_ID`, `BQ_DATASET_ID` configuration
  - Service account credentials via `GCP_SERVICE_ACCOUNT_JSON` secret

### Required Environment Variables
- `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET`: QuickBooks OAuth credentials
- `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET`: Xero OAuth credentials
- `GCP_PROJECT_ID`: Google Cloud project ID
- `BQ_DATASET_ID`: BigQuery dataset for storing data
- `GCP_SERVICE_ACCOUNT_JSON`: Service account key JSON (as Replit secret)
- `DATABASE_URL`: PostgreSQL connection string (for Drizzle ORM)
- `CONNECTOR_DATABASE_URL`: SQLAlchemy connection string for Python connector

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit`: Database ORM and migrations
- `@tanstack/react-query`: Server state management
- `express`: HTTP server
- Radix UI primitives: Accessible UI components

### Key Python Packages
- `fastapi` / `uvicorn`: Python API framework
- `SQLAlchemy`: Python ORM
- `google-cloud-bigquery`: BigQuery client
- `requests`: HTTP client for API calls