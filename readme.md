# Inventory & Billing

A full-stack inventory and billing application built with FastAPI, React, and PostgreSQL. Products, carts, invoices, GST, payments, and PDF invoices are managed in one workspace.

## Stack

### Backend
- FastAPI
- PostgreSQL on Neon
- SQLAlchemy + psycopg2
- Redis (optional cache)
- ReportLab PDF invoices

### Frontend
- React 18
- React Router
- Axios

### Deployment
- Vercel for the React frontend
- Render for the FastAPI backend
- Neon for PostgreSQL
- Optional Render Key Value for Redis

## Project Structure

```
.
├── backend/
│   ├── routers/
│   ├── services/
│   ├── tests/
│   ├── Dockerfile
│   ├── config.py
│   ├── database.py
│   ├── main.py
│   ├── migrations.py
│   ├── models.py
│   └── schemas.py
├── frontend/
│   ├── public/
│   ├── src/
│   ├── vercel.json
│   └── package.json
├── render.yaml
├── vercel.json
├── docker-compose.yml
├── requirements.txt
└── Jenkinsfile
```

## Local Development

### Prerequisites

- Docker
- Node.js 18+
- Python 3.12
- A Neon project for cloud deployment

### Start the backend

```bash
cp .env.example .env
docker compose up -d --build
```

The API runs at `http://localhost:8000`. Health check: `http://localhost:8000/health`. API docs: `http://localhost:8000/docs`.

### Start the frontend

```bash
cd frontend
cp .env.example .env
npm install
npm start
```

The app runs at `http://localhost:3000`.

## Configuration

Backend settings are read from environment variables. `.env.example` contains the complete local set.

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | required | PostgreSQL URL. Neon pooled URLs work directly. |
| `ENVIRONMENT` | `development` | Runtime environment label. |
| `CORS_ORIGINS` | localhost origins | Comma-separated exact frontend origins. |
| `CORS_ORIGIN_REGEX` | `https://.*\.vercel\.app` | Regex for Vercel preview deployments. |
| `BUSINESS_NAME` | `My Business` | Business name on invoices and in the UI. |
| `BUSINESS_ADDRESS` | empty | Invoice business address. |
| `BUSINESS_PHONE` | empty | Invoice business phone. |
| `BUSINESS_EMAIL` | empty | Invoice business email. |
| `BUSINESS_GSTIN` | empty | Business GSTIN. |
| `BUSINESS_STATE` | empty | Business state. |
| `GST_RATE` | `0` | Default GST percentage. |
| `GST_MODE` | `cgst_sgst` | `cgst_sgst` or `igst`. |
| `INVOICE_PREFIX` | `INV` | Invoice number prefix. |
| `CURRENCY` | `INR` | Currency label. |
| `PAYMENT_TERMS` | empty | Invoice payment terms. |
| `THANK_YOU_MESSAGE` | `Thank you for your business.` | Invoice footer. |
| `DEFAULT_LOW_STOCK_THRESHOLD` | `5` | Default low-stock warning level. |
| `CACHE_TTL` | `60` | Redis cache lifetime in seconds. |
| `REDIS_DISABLED` | `0` | Set to `1` to run without Redis. |
| `REDIS_HOST` | `localhost` | Redis host. |
| `REDIS_PORT` | `6379` | Redis port. |
| `DB_POOL_SIZE` | `5` | SQLAlchemy pool size. |
| `DB_MAX_OVERFLOW` | `10` | SQLAlchemy pool overflow. |
| `DB_POOL_RECYCLE` | `300` | Recycle connections after idle periods. |

Frontend configuration:

| Variable | Purpose |
|----------|---------|
| `REACT_APP_API_URL` | Render backend URL, for example `https://billing-inventory-api.onrender.com`. |

Database migrations run automatically when the backend starts. There is no Alembic step to run manually.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/config` | Business, GST, and invoice settings |
| GET | `/products/` | List products with filters |
| GET | `/products/stats` | Inventory statistics |
| GET | `/products/categories` | Product categories |
| GET | `/products/{id}` | Get a product |
| POST | `/products/` | Create a product |
| PUT | `/products/{id}` | Update a product |
| DELETE | `/products/{id}` | Delete a product |
| POST | `/invoices/checkout` | Create an invoice and deduct stock |
| GET | `/invoices/` | List and filter invoices |
| GET | `/invoices/{id}` | Get invoice details |
| PATCH | `/invoices/{id}/payment` | Update payment amount/status |
| GET | `/invoices/{id}/pdf` | Download the PDF invoice |
| POST | `/invoices/` | Legacy invoice creation endpoint |

Invoice numbers are generated only by the backend. Invoices are permanent; deletion returns `403`.

## Deploy to Neon + Render + Vercel

### 1. Neon

1. Create a Neon project and database.
2. Copy the pooled connection string.
3. Keep `sslmode=require` in the URL. The backend accepts `postgres://`, `postgresql://`, or `postgresql+psycopg2://`.
4. Use this value as `DATABASE_URL` on Render.

Tables are created automatically on the first backend start.

### 2. Render

The included `render.yaml` defines a Docker web service.

1. In Render, create a new Blueprint and select this repository.
2. Enter the prompted secret values:
   - `DATABASE_URL`: the Neon pooled connection string.
   - Business details and `GST_RATE`.
3. Deploy the service.
4. Confirm `https://<render-service>.onrender.com/health` returns `{"status":"ok"}`.

Optionally set `region` in `render.yaml` to a region close to your Neon database, such as `singapore`, before creating the Blueprint. If creating the service manually instead of using the Blueprint:

- Runtime: Docker
- Dockerfile path: `backend/Dockerfile`
- Docker context: repository root
- Health check path: `/health`
- Set `REDIS_DISABLED=1` unless you provision Redis.
- Render provides `PORT`; the Docker image binds to it automatically.

### 3. Vercel

1. Import this repository into Vercel.
2. Set the Root Directory to `frontend`.
3. Add `REACT_APP_API_URL` with the Render backend URL, without a trailing slash.
4. Deploy. Vercel uses `frontend/vercel.json` for builds and SPA route rewrites.

The root `vercel.json` also supports deploying from the repository root instead of setting `frontend` as the root directory.

Direct visits to `/inventory`, `/cart`, `/billing`, and `/billing/:invoiceId` work because all routes rewrite to `index.html`.

Vercel deployments under `*.vercel.app`, including preview URLs, are allowed by `CORS_ORIGIN_REGEX`. If you use a custom Vercel domain, add it to `CORS_ORIGINS` on Render, for example `https://billing.example.com`, then restart the backend.

Render free instances can take time to wake up. The frontend waits up to 90 seconds for API requests.

### Redis

Redis is optional. For a Render Key Value instance, set `REDIS_DISABLED=0` and provide `REDIS_HOST` and `REDIS_PORT`. Without Redis, the application runs normally with uncached product reads.

## Architecture

```
Browser
  |
  v
Vercel (React SPA)
  |
  v
Render (FastAPI + Docker)
  |-- Neon (PostgreSQL)
  `-- Redis (optional)
```

## Tests

Backend tests use SQLite and disable Redis:

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements-dev.txt
.venv/bin/python -m pytest backend/tests -q
```

Frontend tests and production build:

```bash
cd frontend
CI=true npm test -- --watchAll=false
npm run build
```

The optional Jenkins pipeline runs backend tests and the frontend build. Deployments are handled by Render and Vercel from Git.

## Author

Siddesh Navthale

- GitHub: https://github.com/sidxhdev
- Blog: https://siddeshblogs.hashnode.dev
