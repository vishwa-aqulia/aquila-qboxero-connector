# QBO & Xero Connector

A multi-tenant accounting data connector that integrates with **QuickBooks Online (QBO)** and **Xero** accounting platforms. The application handles OAuth2 authentication, pulls financial data, and loads the normalized data into **Google BigQuery** for analytics and reporting.

## Features

- **OAuth2 Authentication** - Secure connection to QuickBooks Online and Xero
- **Multi-tenant Support** - Manage multiple business connections with unique labels
- **Data Sync** - Pull accounts, contacts, and financial reports from connected platforms
- **BigQuery Integration** - Automatically load normalized financial data into Google BigQuery
- **Dark/Light Mode** - Professional UI with theme toggle support
- **Credential Persistence** - Securely saves configuration across server restarts

## Quick Start

### 1. Configure Credentials

1. Open the app and go to the **Settings** tab
2. Enter your OAuth credentials:
   - **QBO Client ID** and **Client Secret** (from Intuit Developer Portal)
   - **Xero Client ID** and **Client Secret** (from Xero Developer Portal)
3. Enter your BigQuery settings:
   - **GCP Project ID**
   - **Dataset ID**
4. Click **Save Configuration**

### 2. Set Up OAuth Redirect URIs

In your **Intuit Developer Portal** (for QuickBooks):
1. Go to your app settings
2. Add this Redirect URI:
   ```
   https://YOUR-REPLIT-URL/oauth/qbo/callback
   ```

In your **Xero Developer Portal** (for Xero):
1. Go to your app settings
2. Add this Redirect URI:
   ```
   https://YOUR-REPLIT-URL/oauth/xero/callback
   ```

### 3. Connect Your Accounts

1. Go to the **Connections** tab
2. Click **Connect QuickBooks** or **Connect Xero**
3. Log in and authorize the connection
4. Your connection will appear in the Active Connections list

### 4. Sync Data

Once connected, click **Sync** on any active connection to pull the latest financial data into BigQuery.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│              (Dashboard, Settings, Connections)          │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                 Express.js Backend                       │
│            (API Routes, Proxy to Connector)              │
│                    Port 5000                             │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│              Python FastAPI Connector                    │
│     (OAuth Flows, API Integration, BigQuery Loading)     │
│                    Port 8080                             │
└─────────────────────────────────────────────────────────┘
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `QBO_CLIENT_ID` | QuickBooks OAuth Client ID |
| `QBO_CLIENT_SECRET` | QuickBooks OAuth Client Secret |
| `XERO_CLIENT_ID` | Xero OAuth Client ID |
| `XERO_CLIENT_SECRET` | Xero OAuth Client Secret |
| `GCP_PROJECT_ID` | Google Cloud Project ID |
| `BQ_DATASET_ID` | BigQuery Dataset ID |
| `BASE_URL` | Public URL of the app (for OAuth callbacks) |
| `GCP_SERVICE_ACCOUNT_JSON` | Service account credentials for BigQuery |

## Data Flow

1. **User configures credentials** via the Settings tab
2. **User initiates OAuth** for QuickBooks or Xero
3. **OAuth callback** stores tokens securely
4. **Sync triggered** - Connector pulls financial data from APIs
5. **Data transformed** and loaded into BigQuery tables

## BigQuery Tables

The connector creates and populates these tables in your dataset:

- `accounts` - Chart of accounts
- `contacts` - Customers and vendors
- `profit_and_loss` - Profit & Loss report data
- `balance_sheet` - Balance Sheet report data

## Tech Stack

**Frontend:**
- React with TypeScript
- Tailwind CSS + shadcn/ui
- TanStack React Query
- Wouter (routing)

**Backend:**
- Express.js (Node.js)
- Python FastAPI
- SQLAlchemy (token storage)
- Google Cloud BigQuery SDK

## Development

The app runs with a single command:

```bash
npm run dev
```

This starts:
- Express server on port 5000 (serves frontend + API)
- Python connector on port 8080 (OAuth + data sync)

## License

MIT
