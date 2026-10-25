import os
from html import escape
from io import BytesIO
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from ..config import settings
from ..models import Invoice

FONT_CANDIDATES = {
    "regular": [
        os.getenv("PDF_FONT_PATH", ""),
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ],
    "bold": [
        os.getenv("PDF_FONT_BOLD_PATH", ""),
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ],
}

ONES = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
]
TENS = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
]


def _register_fonts() -> tuple[str, str, bool]:
    for key, name in (("regular", "AppFont"), ("bold", "AppFont-Bold")):
        for path in FONT_CANDIDATES[key]:
            if path and os.path.exists(path):
                try:
                    pdfmetrics.registerFont(TTFont(name, path))
                except Exception:
                    continue
                break
        else:
            return "Helvetica", "Helvetica-Bold", False
    return "AppFont", "AppFont-Bold", True


FONT_REGULAR, FONT_BOLD, UNICODE_FONT = _register_fonts()
CURRENCY_SYMBOL = "₹" if UNICODE_FONT else "Rs. "


def format_inr(value, with_symbol: bool = True) -> str:
    value = round(float(value or 0), 2)
    negative = value < 0
    value = abs(value)
    rupees = int(value)
    paise = int(round((value - rupees) * 100))
    if paise == 100:
        rupees += 1
        paise = 0
    text = str(rupees)
    if len(text) > 3:
        head, tail = text[:-3], text[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        text = ",".join(groups) + "," + tail
    result = f"{text}.{paise:02d}"
    if with_symbol:
        result = f"{CURRENCY_SYMBOL}{result}"
    return f"-{result}" if negative else result


def _two_digits(number: int) -> str:
    if number < 20:
        return ONES[number]
    tens, ones = divmod(number, 10)
    return f"{TENS[tens]} {ONES[ones]}".strip()


def _three_digits(number: int) -> str:
    hundreds, remainder = divmod(number, 100)
    parts = []
    if hundreds:
        parts.append(f"{ONES[hundreds]} Hundred")
    if remainder:
        parts.append(_two_digits(remainder))
    return " ".join(parts)


def amount_in_words(value) -> str:
    value = round(float(value or 0), 2)
    rupees = int(value)
    paise = int(round((value - rupees) * 100))
    if paise == 100:
        rupees += 1
        paise = 0

    def indian_words(number: int) -> str:
        if number == 0:
            return "Zero"
        parts = []
        crore, number = divmod(number, 10_000_000)
        lakh, number = divmod(number, 100_000)
        thousand, number = divmod(number, 1_000)
        hundred, number = divmod(number, 100)
        if crore:
            parts.append(f"{indian_words(crore)} Crore")
        if lakh:
            parts.append(f"{_two_digits(lakh)} Lakh")
        if thousand:
            parts.append(f"{_two_digits(thousand)} Thousand")
        if hundred:
            parts.append(f"{ONES[hundred]} Hundred")
        if number:
            parts.append(_two_digits(number))
        return " ".join(parts)

    words = f"Rupees {indian_words(rupees)}"
    if paise:
        words += f" and {indian_words(paise)} Paise"
    return f"{words} Only"


def _paragraph(value: Optional[str], style) -> Paragraph:
    return Paragraph(value or "", style)


def build_invoice_pdf(invoice: Invoice) -> BytesIO:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=f"Invoice {invoice.invoice_number}",
        author=invoice.business_name or settings.business_name,
    )

    styles = getSampleStyleSheet()
    base = ParagraphStyle(
        "AppBase",
        parent=styles["Normal"],
        fontName=FONT_REGULAR,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#222222"),
    )
    small = ParagraphStyle("AppSmall", parent=base, fontSize=8, leading=10)
    right = ParagraphStyle("AppRight", parent=base, alignment=TA_RIGHT)
    right_small = ParagraphStyle(
        "AppRightSmall", parent=small, alignment=TA_RIGHT
    )
    title = ParagraphStyle(
        "AppTitle",
        parent=base,
        fontName=FONT_BOLD,
        fontSize=22,
        leading=26,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#111111"),
    )
    company = ParagraphStyle(
        "AppCompany",
        parent=base,
        fontName=FONT_BOLD,
        fontSize=14,
        leading=17,
    )
    section = ParagraphStyle(
        "AppSection",
        parent=base,
        fontName=FONT_BOLD,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#555555"),
    )
    thanks = ParagraphStyle(
        "AppThanks", parent=base, fontName=FONT_BOLD, fontSize=10, leading=13
    )
    center = ParagraphStyle("AppCenter", parent=small, alignment=TA_CENTER)

    business_name = invoice.business_name or settings.business_name
    business_address = invoice.business_address or settings.business_address
    business_phone = invoice.business_phone or settings.business_phone
    business_email = invoice.business_email or settings.business_email
    business_gstin = invoice.business_gstin or settings.business_gstin

    business_lines = [f"<b>{escape(business_name)}</b>"]
    if business_address:
        business_lines.append(escape(business_address).replace("\n", "<br/>"))
    contact = " | ".join(
        escape(part) for part in [business_phone, business_email] if part
    )
    if contact:
        business_lines.append(contact)
    if business_gstin:
        business_lines.append(f"GSTIN: {escape(business_gstin)}")
    business_para = Paragraph("<br/>".join(business_lines), company)

    created = invoice.created_at
    created_text = created.strftime("%d %b %Y, %I:%M %p") if created else "-"
    status_label = (invoice.payment_status or "pending").replace("_", " ").title()
    method_label = (invoice.payment_method or "cash").replace("_", " ").title()

    meta_rows = [
        ["Invoice No.", invoice.invoice_number],
        ["Invoice Date", created_text],
        ["Payment Status", status_label],
        ["Payment Method", method_label],
    ]
    meta_table = Table(meta_rows, colWidths=[30 * mm, 48 * mm], hAlign="RIGHT")
    meta_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), FONT_BOLD),
                ("FONTNAME", (1, 0), (1, -1), FONT_REGULAR),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#666666")),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )

    header = Table(
        [[business_para, [Paragraph("INVOICE", title), meta_table]]],
        colWidths=[105 * mm, 73 * mm],
    )
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )

    customer_lines = [
        f"<b>{escape(invoice.customer_name or 'Walk-in Customer')}</b>"
    ]
    if invoice.customer_business_name:
        customer_lines.append(escape(invoice.customer_business_name))
    if invoice.customer_phone:
        customer_lines.append(f"Phone: {escape(invoice.customer_phone)}")
    if invoice.customer_address:
        customer_lines.append(
            escape(invoice.customer_address).replace("\n", "<br/>")
        )
    if invoice.customer_gstin:
        customer_lines.append(f"GSTIN: {escape(invoice.customer_gstin)}")
    customer_para = Paragraph("<br/>".join(customer_lines), base)

    info_rows = [
        [
            Paragraph("BILLED TO", section),
            Paragraph("PAYMENT", section),
        ],
        [
            customer_para,
            Paragraph(
                f"Amount Paid: {format_inr(invoice.amount_paid)}<br/>"
                f"Balance Due: {format_inr(invoice.balance_due)}",
                base,
            ),
        ],
    ]
    info_table = Table(info_rows, colWidths=[115 * mm, 63 * mm])
    info_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )

    item_header = ["SKU", "Product", "Qty", "Unit Price", "Tax", "Amount"]
    item_rows = [item_header]
    for item in invoice.items:
        tax_text = f"{float(item.tax_rate or 0):g}%"
        if item.tax_amount:
            tax_text += f" ({format_inr(item.tax_amount)})"
        item_rows.append(
            [
                item.sku or "-",
                Paragraph(escape(item.product_name or "Product"), base),
                f"{item.quantity} {item.unit or ''}".strip(),
                format_inr(item.unit_price),
                tax_text,
                format_inr(item.line_total),
            ]
        )
    if len(item_rows) == 1:
        item_rows.append(["-", "No line items", "", "", "", ""])

    items_table = Table(
        item_rows,
        colWidths=[24 * mm, 59 * mm, 20 * mm, 27 * mm, 27 * mm, 21 * mm],
        repeatRows=1,
    )
    items_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f1ee")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#333333")),
                ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
                ("FONTNAME", (0, 1), (-1, -1), FONT_REGULAR),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
                ("ALIGN", (2, 0), (-1, 0), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#dddddd")),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )

    summary_rows = [
        ["Subtotal", format_inr(invoice.subtotal)],
        ["Discount", f"-{format_inr(invoice.discount)}"],
        ["Taxable Amount", format_inr(invoice.taxable_amount)],
    ]
    if invoice.cgst:
        summary_rows.append(["CGST", format_inr(invoice.cgst)])
    if invoice.sgst:
        summary_rows.append(["SGST", format_inr(invoice.sgst)])
    if invoice.igst:
        summary_rows.append(["IGST", format_inr(invoice.igst)])
    if invoice.tax:
        summary_rows.append(["Total Tax", format_inr(invoice.tax)])
    summary_rows.extend(
        [
            ["Grand Total", format_inr(invoice.total)],
            ["Amount Paid", format_inr(invoice.amount_paid)],
            ["Balance Due", format_inr(invoice.balance_due)],
        ]
    )
    summary_table = Table(summary_rows, colWidths=[38 * mm, 34 * mm], hAlign="RIGHT")
    summary_style = [
        ("FONTNAME", (0, 0), (-1, -1), FONT_REGULAR),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#555555")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEABOVE", (0, 0), (-1, 0), 0.4, colors.HexColor("#dddddd")),
    ]
    grand_index = next(
        index for index, row in enumerate(summary_rows) if row[0] == "Grand Total"
    )
    summary_style.extend(
        [
            ("FONTNAME", (0, grand_index), (-1, grand_index), FONT_BOLD),
            ("FONTSIZE", (0, grand_index), (-1, grand_index), 10),
            ("LINEABOVE", (0, grand_index), (-1, grand_index), 0.7, colors.HexColor("#999999")),
            ("LINEBELOW", (0, grand_index), (-1, grand_index), 0.7, colors.HexColor("#999999")),
        ]
    )
    summary_table.setStyle(TableStyle(summary_style))

    words_table = Table(
        [
            [
                Paragraph(
                    f"<b>Amount in words:</b> {amount_in_words(invoice.total)}",
                    base,
                )
            ]
        ],
        colWidths=[115 * mm],
    )
    words_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#dddddd")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fafaf8")),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )

    footer_parts = []
    if invoice.notes:
        footer_parts.append(
            Paragraph(f"<b>Notes:</b> {escape(invoice.notes)}", small)
        )
    if settings.payment_terms:
        footer_parts.append(
            Paragraph(
                f"<b>Payment terms:</b> {escape(settings.payment_terms)}", small
            )
        )
    if settings.thank_you_message:
        footer_parts.append(Paragraph(escape(settings.thank_you_message), thanks))
    footer_parts.append(
        Paragraph(
            "This is a computer-generated invoice. No signature is required.",
            center,
        )
    )

    story = [
        header,
        HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#cccccc")),
        Spacer(1, 8),
        info_table,
        Spacer(1, 10),
        items_table,
        Spacer(1, 8),
        Table(
            [[words_table, summary_table]],
            colWidths=[115 * mm, 63 * mm],
        ),
        Spacer(1, 10),
        *footer_parts,
    ]
    doc.build(story)
    buffer.seek(0)
    return buffer
