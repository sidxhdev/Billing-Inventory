import os
from dataclasses import dataclass, field


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    business_name: str = "My Business"
    business_address: str = ""
    business_phone: str = ""
    business_email: str = ""
    business_gstin: str = ""
    business_state: str = ""
    gst_rate: float = 0.0
    gst_mode: str = "cgst_sgst"
    invoice_prefix: str = "INV"
    currency: str = "INR"
    payment_terms: str = ""
    thank_you_message: str = "Thank you for your business."
    default_low_stock_threshold: int = 5
    cache_ttl: int = 60
    redis_enabled: bool = True
    cors_origins: list[str] = field(default_factory=list)
    cors_origin_regex: str = ""

    @classmethod
    def from_env(cls) -> "Settings":
        gst_mode = os.getenv("GST_MODE", "cgst_sgst").strip().lower()
        if gst_mode not in {"cgst_sgst", "igst"}:
            gst_mode = "cgst_sgst"

        return cls(
            business_name=os.getenv("BUSINESS_NAME", "My Business").strip() or "My Business",
            business_address=os.getenv("BUSINESS_ADDRESS", "").strip(),
            business_phone=os.getenv("BUSINESS_PHONE", "").strip(),
            business_email=os.getenv("BUSINESS_EMAIL", "").strip(),
            business_gstin=os.getenv("BUSINESS_GSTIN", "").strip(),
            business_state=os.getenv("BUSINESS_STATE", "").strip(),
            gst_rate=max(0.0, min(100.0, _env_float("GST_RATE", 0.0))),
            gst_mode=gst_mode,
            invoice_prefix=os.getenv("INVOICE_PREFIX", "INV").strip() or "INV",
            currency=os.getenv("CURRENCY", "INR").strip() or "INR",
            payment_terms=os.getenv("PAYMENT_TERMS", "").strip(),
            thank_you_message=os.getenv(
                "THANK_YOU_MESSAGE", "Thank you for your business."
            ).strip(),
            default_low_stock_threshold=max(
                0, _env_int("DEFAULT_LOW_STOCK_THRESHOLD", 5)
            ),
            cache_ttl=max(0, _env_int("CACHE_TTL", 60)),
            redis_enabled=os.getenv("REDIS_DISABLED", "0") not in {"1", "true", "True"},
            cors_origins=_env_list(
                "CORS_ORIGINS",
                [
                    "http://localhost:3000",
                    "http://127.0.0.1:3000",
                ],
            ),
            cors_origin_regex=os.getenv(
                "CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app"
            ).strip(),
        )


settings = Settings.from_env()
