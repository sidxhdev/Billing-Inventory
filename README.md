# Billing-Inventory

Billing-Inventory is a full-stack billing and inventory management application with a Python backend and JavaScript frontend.

## Technology stack

- **Frontend:** JavaScript, React, CSS
- **Backend:** Python
- **Database:** Relational database configured through environment variables
- **Containerization:** Docker and Docker Compose
- **Continuous integration:** Jenkins
- **Deployment targets:** AWS EC2, AWS S3, and an AWS relational database service (RDBS/RDS)

## Features

- Product and inventory management
- Invoice management
- PDF invoice generation
- Backend API with automated tests
- React-based frontend
- Environment-based configuration for local and production deployments

## Architecture and deployment

A typical production deployment can use the following architecture:

```text
                         GitHub repository
                                  |
                                  v
                    +---------------------------+
                    | Jenkins controller/master  |
                    | Pipeline orchestration     |
                    +-------------+-------------+
                                  |
                         schedules build on
                                  v
                    +---------------------------+
                    | Jenkins build agent        |
                    | Test, build, package       |
                    +-------------+-------------+
                                  |
                 +----------------+----------------+
                 |                                 |
                 v                                 v
        +------------------+              +------------------+
        | AWS EC2          |              | AWS S3           |
        | Application/API  |              | Static assets,   |
        | runtime          |              | documents/files  |
        +--------+---------+              +------------------+
                 |
                 v
        +------------------+
        | AWS RDBS/RDS     |
        | Relational data  |
        | persistence      |
        +------------------+
```

> **Note:** AWS commonly calls its managed relational database service **Amazon RDS** (Relational Database Service). This document uses “RDBS/RDS” to match the requested terminology.

### Jenkins CI/CD: controller/master and agent

The repository includes a `Jenkinsfile` that currently runs the CI checks on any available Jenkins executor:

1. **Checkout** – retrieves the source code from GitHub.
2. **Backend tests** – creates a Python virtual environment, installs development dependencies, and runs `pytest` against `backend/tests`.
3. **Frontend build** – runs `npm ci` and `npm run build` inside `frontend`.
4. **Cleanup** – removes the temporary Python environment and frontend build output.

Jenkins terminology:

- **Jenkins controller/master:** Stores and evaluates the pipeline configuration, receives webhooks, schedules jobs, stores build history, and assigns work to agents. The controller should not hold application secrets in the repository.
- **Jenkins agent/node:** Executes resource-intensive steps such as Python tests, npm installation, frontend builds, Docker commands, and deployment scripts. Agents may run on EC2 or as ephemeral containers.

For a production setup, use a controller/master and one or more agents:

1. Install Jenkins on a secured controller/master instance.
2. Create an agent with the required tools: Git, Python 3, pip, Node.js/npm, Docker, and AWS CLI if deployment is performed by Jenkins.
3. Configure the GitHub webhook to trigger the pipeline on pushes or pull requests.
4. Store AWS credentials, database credentials, and application secrets in Jenkins Credentials or an external secrets manager.
5. Keep the Jenkins controller/master private where possible and allow agents only the network access they need.
6. Use separate credentials and deployment targets for development, staging, and production.

### AWS EC2

AWS EC2 can host the backend API, frontend server, reverse proxy, Docker Compose stack, or a Jenkins agent. A recommended deployment flow is:

1. Jenkins agent checks out the selected commit.
2. CI tests and builds pass.
3. Jenkins packages the application or builds Docker images.
4. The deployment stage connects to the target EC2 instance through a restricted mechanism such as AWS Systems Manager or SSH with a short-lived key.
5. The EC2 instance pulls the approved artifact/image and restarts the service.
6. A health check confirms that the application is available.

Do not commit EC2 private keys, `.env` files, or production credentials.

### AWS S3

S3 can be used for durable object storage, such as:

- Generated invoice PDFs
- User-uploaded documents
- Frontend/static build assets
- Backups or deployment artifacts

