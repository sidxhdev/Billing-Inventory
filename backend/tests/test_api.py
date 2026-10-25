from datetime import datetime, timezone

from backend.config import settings


def product_payload(**overrides):
    payload = {
        "name": "Test Widget",
        "description": "A widget used in tests",
        "category": "Testing",
        "purchase_price": 60,
        "price": 100,
        "quantity": 10,
        "unit": "pcs",
        "low_stock_threshold": 3,
    }
    payload.update(overrides)
    return payload


def create_product(client, **overrides):
    response = client.post("/products/", json=product_payload(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


def checkout_payload(product_id, quantity=1, **overrides):
    payload = {
        "items": [{"product_id": product_id, "quantity": quantity}],
        "customer": {
            "name": "Asha Rao",
            "phone": "9876543210",
            "address": "12 Test Lane, Bengaluru",
            "gstin": "29ABCDE1234F1Z5",
            "business_name": "Asha Traders",
        },
        "discount": 0,
        "payment_method": "cash",
        "payment_status": "paid",
        "notes": "Test sale",
    }
    payload.update(overrides)
    return payload


def test_health_and_config(client):
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok"}

    config = client.get("/config")
    assert config.status_code == 200
    data = config.json()
    assert data["business_name"] == "Test Business"
    assert data["gst_rate"] == 18
    assert data["gst_mode"] == "cgst_sgst"
    assert data["invoice_prefix"] == "TEST"


def test_vercel_preview_origin_is_allowed(client):
    origin = "https://billing-preview-abc123.vercel.app"
    response = client.get("/health", headers={"Origin": origin})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


def test_product_crud_and_stock_status(client):
    created = create_product(client)
    assert created["sku"].startswith("SKU-")
    assert created["category"] == "Testing"
    assert created["stock_status"] == "in_stock"
    assert created["stock_value"] == 1000

    product_id = created["id"]
    fetched = client.get(f"/products/{product_id}")
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Test Widget"

    low = create_product(client, name="Low Item", quantity=2)
    assert low["stock_status"] == "low_stock"

    out = create_product(client, name="Out Item", quantity=0)
    assert out["stock_status"] == "out_of_stock"

    updated = client.put(
        f"/products/{product_id}",
        json={"price": 125.5, "quantity": 4, "sku": "WIDGET-1"},
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["sku"] == "WIDGET-1"
    assert body["price"] == 125.5
    assert body["quantity"] == 4
    assert body["stock_status"] == "in_stock"

    listed = client.get("/products/")
    assert listed.status_code == 200
    assert len(listed.json()) == 3

    filtered = client.get("/products/", params={"stock_status": "out_of_stock"})
    assert [item["name"] for item in filtered.json()] == ["Out Item"]


def test_duplicate_sku_is_rejected(client):
    create_product(client, sku="DUP-1")
    response = client.post("/products/", json=product_payload(sku="DUP-1"))
    assert response.status_code == 409
    assert "DUP-1" in response.json()["detail"]


def test_checkout_creates_invoice_and_deducts_stock(client):
    product = create_product(client)
    response = client.post(
        "/invoices/checkout", json=checkout_payload(product["id"], quantity=2)
    )
    assert response.status_code == 201, response.text
    invoice = response.json()

    year = datetime.now(timezone.utc).year
    assert invoice["invoice_number"] == f"TEST-{year}-000001"
    assert invoice["customer_name"] == "Asha Rao"
    assert invoice["customer_business_name"] == "Asha Traders"
    assert invoice["subtotal"] == 200
    assert invoice["taxable_amount"] == 200
    assert invoice["discount"] == 0
    assert invoice["tax"] == 36
    assert invoice["cgst"] == 18
    assert invoice["sgst"] == 18
    assert invoice["igst"] == 0
    assert invoice["total"] == 236
    assert invoice["payment_status"] == "paid"
    assert invoice["amount_paid"] == 236
    assert invoice["balance_due"] == 0
    assert invoice["business_name"] == "Test Business"
    assert len(invoice["items"]) == 1
    line = invoice["items"][0]
    assert line["product_name"] == "Test Widget"
    assert line["quantity"] == 2
    assert line["unit_price"] == 100
    assert line["tax_rate"] == 18
    assert line["tax_amount"] == 36
    assert line["line_total"] == 236

    remaining = client.get(f"/products/{product['id']}").json()
    assert remaining["quantity"] == 8

    listed = client.get("/invoices/")
    assert listed.status_code == 200
    assert len(listed.json()) == 1


def test_checkout_is_idempotent(client):
    product = create_product(client)
    payload = checkout_payload(product["id"], quantity=2, idempotency_key="checkout-key-1")

    first = client.post("/invoices/checkout", json=payload)
    second = client.post("/invoices/checkout", json=payload)
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["invoice_number"] == second.json()["invoice_number"]

    remaining = client.get(f"/products/{product['id']}").json()
    assert remaining["quantity"] == 8
    assert len(client.get("/invoices/").json()) == 1


def test_checkout_rejects_insufficient_stock(client):
    product = create_product(client, quantity=1)
    response = client.post(
        "/invoices/checkout", json=checkout_payload(product["id"], quantity=2)
    )
    assert response.status_code == 409
    assert "Insufficient stock" in response.json()["detail"]

    remaining = client.get(f"/products/{product['id']}").json()
    assert remaining["quantity"] == 1
    assert client.get("/invoices/").json() == []


def test_partial_payment_and_payment_update(client):
    product = create_product(client)
    response = client.post(
        "/invoices/checkout",
        json=checkout_payload(
            product["id"],
            payment_status="partially_paid",
            amount_paid=50,
        ),
    )
    assert response.status_code == 201, response.text
    invoice = response.json()
    assert invoice["total"] == 118
    assert invoice["amount_paid"] == 50
    assert invoice["balance_due"] == 68
    assert invoice["payment_status"] == "partially_paid"

    invalid = client.post(
        "/invoices/checkout",
        json=checkout_payload(
            product["id"],
            payment_status="partially_paid",
            amount_paid=0,
        ),
    )
    assert invalid.status_code == 400

    updated = client.patch(
        f"/invoices/{invoice['id']}/payment",
        json={"payment_status": "paid", "payment_method": "upi"},
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["payment_status"] == "paid"
    assert body["payment_method"] == "upi"
    assert body["amount_paid"] == 118
    assert body["balance_due"] == 0


def test_product_tax_rate_overrides_configured_gst(client):
    product = create_product(client, price=100, tax_rate=5)
    response = client.post(
        "/invoices/checkout", json=checkout_payload(product["id"], quantity=1)
    )
    assert response.status_code == 201, response.text
    invoice = response.json()
    assert invoice["tax"] == 5
    assert invoice["cgst"] == 2.5
    assert invoice["sgst"] == 2.5
    assert invoice["total"] == 105


def test_discount_is_applied_before_tax(client):
    product = create_product(client, price=100)
    response = client.post(
        "/invoices/checkout",
        json=checkout_payload(product["id"], quantity=2, discount=50),
    )
    assert response.status_code == 201, response.text
    invoice = response.json()
    assert invoice["subtotal"] == 200
    assert invoice["discount"] == 50
    assert invoice["taxable_amount"] == 150
    assert invoice["tax"] == 27
    assert invoice["total"] == 177
    assert invoice["items"][0]["tax_amount"] == 27


def test_legacy_create_ignores_client_invoice_number(client):
    product = create_product(client)
    response = client.post(
        "/invoices/",
        json={
            "invoice_number": "CLIENT-SUPPLIED-1",
            "customer_name": "Legacy Customer",
            "item_selectors": [{"product_id": product["id"], "quantity": 1}],
            "payment_status": "paid",
        },
    )
    assert response.status_code == 201, response.text
    invoice = response.json()
    assert invoice["invoice_number"] != "CLIENT-SUPPLIED-1"
    assert invoice["invoice_number"].startswith("TEST-")
    assert invoice["customer_name"] == "Legacy Customer"


def test_invoice_search_and_status_filters(client):
    product = create_product(client, quantity=20)
    paid = client.post(
        "/invoices/checkout", json=checkout_payload(product["id"], quantity=1)
    ).json()
    pending = client.post(
        "/invoices/checkout",
        json=checkout_payload(
            product["id"],
            quantity=1,
            customer={"name": "Ravi Kumar", "phone": "9000000000"},
            payment_status="pending",
            amount_paid=0,
        ),
    ).json()

    by_name = client.get("/invoices/", params={"q": "ravi"})
    assert [item["invoice_number"] for item in by_name.json()] == [pending["invoice_number"]]

    pending_only = client.get("/invoices/", params={"payment_status": "pending"})
    assert [item["invoice_number"] for item in pending_only.json()] == [
        pending["invoice_number"]
    ]

    paid_only = client.get("/invoices/", params={"payment_status": "paid"})
    assert [item["invoice_number"] for item in paid_only.json()] == [paid["invoice_number"]]

    detail = client.get(f"/invoices/{paid['id']}")
    assert detail.status_code == 200
    assert detail.json()["id"] == paid["id"]


def test_pdf_generation_uses_persisted_invoice(client):
    product = create_product(client)
    invoice = client.post(
        "/invoices/checkout", json=checkout_payload(product["id"], quantity=1)
    ).json()

    response = client.get(f"/invoices/{invoice['id']}/pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF")


def test_pdf_escapes_special_characters(client):
    product = create_product(client, name="Widget & Co <Deluxe>")
    payload = checkout_payload(product["id"])
    payload["customer"] = {
        "name": "Asha & Sons",
        "address": "12 <Test> Lane & Road",
        "business_name": "Asha & Co",
    }
    payload["notes"] = "Handle with care & keep dry"
    invoice = client.post("/invoices/checkout", json=payload).json()

    response = client.get(f"/invoices/{invoice['id']}/pdf")
    assert response.status_code == 200
    assert response.content.startswith(b"%PDF")


def test_invoice_delete_is_forbidden(client):
    product = create_product(client)
    invoice = client.post(
        "/invoices/checkout", json=checkout_payload(product["id"])
    ).json()
    response = client.delete(f"/invoices/{invoice['id']}")
    assert response.status_code == 403
    assert client.get(f"/invoices/{invoice['id']}").status_code == 200


def test_product_delete_preserves_invoice_snapshot(client):
    product = create_product(client)
    invoice = client.post(
        "/invoices/checkout", json=checkout_payload(product["id"], quantity=2)
    ).json()

    deleted = client.delete(f"/products/{product['id']}")
    assert deleted.status_code == 200

    detail = client.get(f"/invoices/{invoice['id']}").json()
    assert detail["items"][0]["product_id"] is None
    assert detail["items"][0]["product_name"] == "Test Widget"
    assert detail["items"][0]["line_total"] == 236
    assert client.get(f"/products/{product['id']}").status_code == 404


def test_invoice_number_sequence_increments(client):
    product = create_product(client, quantity=10)
    first = client.post(
        "/invoices/checkout", json=checkout_payload(product["id"])
    ).json()
    second = client.post(
        "/invoices/checkout", json=checkout_payload(product["id"])
    ).json()
    year = datetime.now(timezone.utc).year
    assert first["invoice_number"] == f"{settings.invoice_prefix}-{year}-000001"
    assert second["invoice_number"] == f"{settings.invoice_prefix}-{year}-000002"
