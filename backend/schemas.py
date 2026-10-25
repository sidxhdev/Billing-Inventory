from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class PaymentMethod(str, Enum):
    cash = "cash"
    upi = "upi"
    card = "card"
    bank_transfer = "bank_transfer"


class PaymentStatus(str, Enum):
    paid = "paid"
    pending = "pending"
    partially_paid = "partially_paid"


def _clean(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return value.strip()


class ProductBase(BaseModel):
    name: str
    sku: Optional[str] = None
    description: str = ""
    category: str = "General"
    purchase_price: float = 0.0
    price: float = 0.0
    quantity: int = 0
    unit: str = "pcs"
    low_stock_threshold: int = 5
    tax_rate: Optional[float] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("Product name cannot be empty")
        return value

    @field_validator("description", "category", "unit")
    @classmethod
    def clean_text(cls, value: str, info) -> str:
        value = (value or "").strip()
        if info.field_name == "category" and not value:
            return "General"
        if info.field_name == "unit" and not value:
            return "pcs"
        return value

    @field_validator("sku")
    @classmethod
    def clean_sku(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip().upper()
        return value or None

    @field_validator("purchase_price", "price")
    @classmethod
    def non_negative_money(cls, value: float) -> float:
        if value is None:
            return 0.0
        if value < 0:
            raise ValueError("Price cannot be negative")
        return round(float(value), 2)

    @field_validator("quantity", "low_stock_threshold")
    @classmethod
    def non_negative_int(cls, value: int) -> int:
        if value is None:
            return 0
        if value < 0:
            raise ValueError("Value cannot be negative")
        return int(value)

    @field_validator("tax_rate")
    @classmethod
    def valid_tax_rate(cls, value: Optional[float]) -> Optional[float]:
        if value is None:
            return None
        if value < 0 or value > 100:
            raise ValueError("Tax rate must be between 0 and 100")
        return round(float(value), 2)


class ProductCreate(ProductBase):
    id: Optional[int] = None

    @field_validator("id")
    @classmethod
    def id_positive(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value <= 0:
            raise ValueError("id must be greater than 0")
        return value


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    purchase_price: Optional[float] = None
    price: Optional[float] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None
    low_stock_threshold: Optional[int] = None
    tax_rate: Optional[float] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Product name cannot be empty")
        return value

    @field_validator("sku")
    @classmethod
    def clean_sku(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip().upper()
        return value or None

    @field_validator("purchase_price", "price")
    @classmethod
    def non_negative_money(cls, value: Optional[float]) -> Optional[float]:
        if value is None:
            return None
        if value < 0:
            raise ValueError("Price cannot be negative")
        return round(float(value), 2)

    @field_validator("quantity", "low_stock_threshold")
    @classmethod
    def non_negative_int(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            return None
        if value < 0:
            raise ValueError("Value cannot be negative")
        return int(value)

    @field_validator("tax_rate")
    @classmethod
    def valid_tax_rate(cls, value: Optional[float]) -> Optional[float]:
        if value is None:
            return None
        if value < 0 or value > 100:
            raise ValueError("Tax rate must be between 0 and 100")
        return round(float(value), 2)


class ProductResponse(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    stock_status: str
    stock_value: float
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class InvoiceItemSelector(BaseModel):
    product_id: int
    quantity: int

    @field_validator("product_id")
    @classmethod
    def product_id_positive(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("product_id must be greater than 0")
        return value

    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("quantity must be greater than 0")
        return value


class InvoiceItemCreate(InvoiceItemSelector):
    pass


class InvoiceItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    product_id: Optional[int] = None
    product_name: str
    sku: str = ""
    unit: str = "pcs"
    quantity: int
    unit_price: float
    tax_rate: float = 0.0
    tax_amount: float = 0.0
    subtotal: float
    line_total: float


class CustomerInfo(BaseModel):
    name: str
    phone: str = ""
    address: str = ""
    gstin: str = ""
    business_name: str = ""

    @field_validator("name")
    @classmethod
    def name_required(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("Customer name is required")
        return value

    @field_validator("phone", "address", "gstin", "business_name")
    @classmethod
    def clean_optional(cls, value: str) -> str:
        return (value or "").strip()


class CheckoutItem(BaseModel):
    product_id: int
    quantity: int

    @field_validator("product_id")
    @classmethod
    def product_id_positive(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("product_id must be greater than 0")
        return value

    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("quantity must be greater than 0")
        return value


class CheckoutCreate(BaseModel):
    items: list[CheckoutItem] = Field(min_length=1)
    customer: CustomerInfo
    discount: float = 0.0
    gst_rate: Optional[float] = None
    payment_method: PaymentMethod = PaymentMethod.cash
    payment_status: PaymentStatus = PaymentStatus.paid
    amount_paid: Optional[float] = None
    idempotency_key: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("discount")
    @classmethod
    def discount_non_negative(cls, value: float) -> float:
        if value < 0:
            raise ValueError("Discount cannot be negative")
        return round(float(value), 2)

    @field_validator("gst_rate")
    @classmethod
    def valid_gst_rate(cls, value: Optional[float]) -> Optional[float]:
        if value is None:
            return None
        if value < 0 or value > 100:
            raise ValueError("GST rate must be between 0 and 100")
        return round(float(value), 2)

    @field_validator("amount_paid")
    @classmethod
    def amount_paid_non_negative(cls, value: Optional[float]) -> Optional[float]:
        if value is None:
            return None
        if value < 0:
            raise ValueError("Amount paid cannot be negative")
        return round(float(value), 2)

    @field_validator("idempotency_key")
    @classmethod
    def clean_idempotency_key(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        if len(value) > 64:
            raise ValueError("Idempotency key must be at most 64 characters")
        return value

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None


class InvoiceCreate(BaseModel):
    """Legacy invoice payload kept for backwards compatibility."""

    invoice_number: str = ""
    customer_name: str = ""
    item_selectors: list[InvoiceItemSelector] = Field(min_length=1)
    discount: float = 0.0
    gst_rate: Optional[float] = None
    payment_method: PaymentMethod = PaymentMethod.cash
    payment_status: PaymentStatus = PaymentStatus.paid
    amount_paid: Optional[float] = None
    idempotency_key: Optional[str] = None
    notes: Optional[str] = None


class InvoiceUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    customer_gstin: Optional[str] = None
    customer_business_name: Optional[str] = None
    payment_method: Optional[PaymentMethod] = None
    payment_status: Optional[PaymentStatus] = None
    amount_paid: Optional[float] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def at_least_one_field(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update")
        return self


class PaymentUpdate(BaseModel):
    payment_method: Optional[PaymentMethod] = None
    payment_status: Optional[PaymentStatus] = None
    amount_paid: Optional[float] = None

    @model_validator(mode="after")
    def at_least_one_field(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update")
        if self.amount_paid is not None and self.amount_paid < 0:
            raise ValueError("Amount paid cannot be negative")
        return self


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_number: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    customer_gstin: Optional[str] = None
    customer_business_name: Optional[str] = None

    business_name: Optional[str] = None
    business_address: Optional[str] = None
    business_phone: Optional[str] = None
    business_email: Optional[str] = None
    business_gstin: Optional[str] = None

    subtotal: float
    discount: float
    taxable_amount: float
    tax: float
    cgst: float
    sgst: float
    igst: float
    total: float

    payment_method: PaymentMethod
    payment_status: PaymentStatus
    amount_paid: float
    balance_due: float

    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    items: list[InvoiceItemResponse] = []


class ConfigResponse(BaseModel):
    business_name: str
    business_address: str
    business_phone: str
    business_email: str
    business_gstin: str
    business_state: str
    gst_rate: float
    gst_mode: str
    invoice_prefix: str
    currency: str
    payment_terms: str
    thank_you_message: str
    default_low_stock_threshold: int
    payment_methods: list[str]
    payment_statuses: list[str]