Use a private bucket by default, block public access unless a specific public asset requires it, and grant the application only the bucket permissions it needs. Prefer IAM roles attached to EC2 over long-lived access keys.

### AWS RDBS/RDS

Use an AWS-managed relational database for persistent billing, invoice, and inventory data. Configure the connection using environment variables rather than hard-coding credentials. The database should:

- Be placed in a private subnet where practical.
- Allow inbound traffic only from the application security group.
- Use encryption at rest and in transit.
- Have automated backups and a defined retention period.
- Be migrated using the repository's migration process before application rollout.

## Local development

### Prerequisites

- Python 3
- Node.js and npm
- Git
- Docker and Docker Compose (optional)

### Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -r backend/requirements-dev.txt

# Start the API according to the backend entry point/configuration.
# Run tests:
pytest backend/tests -q
```

### Frontend

```bash
cd frontend
npm ci
npm start
```

### Docker Compose

```bash
docker compose up --build
```

Check the environment example files before starting the application:

- `.env.example`
- `frontend/.env.example`

Never commit real secrets to either environment file or to source control.

## File structure

```text
Billing-Inventory/
├── .dockerignore                 # Docker build exclusions
├── .env.example                  # Root environment variable template
├── .gitignore                    # Git exclusions
├── Jenkinsfile                   # Jenkins CI pipeline
├── docker-compose.yml            # Local/container orchestration
├── render.yaml                   # Render deployment configuration
├── requirements.txt              # Python runtime dependencies
├── vercel.json                   # Vercel configuration
├── backend/
│   ├── Dockerfile                # Backend container image definition
│   ├── __init__.py
│   ├── cache.py                  # Caching helpers
│   ├── config.py                 # Application configuration
│   ├── database.py               # Database connection/session setup
│   ├── main.py                   # Backend application entry point
│   ├── migrations.py             # Database migration helpers
│   ├── models.py                 # Database models
│   ├── schemas.py                # Request/response schemas
│   ├── requirements-dev.txt      # Development and test dependencies
│   ├── routers/
│   │   ├── invoices.py           # Invoice API routes
│   │   ├── meta.py               # Metadata/health routes
│   │   └── products.py           # Product API routes
│   ├── services/
│   │   ├── invoice_service.py    # Invoice business logic
│   │   └── pdf_service.py        # PDF generation logic
│   └── tests/
│       ├── conftest.py           # Pytest fixtures
│       └── test_api.py            # Backend API tests
└── frontend/
    ├── .env.example              # Frontend environment template
    ├── package.json               # JavaScript dependencies and scripts
    ├── package-lock.json          # Locked frontend dependency versions
    ├── vercel.json                # Frontend deployment configuration
    ├── public/                    # Public static assets
    └── src/
        ├── App.js                 # Main React application component
        ├── App.css                # Application styles
        ├── api.js                 # Backend API client
        ├── index.js               # React entry point
        ├── index.css              # Global styles
        ├── components/             # Reusable UI components
        ├── context/                # React context/providers
        ├── pages/                  # Page-level views
        └── utils/                  # Frontend utility functions
```

The structure above reflects the current repository layout. Add new files and directories to this section when the application architecture changes.

## CI commands

The current `Jenkinsfile` runs:

```bash
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r backend/requirements-dev.txt
.venv/bin/python -m pytest backend/tests -q

cd frontend
npm ci
npm run build
```

Deployment stages for EC2, S3, and RDS can be added after these checks pass. Keep deployment credentials outside the repository and require approvals for production releases.

## Security checklist

- Use HTTPS for all external traffic.
- Keep `.env` files and credentials out of Git.
- Use IAM roles and least-privilege policies.
- Restrict EC2 and database security-group rules.
- Keep S3 buckets private by default.
- Rotate credentials and review Jenkins access regularly.
- Run database migrations carefully and back up production data before schema changes.

## License

No license file is currently included in this repository. Add a license before distributing the project publicly.
