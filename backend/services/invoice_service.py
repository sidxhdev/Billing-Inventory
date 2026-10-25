import logging
from datetime import date, datetime, time, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Iterable, Optional

from fastapi import HTTPException, status
from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..cache import cache
from ..config import settings
from ..models import Invoice, InvoiceItem, InvoiceSequence, Product
from ..schemas import (
    CheckoutCreate,
    CheckoutItem,
    CustomerInfo,
    InvoiceCreate,
    InvoiceUpdate,
    PaymentStatus,
    PaymentUpdate,
)

logger = logging.getLogger(__name__)


def money(value) -> float:
    """Round money to two decimal places using commercial (half-up) rounding."""
    return float(Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def next_invoice_number(db: Session, when: Optional[datetime] = None) -> str:
    """Atomically allocate the next invoice number for the current year.

    The upsert below is safe under concurrent checkouts in PostgreSQL (and in
    SQLite for tests). The sequence row is updated in the same transaction as
    the invoice, so a failed checkout rolls the number back as well.
    """
    moment = when or datetime.now(timezone.utc)
    year = moment.year
    row = db.execute(
        text(
            """
            INSERT INTO invoice_sequences (year, last_number)
            VALUES (:year, 1)
            ON CONFLICT (year)
            DO UPDATE SET last_number = invoice_sequences.last_number + 1
            RETURNING last_number
            """
        ),
        {"year": year},
    ).scalar_one()
    return f"{settings.invoice_prefix}-{year}-{int(row):06d}"


def _merge_items(items: Iterable[CheckoutItem]) -> dict[int, int]:
    merged: dict[int, int] = {}
    for item in items:
        merged[item.product_id] = merged.get(item.product_id, 0) + item.quantity
    return merged


def _payment_values(
    payment_status: PaymentStatus, total: float, amount_paid: Optional[float]
) -> tuple[float, float]:
    total = money(total)
    if payment_status == PaymentStatus.paid:
        return total, 0.0

    paid = money(amount_paid or 0)
    if paid > total:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount paid cannot exceed the invoice total",
        )
    if payment_status == PaymentStatus.partially_paid and paid <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A partially paid invoice requires an amount greater than zero",
        )
    if payment_status == PaymentStatus.partially_paid and paid >= total:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use payment status 'paid' when the full amount is paid",
        )
    return paid, money(total - paid)


def _tax_split(tax_total: float) -> tuple[float, float, float]:
    tax_total = money(tax_total)
    if tax_total <= 0:
        return 0.0, 0.0, 0.0
    if settings.gst_mode == "igst":
        return 0.0, 0.0, tax_total
    cgst = money(tax_total / 2)
    sgst = money(tax_total - cgst)
    return cgst, sgst, 0.0


