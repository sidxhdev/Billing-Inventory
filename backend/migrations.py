"""Small, idempotent schema upgrader.

The project does not use Alembic. ``create_all`` creates new tables, while this
module adds newly introduced columns/indexes to databases created by older
versions of the application.
"""

import logging
import re

from sqlalchemy import inspect, text

from .config import settings
from .database import Base, engine

logger = logging.getLogger(__name__)

PRODUCT_COLUMNS = {
    "sku": "VARCHAR(64)",
    "category": "VARCHAR(120) DEFAULT 'General'",
    "purchase_price": "FLOAT DEFAULT 0",
    "unit": "VARCHAR(32) DEFAULT 'pcs'",
    "low_stock_threshold": "INTEGER DEFAULT 5",
    "tax_rate": "FLOAT",
    "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    "updated_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
}

INVOICE_COLUMNS = {
    "idempotency_key": "VARCHAR(64)",
    "customer_phone": "VARCHAR(40)",
    "customer_address": "TEXT",
    "customer_gstin": "VARCHAR(32)",
    "customer_business_name": "VARCHAR(200)",
    "business_name": "VARCHAR(200)",
    "business_address": "TEXT",
    "business_phone": "VARCHAR(40)",
    "business_email": "VARCHAR(120)",
    "business_gstin": "VARCHAR(32)",
    "discount": "FLOAT DEFAULT 0",
    "taxable_amount": "FLOAT DEFAULT 0",
    "cgst": "FLOAT DEFAULT 0",
    "sgst": "FLOAT DEFAULT 0",
    "igst": "FLOAT DEFAULT 0",
    "payment_method": "VARCHAR(32) DEFAULT 'cash'",
    "payment_status": "VARCHAR(32) DEFAULT 'paid'",
    "amount_paid": "FLOAT DEFAULT 0",
    "balance_due": "FLOAT DEFAULT 0",
    "notes": "TEXT",
    "updated_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
}

INVOICE_ITEM_COLUMNS = {
    "product_name": "VARCHAR(200)",
    "sku": "VARCHAR(64)",
    "unit": "VARCHAR(32) DEFAULT 'pcs'",
    "tax_rate": "FLOAT DEFAULT 0",
    "tax_amount": "FLOAT DEFAULT 0",
}


def _columns(connection, table: str) -> set[str]:
    inspector = inspect(connection)
    if table not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table)}


def _add_missing_columns(connection, table: str, columns: dict[str, str]) -> None:
    existing = _columns(connection, table)
    for name, definition in columns.items():
        if name in existing:
            continue
        logger.info("Adding column %s.%s", table, name)
        connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))


def _execute(connection, sql: str, **params) -> None:
    try:
        connection.execute(text(sql), params)
    except Exception as exc:  # pragma: no cover - dialect-specific
        logger.warning("Migration statement skipped (%s): %s", exc, sql.split()[0:4])


def _backfill(connection) -> None:
    _execute(
        connection,
        "UPDATE products SET sku = 'LEGACY-' || CAST(id AS VARCHAR) "
        "WHERE sku IS NULL OR sku = ''",
    )
    _execute(
        connection,
        "UPDATE products SET category = 'General' WHERE category IS NULL OR category = ''",
    )
    _execute(connection, "UPDATE products SET unit = 'pcs' WHERE unit IS NULL OR unit = ''")
    _execute(
        connection,
        "UPDATE products SET purchase_price = 0 WHERE purchase_price IS NULL",
    )
    _execute(
        connection,
        "UPDATE products SET low_stock_threshold = 5 WHERE low_stock_threshold IS NULL",
    )

    _execute(
        connection,
        "UPDATE invoices SET subtotal = 0 WHERE subtotal IS NULL",
    )
    _execute(connection, "UPDATE invoices SET tax = 0 WHERE tax IS NULL")
    _execute(connection, "UPDATE invoices SET total = 0 WHERE total IS NULL")
    _execute(
        connection,
        "UPDATE invoices SET taxable_amount = subtotal WHERE taxable_amount IS NULL",
    )
    _execute(connection, "UPDATE invoices SET discount = 0 WHERE discount IS NULL")
    _execute(connection, "UPDATE invoices SET cgst = 0 WHERE cgst IS NULL")
    _execute(connection, "UPDATE invoices SET sgst = 0 WHERE sgst IS NULL")
    _execute(connection, "UPDATE invoices SET igst = 0 WHERE igst IS NULL")
    _execute(
        connection,
        "UPDATE invoices SET payment_method = 'cash' "
        "WHERE payment_method IS NULL OR payment_method = ''",
    )
    _execute(
        connection,
        "UPDATE invoices SET payment_status = 'paid' "
        "WHERE payment_status IS NULL OR payment_status = ''",
    )
    _execute(
        connection,
        "UPDATE invoices SET amount_paid = CASE "
        "WHEN payment_status = 'paid' THEN total ELSE COALESCE(amount_paid, 0) END "
        "WHERE amount_paid IS NULL OR (amount_paid = 0 AND payment_status = 'paid')",
    )
    _execute(
        connection,
        "UPDATE invoices SET balance_due = "
        "CASE WHEN total - amount_paid > 0 THEN total - amount_paid ELSE 0 END "
        "WHERE balance_due IS NULL",
    )
    _execute(
        connection,
        "UPDATE invoices SET business_name = :business_name "
        "WHERE business_name IS NULL OR business_name = ''",
        business_name=settings.business_name,
    )
    _execute(
        connection,
        "UPDATE invoices SET business_address = :business_address "
        "WHERE business_address IS NULL OR business_address = ''",
        business_address=settings.business_address,
    )
    _execute(
        connection,
        "UPDATE invoices SET business_phone = :business_phone "
        "WHERE business_phone IS NULL OR business_phone = ''",
        business_phone=settings.business_phone,
    )
    _execute(
        connection,
        "UPDATE invoices SET business_email = :business_email "
        "WHERE business_email IS NULL OR business_email = ''",
        business_email=settings.business_email,
    )
    _execute(
        connection,
        "UPDATE invoices SET business_gstin = :business_gstin "
        "WHERE business_gstin IS NULL OR business_gstin = ''",
        business_gstin=settings.business_gstin,
    )

    _execute(
        connection,
        "UPDATE invoice_items SET product_name = COALESCE("
        "(SELECT name FROM products WHERE products.id = invoice_items.product_id), "
        "'Product') WHERE product_name IS NULL OR product_name = ''",
    )
    _execute(
        connection,
        "UPDATE invoice_items SET sku = COALESCE("
        "(SELECT sku FROM products WHERE products.id = invoice_items.product_id), "
        "'') WHERE sku IS NULL OR sku = ''",
    )
    _execute(
        connection,
        "UPDATE invoice_items SET unit = COALESCE("
        "(SELECT unit FROM products WHERE products.id = invoice_items.product_id), "
        "'pcs') WHERE unit IS NULL OR unit = ''",
    )
    _execute(
        connection,
        "UPDATE invoice_items SET tax_rate = 0 WHERE tax_rate IS NULL",
    )
    _execute(
        connection,
        "UPDATE invoice_items SET tax_amount = 0 WHERE tax_amount IS NULL",
    )


