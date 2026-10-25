from fastapi import APIRouter

from ..config import settings
from ..schemas import ConfigResponse

router = APIRouter(tags=["meta"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/config", response_model=ConfigResponse)
def get_config():
    return ConfigResponse(
        business_name=settings.business_name,
        business_address=settings.business_address,
        business_phone=settings.business_phone,
        business_email=settings.business_email,
        business_gstin=settings.business_gstin,
        business_state=settings.business_state,
        gst_rate=settings.gst_rate,
        gst_mode=settings.gst_mode,
        invoice_prefix=settings.invoice_prefix,
        currency=settings.currency,
        payment_terms=settings.payment_terms,
        thank_you_message=settings.thank_you_message,
        default_low_stock_threshold=settings.default_low_stock_threshold,
        payment_methods=["cash", "upi", "card", "bank_transfer"],
        payment_statuses=["paid", "pending", "partially_paid"],
    )
