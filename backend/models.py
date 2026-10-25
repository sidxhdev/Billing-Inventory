from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from .database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    sku = Column(String(64), nullable=False, unique=True, index=True)
    description = Column(String(500), nullable=False, default="")
    category = Column(String(120), nullable=False, default="General", index=True)
    purchase_price = Column(Float, nullable=False, default=0.0)
    price = Column(Float, nullable=False, default=0.0)
    quantity = Column(Integer, nullable=False, default=0)
    unit = Column(String(32), nullable=False, default="pcs")
    low_stock_threshold = Column(Integer, nullable=False, default=5)
    tax_rate = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    @property
    def stock_status(self) -> str:
        if self.quantity <= 0:
            return "out_of_stock"
        if self.quantity <= (self.low_stock_threshold or 0):
            return "low_stock"
        return "in_stock"

    @property
    def stock_value(self) -> float:
        return round((self.price or 0) * (self.quantity or 0), 2)


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(40), unique=True, nullable=False, index=True)
    idempotency_key = Column(String(64), unique=True, nullable=True, index=True)

    customer_name = Column(String(200), nullable=True)
    customer_phone = Column(String(40), nullable=True)
    customer_address = Column(Text, nullable=True)
    customer_gstin = Column(String(32), nullable=True)
    customer_business_name = Column(String(200), nullable=True)

    business_name = Column(String(200), nullable=True)
    business_address = Column(Text, nullable=True)
    business_phone = Column(String(40), nullable=True)
    business_email = Column(String(120), nullable=True)
    business_gstin = Column(String(32), nullable=True)

    subtotal = Column(Float, nullable=False, default=0.0)
    discount = Column(Float, nullable=False, default=0.0)
    taxable_amount = Column(Float, nullable=False, default=0.0)
    tax = Column(Float, nullable=False, default=0.0)
    cgst = Column(Float, nullable=False, default=0.0)
    sgst = Column(Float, nullable=False, default=0.0)
    igst = Column(Float, nullable=False, default=0.0)
    total = Column(Float, nullable=False, default=0.0)

    payment_method = Column(String(32), nullable=False, default="cash")
    payment_status = Column(String(32), nullable=False, default="paid", index=True)
    amount_paid = Column(Float, nullable=False, default=0.0)
    balance_due = Column(Float, nullable=False, default=0.0)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    items = relationship(
        "InvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoiceItem.id",
    )


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(
        Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id = Column(
        Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True
    )
    product_name = Column(String(200), nullable=False, default="Product")
    sku = Column(String(64), nullable=False, default="")
    unit = Column(String(32), nullable=False, default="pcs")
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    tax_rate = Column(Float, nullable=False, default=0.0)
    tax_amount = Column(Float, nullable=False, default=0.0)
    subtotal = Column(Float, nullable=False)

    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product")

    @property
    def line_total(self) -> float:
        return round((self.subtotal or 0) + (self.tax_amount or 0), 2)


class InvoiceSequence(Base):
    __tablename__ = "invoice_sequences"

    year = Column(Integer, primary_key=True)
    last_number = Column(Integer, nullable=False, default=0)
