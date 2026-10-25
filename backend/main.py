import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

# Load environment before importing modules that read configuration at import time.
load_dotenv(".env.local")
load_dotenv()

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from .config import settings  # noqa: E402
from .migrations import upgrade_database  # noqa: E402
from .routers import invoices, meta, products  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    upgrade_database()
    logger.info("Database schema is ready")
    yield


app = FastAPI(
    title="Inventory and Billing API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meta.router)
app.include_router(products.router)
app.include_router(invoices.router)


@app.get("/")
def root():
    return {
        "name": "Inventory and Billing API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health",
    }
