from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from ..cache import cache
from ..database import get_db
from ..models import InvoiceItem, Product
from ..schemas import ProductCreate, ProductResponse, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])

CACHE_ALL = "products:all"


def _invalidate(product_id: Optional[int] = None) -> None:
    cache.delete(CACHE_ALL)
    if product_id:
        cache.delete(f"products:{product_id}")


def _generate_sku(db: Session) -> str:
    for _ in range(20):
        candidate = f"SKU-{uuid4().hex[:8].upper()}"
        if not db.query(Product.id).filter(Product.sku == candidate).first():
            return candidate
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not generate a unique SKU",
    )


def _assert_sku_available(db: Session, sku: str, exclude_id: Optional[int] = None) -> None:
    query = db.query(Product.id).filter(Product.sku == sku)
    if exclude_id is not None:
        query = query.filter(Product.id != exclude_id)
    if query.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A product with SKU {sku} already exists",
        )


def _sort_clause(sort: Optional[str]):
    if sort == "name_desc":
        return Product.name.desc()
    if sort == "price_asc":
        return Product.price.asc()
    if sort == "price_desc":
        return Product.price.desc()
    if sort == "quantity_asc":
        return Product.quantity.asc()
    if sort == "quantity_desc":
        return Product.quantity.desc()
    if sort == "stock_desc":
        return Product.quantity.desc()
    return Product.name.asc()


@router.get("/", response_model=list[ProductResponse])
def get_all_products(
    q: Optional[str] = None,
    category: Optional[str] = None,
    stock_status: Optional[str] = Query(
        None, pattern="^(in_stock|low_stock|out_of_stock)$"
    ),
    sort: Optional[str] = None,
    limit: Optional[int] = Query(None, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    use_cache = not any([q, category, stock_status, sort, limit, offset])
    if use_cache:
        cached = cache.get_json(CACHE_ALL)
        if cached is not None:
            return cached

    query = db.query(Product)
    if q:
        term = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Product.name).like(term),
                func.lower(Product.sku).like(term),
                func.lower(func.coalesce(Product.description, "")).like(term),
                func.lower(func.coalesce(Product.category, "")).like(term),
            )
        )
    if category:
        query = query.filter(func.lower(Product.category) == category.strip().lower())
    if stock_status == "out_of_stock":
        query = query.filter(Product.quantity <= 0)
    elif stock_status == "low_stock":
        query = query.filter(
            Product.quantity > 0,
            Product.quantity <= Product.low_stock_threshold,
        )
    elif stock_status == "in_stock":
        query = query.filter(Product.quantity > Product.low_stock_threshold)

    query = query.order_by(_sort_clause(sort), Product.id.asc())
    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)
    products = query.all()

    if use_cache:
        cache.set_json(
            CACHE_ALL,
            [ProductResponse.model_validate(product).model_dump(mode="json") for product in products],
        )
    return products


@router.get("/categories", response_model=list[str])
def get_categories(db: Session = Depends(get_db)):
    rows = (
        db.query(Product.category)
        .filter(Product.category.isnot(None), Product.category != "")
        .distinct()
        .order_by(Product.category.asc())
        .all()
    )
    return [row[0] for row in rows]


@router.get("/stats")
def get_inventory_stats(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    total_products = len(products)
    total_units = sum(product.quantity or 0 for product in products)
    low_stock = sum(
        1
        for product in products
        if 0 < (product.quantity or 0) <= (product.low_stock_threshold or 0)
    )
    out_of_stock = sum(1 for product in products if (product.quantity or 0) <= 0)
    stock_value = round(
        sum((product.price or 0) * (product.quantity or 0) for product in products), 2
    )
    purchase_value = round(
        sum(
            (product.purchase_price or 0) * (product.quantity or 0)
            for product in products
        ),
        2,
    )
    return {
        "total_products": total_products,
        "total_units": total_units,
        "low_stock": low_stock,
        "out_of_stock": out_of_stock,
        "stock_value": stock_value,
        "purchase_value": purchase_value,
    }


@router.get("/{id}", response_model=ProductResponse)
def get_product_by_id(id: int, db: Session = Depends(get_db)):
    if id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product ID must be greater than 0",
        )
    cached = cache.get_json(f"products:{id}")
    if cached is not None:
        return cached
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {id} not found",
        )
    cache.set_json(
        f"products:{id}", ProductResponse.model_validate(product).model_dump(mode="json")
    )
    return product


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def add_product(payload: ProductCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    product_id = data.pop("id", None)
    if product_id is not None:
        existing = db.query(Product.id).filter(Product.id == product_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Product with ID {product_id} already exists",
            )
    sku = data.get("sku") or _generate_sku(db)
    _assert_sku_available(db, sku)
    data["sku"] = sku

    product = Product(id=product_id, **data) if product_id else Product(**data)
    db.add(product)
    db.flush()
    if product_id is not None and db.bind.dialect.name == "postgresql":
        db.execute(
            text(
                "SELECT setval("
                "pg_get_serial_sequence('products', 'id'), "
                "(SELECT MAX(id) FROM products))"
            )
        )
    db.commit()
    db.refresh(product)
    _invalidate(product.id)
    return product


@router.put("/{id}", response_model=ProductResponse)
def update_product(id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    if id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product ID must be greater than 0",
        )
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {id} not found",
        )

    updates = payload.model_dump(exclude_unset=True)
    if "sku" in updates:
        sku = updates["sku"]
        if sku:
            _assert_sku_available(db, sku, exclude_id=id)
            product.sku = sku
        else:
            updates.pop("sku")
    for field, value in updates.items():
        if field == "sku":
            continue
        if value is None and field != "tax_rate":
            continue
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    _invalidate(product.id)
    return product


@router.delete("/{id}", status_code=status.HTTP_200_OK)
def delete_product(id: int, db: Session = Depends(get_db)):
    if id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product ID must be greater than 0",
        )
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {id} not found",
        )
    snapshot = ProductResponse.model_validate(product).model_dump(mode="json")
    db.query(InvoiceItem).filter(InvoiceItem.product_id == id).update(
        {InvoiceItem.product_id: None}, synchronize_session=False
    )
    db.delete(product)
    db.commit()
    _invalidate(id)
    return {"message": "Product removed successfully", "product": snapshot}