def _build_invoice(
    db: Session,
    payload: CheckoutCreate,
    products: dict[int, Product],
    merged_items: dict[int, int],
) -> Invoice:
    subtotal = 0.0
    lines: list[dict] = []
    default_tax_rate = (
        payload.gst_rate if payload.gst_rate is not None else settings.gst_rate
    )

    for product_id, quantity in merged_items.items():
        product = products[product_id]
        line_subtotal = money(product.price * quantity)
        subtotal = money(subtotal + line_subtotal)
        tax_rate = (
            float(product.tax_rate)
            if product.tax_rate is not None
            else float(default_tax_rate or 0)
        )
        lines.append(
            {
                "product": product,
                "quantity": quantity,
                "unit_price": money(product.price),
                "subtotal": line_subtotal,
                "tax_rate": tax_rate,
            }
        )

    discount = money(payload.discount)
    if discount > subtotal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Discount cannot exceed the subtotal",
        )
    taxable_amount = money(subtotal - discount)
    discount_ratio = (taxable_amount / subtotal) if subtotal else 0.0

    tax_total = 0.0
    remaining_taxable = taxable_amount
    for index, line in enumerate(lines):
        if index == len(lines) - 1:
            line_taxable = money(remaining_taxable)
        else:
            line_taxable = money(line["subtotal"] * discount_ratio)
            remaining_taxable = money(remaining_taxable - line_taxable)
        line_tax = money(line_taxable * (line["tax_rate"] / 100.0))
        line["tax_amount"] = line_tax
        line["taxable"] = line_taxable
        tax_total = money(tax_total + line_tax)

    total = money(taxable_amount + tax_total)
    amount_paid, balance_due = _payment_values(
        payload.payment_status, total, payload.amount_paid
    )
    cgst, sgst, igst = _tax_split(tax_total)

    invoice = Invoice(
        invoice_number=next_invoice_number(db),
        idempotency_key=payload.idempotency_key,
        customer_name=payload.customer.name,
        customer_phone=payload.customer.phone or None,
        customer_address=payload.customer.address or None,
        customer_gstin=payload.customer.gstin or None,
        customer_business_name=payload.customer.business_name or None,
        business_name=settings.business_name,
        business_address=settings.business_address,
        business_phone=settings.business_phone,
        business_email=settings.business_email,
        business_gstin=settings.business_gstin,
        subtotal=subtotal,
        discount=discount,
        taxable_amount=taxable_amount,
        tax=tax_total,
        cgst=cgst,
        sgst=sgst,
        igst=igst,
        total=total,
        payment_method=payload.payment_method.value,
        payment_status=payload.payment_status.value,
        amount_paid=amount_paid,
        balance_due=balance_due,
        notes=payload.notes,
    )

    for line in lines:
        product = line["product"]
        invoice.items.append(
            InvoiceItem(
                product_id=product.id,
                product_name=product.name,
                sku=product.sku,
                unit=product.unit,
                quantity=line["quantity"],
                unit_price=line["unit_price"],
                tax_rate=line["tax_rate"],
                tax_amount=line["tax_amount"],
                subtotal=line["subtotal"],
            )
        )

    return invoice


def _deduct_stock(db: Session, merged_items: dict[int, int]) -> None:
    for product_id, quantity in merged_items.items():
        updated = (
            db.query(Product)
            .filter(Product.id == product_id, Product.quantity >= quantity)
            .update(
                {Product.quantity: Product.quantity - quantity},
                synchronize_session=False,
            )
        )
        if updated != 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Stock changed while checking out. Please refresh the cart and try again."
                ),
            )


def _invalidate_product_cache(product_ids: Iterable[int]) -> None:
    cache.delete("products:all")
    for product_id in product_ids:
        cache.delete(f"products:{product_id}")


def create_checkout(db: Session, payload: CheckoutCreate) -> Invoice:
    if payload.idempotency_key:
        existing = (
            db.query(Invoice)
            .options(selectinload(Invoice.items))
            .filter(Invoice.idempotency_key == payload.idempotency_key)
            .first()
        )
        if existing:
            return existing

    merged_items = _merge_items(payload.items)
    product_ids = list(merged_items.keys())
    products = (
        db.query(Product)
        .filter(Product.id.in_(product_ids))
        .with_for_update()
        .all()
    )
    product_map = {product.id: product for product in products}
    missing = [product_id for product_id in product_ids if product_id not in product_map]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product(s) not found: {', '.join(map(str, missing))}",
        )

    for product_id, quantity in merged_items.items():
        product = product_map[product_id]
        if product.quantity < quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Insufficient stock for {product.name}. "
                    f"Available: {product.quantity}, requested: {quantity}"
                ),
            )

    invoice = _build_invoice(db, payload, product_map, merged_items)
    db.add(invoice)

    try:
        _deduct_stock(db, merged_items)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        if payload.idempotency_key:
            existing = (
                db.query(Invoice)
                .options(selectinload(Invoice.items))
                .filter(Invoice.idempotency_key == payload.idempotency_key)
                .first()
            )
            if existing:
                return existing
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Checkout could not be completed because of a concurrent update. Please retry.",
        )
    except Exception:
        db.rollback()
        logger.exception("Checkout failed")
        raise

    db.refresh(invoice)
    _invalidate_product_cache(product_ids)
    return invoice