def _seed_invoice_sequences(connection) -> None:
    """Make sure existing invoice numbers are never handed out again."""
    pattern = re.compile(
        rf"^{re.escape(settings.invoice_prefix)}-(\d{{4}})-(\d+)$", re.IGNORECASE
    )
    rows = connection.execute(text("SELECT invoice_number FROM invoices")).all()
    maxima: dict[int, int] = {}
    for (number,) in rows:
        match = pattern.match(number or "")
        if not match:
            continue
        year, sequence = int(match.group(1)), int(match.group(2))
        maxima[year] = max(maxima.get(year, 0), sequence)

    for year, sequence in maxima.items():
        connection.execute(
            text(
                "INSERT INTO invoice_sequences (year, last_number) "
                "VALUES (:year, :sequence) "
                "ON CONFLICT (year) DO UPDATE SET last_number = CASE "
                "WHEN invoice_sequences.last_number < :sequence "
                "THEN :sequence ELSE invoice_sequences.last_number END"
            ),
            {"year": year, "sequence": sequence},
        )


def _create_indexes(connection) -> None:
    statements = [
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_products_sku ON products (sku)",
        "CREATE INDEX IF NOT EXISTS ix_products_category ON products (category)",
        "CREATE INDEX IF NOT EXISTS ix_products_name ON products (name)",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_invoices_invoice_number "
        "ON invoices (invoice_number)",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_invoices_idempotency_key "
        "ON invoices (idempotency_key)",
        "CREATE INDEX IF NOT EXISTS ix_invoices_created_at ON invoices (created_at)",
        "CREATE INDEX IF NOT EXISTS ix_invoices_payment_status ON invoices (payment_status)",
        "CREATE INDEX IF NOT EXISTS ix_invoice_items_invoice_id ON invoice_items (invoice_id)",
        "CREATE INDEX IF NOT EXISTS ix_invoice_items_product_id ON invoice_items (product_id)",
    ]
    for statement in statements:
        _execute(connection, statement)


def _migration_applied(connection, version: int) -> bool:
    _execute(
        connection,
        "CREATE TABLE IF NOT EXISTS schema_migrations "
        "(version INTEGER PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    )
    result = connection.execute(
        text("SELECT version FROM schema_migrations WHERE version = :version"),
        {"version": version},
    ).first()
    return result is not None


def _mark_migration(connection, version: int) -> None:
    _execute(
        connection,
        "INSERT INTO schema_migrations (version) VALUES (:version)",
        version=version,
    )


def upgrade_database() -> None:
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        _add_missing_columns(connection, "products", PRODUCT_COLUMNS)
        _add_missing_columns(connection, "invoices", INVOICE_COLUMNS)
        _add_missing_columns(connection, "invoice_items", INVOICE_ITEM_COLUMNS)
        if not _migration_applied(connection, 1):
            _backfill(connection)
            _mark_migration(connection, 1)
        _seed_invoice_sequences(connection)
        _create_indexes(connection)
