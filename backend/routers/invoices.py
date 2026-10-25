from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import (
    CheckoutCreate,
    InvoiceCreate,
    InvoiceResponse,
    InvoiceUpdate,
    PaymentMethod,
    PaymentStatus,
    PaymentUpdate,
)
from ..services.invoice_service import (
    checkout_from_legacy,
    create_checkout,
    get_invoice,
    list_invoices,
    update_invoice,
    update_payment,
)
from ..services.pdf_service import build_invoice_pdf

router = APIRouter(prefix="/invoices", tags=["invoices"])


@router.post(
    "/checkout",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
def checkout(payload: CheckoutCreate, db: Session = Depends(get_db)):
    return create_checkout(db, payload)


@router.post(
    "/",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invoice_legacy(payload: InvoiceCreate, db: Session = Depends(get_db)):
    """Deprecated alias for /invoices/checkout.

    Invoice numbers are always generated on the server; a client-supplied
    ``invoice_number`` is intentionally ignored.
    """
    return checkout_from_legacy(db, payload)


@router.get("/", response_model=list[InvoiceResponse])
def get_all_invoices(
    q: Optional[str] = None,
    payment_status: Optional[PaymentStatus] = None,
    payment_method: Optional[PaymentMethod] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: Optional[int] = Query(None, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date_from cannot be after date_to",
        )
    return list_invoices(
        db,
        q=q,
        payment_status=payment_status.value if payment_status else None,
        payment_method=payment_method.value if payment_method else None,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )


@router.get("/{id}/pdf")
def get_invoice_pdf(id: int, db: Session = Depends(get_db)):
    invoice = get_invoice(db, id)
    buffer = build_invoice_pdf(invoice)
    filename = f"{invoice.invoice_number}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, no-store",
        },
    )


@router.get("/{id}", response_model=InvoiceResponse)
def get_invoice_by_id(id: int, db: Session = Depends(get_db)):
    return get_invoice(db, id)


@router.patch("/{id}/payment", response_model=InvoiceResponse)
def patch_payment(
    id: int, payload: PaymentUpdate, db: Session = Depends(get_db)
):
    invoice = get_invoice(db, id)
    return update_payment(db, invoice, payload)


@router.put("/{id}", response_model=InvoiceResponse)
def update_invoice_details(
    id: int, payload: InvoiceUpdate, db: Session = Depends(get_db)
):
    invoice = get_invoice(db, id)
    return update_invoice(db, invoice, payload)


@router.delete("/{id}", status_code=status.HTTP_403_FORBIDDEN)
def delete_invoice(id: int):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=(
            "Invoices are permanent accounting records and cannot be deleted. "
            "Use payment status updates to reflect corrections."
        ),
    )