def checkout_from_legacy(db: Session, payload: InvoiceCreate) -> Invoice:
    customer_name = (payload.customer_name or "").strip() or "Walk-in Customer"
    checkout = CheckoutCreate(
        items=[
            CheckoutItem(product_id=item.product_id, quantity=item.quantity)
            for item in payload.item_selectors
        ],
        customer=CustomerInfo(name=customer_name),
        discount=payload.discount,
        gst_rate=payload.gst_rate,
        payment_method=payload.payment_method,
        payment_status=payload.payment_status,
        amount_paid=payload.amount_paid,
        idempotency_key=payload.idempotency_key,
        notes=payload.notes,
    )
    return create_checkout(db, checkout)


def get_invoice(db: Session, invoice_id: int) -> Invoice:
    invoice = (
        db.query(Invoice)
        .options(selectinload(Invoice.items))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice with ID {invoice_id} not found",
        )
    return invoice


def list_invoices(
    db: Session,
    q: Optional[str] = None,
    payment_status: Optional[str] = None,
    payment_method: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: Optional[int] = None,
    offset: int = 0,
) -> list[Invoice]:
    query = db.query(Invoice).options(selectinload(Invoice.items))
    if q:
        term = f"%{q.strip().lower()}%"
        query = query.filter(
            func.lower(Invoice.invoice_number).like(term)
            | func.lower(func.coalesce(Invoice.customer_name, "")).like(term)
            | func.lower(func.coalesce(Invoice.customer_phone, "")).like(term)
        )
    if payment_status:
        query = query.filter(Invoice.payment_status == payment_status)
    if payment_method:
        query = query.filter(Invoice.payment_method == payment_method)
    if date_from:
        query = query.filter(
            Invoice.created_at >= datetime.combine(date_from, time.min)
        )
    if date_to:
        query = query.filter(
            Invoice.created_at < datetime.combine(date_to + timedelta(days=1), time.min)
        )
    query = query.order_by(Invoice.created_at.desc(), Invoice.id.desc())
    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)
    return query.all()


def update_payment(db: Session, invoice: Invoice, payload: PaymentUpdate) -> Invoice:
    new_status = payload.payment_status or PaymentStatus(invoice.payment_status)
    amount = payload.amount_paid if payload.amount_paid is not None else invoice.amount_paid
    paid, balance = _payment_values(new_status, invoice.total, amount)
    if payload.payment_method is not None:
        invoice.payment_method = payload.payment_method.value
    invoice.payment_status = new_status.value
    invoice.amount_paid = paid
    invoice.balance_due = balance
    db.commit()
    db.refresh(invoice)
    return invoice


def update_invoice(db: Session, invoice: Invoice, payload: InvoiceUpdate) -> Invoice:
    if payload.customer_name is not None:
        invoice.customer_name = payload.customer_name.strip() or invoice.customer_name
    if payload.customer_phone is not None:
        invoice.customer_phone = payload.customer_phone.strip() or None
    if payload.customer_address is not None:
        invoice.customer_address = payload.customer_address.strip() or None
    if payload.customer_gstin is not None:
        invoice.customer_gstin = payload.customer_gstin.strip() or None
    if payload.customer_business_name is not None:
        invoice.customer_business_name = (
            payload.customer_business_name.strip() or None
        )
    if payload.notes is not None:
        invoice.notes = payload.notes.strip() or None

    if (
        payload.payment_method is not None
        or payload.payment_status is not None
        or payload.amount_paid is not None
    ):
        new_status = payload.payment_status or PaymentStatus(invoice.payment_status)
        amount = (
            payload.amount_paid
            if payload.amount_paid is not None
            else invoice.amount_paid
        )
        paid, balance = _payment_values(new_status, invoice.total, amount)
        invoice.payment_status = new_status.value
        invoice.amount_paid = paid
        invoice.balance_due = balance
    if payload.payment_method is not None:
        invoice.payment_method = payload.payment_method.value

    db.commit()
    db.refresh(invoice)
    return invoice
