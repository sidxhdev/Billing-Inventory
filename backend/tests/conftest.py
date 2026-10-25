import os
from pathlib import Path

import pytest
from sqlalchemy import text

TEST_DB = Path(__file__).resolve().parent / "test_inventory.db"
if TEST_DB.exists():
    TEST_DB.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["ENVIRONMENT"] = "test"
os.environ["REDIS_DISABLED"] = "1"
os.environ["CORS_ORIGIN_REGEX"] = r"https://.*\.vercel\.app"
os.environ["GST_RATE"] = "18"
os.environ["GST_MODE"] = "cgst_sgst"
os.environ["BUSINESS_NAME"] = "Test Business"
os.environ["BUSINESS_ADDRESS"] = "1 Test Street"
os.environ["BUSINESS_PHONE"] = "9999999999"
os.environ["BUSINESS_GSTIN"] = "29TESTGSTIN123"
os.environ["INVOICE_PREFIX"] = "TEST"
os.environ["PAYMENT_TERMS"] = "Payment due on receipt."

from fastapi.testclient import TestClient  # noqa: E402

from backend.database import engine  # noqa: E402
from backend.main import app  # noqa: E402
from backend.migrations import upgrade_database  # noqa: E402


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def clean_database():
    upgrade_database()
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM invoice_items"))
        connection.execute(text("DELETE FROM invoices"))
        connection.execute(text("DELETE FROM invoice_sequences"))
        connection.execute(text("DELETE FROM products"))
    yield
