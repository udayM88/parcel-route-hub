// Accounts-ready Excel export for ViaSetu bookings.
// Produces a multi-sheet .xlsx with line-item split of Partner Payable,
// Platform Fee, CGST/SGST/IGST, packaging, insurance and grand total.
import { bookingFinancials } from "./booking-financials";
import * as XLSX from "xlsx";
import { format } from "date-fns";

// ViaSetu's place of supply (GST-registered state — Maharashtra, Pune).
// Intra-state => CGST+SGST, inter-state => IGST.
// Change this single constant if accounts revises.
export const PLACE_OF_SUPPLY_STATE = "Maharashtra";

export interface ExportBooking {
  id: string;
  tracking_id: string | null;
  prayog_order_id?: string | null;
  prayog_awb?: string | null;
  courier_name: string | null;
  courier_price: number | null;
  status: string | null;
  payment_status: string | null;
  payment_id?: string | null;
  refund_id?: string | null;
  booking_source?: string | null;
  created_at: string;
  sender_name?: string | null;
  sender_city?: string | null;
  sender_state?: string | null;
  sender_pincode?: string | null;
  receiver_name?: string | null;
  receiver_city?: string | null;
  receiver_state?: string | null;
  receiver_pincode?: string | null;
  goods_type?: string | null;
  package_weight?: string | null;
  chargeable_weight_g?: number | null;
  length?: string | null;
  width?: string | null;
  height?: string | null;
  shipment_value?: number | null;
  courier_rate?: number | null;
  base_fare?: number | null;
  platform_fee?: number | null;
  gst?: number | null;
  packaging_amount?: number | null;
  insurance_amount?: number | null;
}

const n = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

function splitGst(gst: number, senderState: string | null | undefined) {
  const intra = (senderState || "").trim().toLowerCase() === PLACE_OF_SUPPLY_STATE.toLowerCase();
  if (intra) {
    const half = Math.round((gst / 2) * 100) / 100;
    // ensure halves sum to original gst exactly
    return { cgst: half, sgst: gst - half, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: gst };
}

function partnerPayableOf(b: ExportBooking) {
  return bookingFinancials(b).courierCost;
}

const HEADERS = [
  "Order ID",
  "Booking Date",
  "Booking Time",
  "Invoice Month",
  "Status",
  "Payment Status",
  "Razorpay Payment ID",
  "Refund ID",
  "Courier Partner",
  "Booking Source",
  "AWB",
  "Sender Name",
  "Sender City",
  "Sender State",
  "Sender Pincode",
  "Receiver Name",
  "Receiver City",
  "Receiver State",
  "Receiver Pincode",
  "Goods Type",
  "Dead Weight (kg)",
  "Chargeable Weight (kg)",
  "L (cm)",
  "W (cm)",
  "H (cm)",
  "Shipment Value",
  "Courier Cost (quoted)",
  "Platform Revenue (excl. GST)",
  "Taxable Value",
  "CGST",
  "SGST",
  "IGST",
  "GST Total",
  "Packaging",
  "Insurance",
  "Grand Total",
  "Reconciliation Diff",
  "Outstanding Partner Payable",
  "Accounting Review",
];

// Column letter helper (1-indexed)
function colLetter(idx: number): string {
  let s = "";
  let i = idx;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

const MONEY_FMT = '#,##0;(#,##0);"-"';
const NUM_FMT = "0.00";

export interface BuildOptions {
  rangeLabel: string;
  generatedBy?: string;
}

export function buildAccountsWorkbook(
  rows: ExportBooking[],
  opts: BuildOptions,
): Blob {
  const wb = XLSX.utils.book_new();

  // ───── Sheet 1: Orders ────────────────────────────────────────────
  const aoa: (string | number)[][] = [HEADERS];
  rows.forEach((b) => {
    const d = new Date(b.created_at);
    const total = n(b.courier_price);
    const platform = bookingFinancials(b).platformRevenue;
    const gst = n(b.gst);
    const pkg = n(b.packaging_amount);
    const ins = n(b.insurance_amount);
    const partnerPayable = partnerPayableOf(b);
    const taxable = partnerPayable + platform;
    const { cgst, sgst, igst } = splitGst(gst, b.sender_state);
    const grand = total;
    const recon =
      Math.round((partnerPayable + platform + gst + pkg + ins - total) * 100) / 100;
    aoa.push([
      b.tracking_id || b.prayog_order_id || b.id.slice(0, 8),
      format(d, "dd/MM/yyyy"),
      format(d, "HH:mm"),
      format(d, "MMM yyyy"),
      b.status || "pending",
      b.payment_status || "",
      b.payment_id || "",
      b.refund_id || "",
      b.courier_name || "",
      b.booking_source || "",
      b.prayog_awb || "",
      b.sender_name || "",
      b.sender_city || "",
      b.sender_state || "",
      b.sender_pincode || "",
      b.receiver_name || "",
      b.receiver_city || "",
      b.receiver_state || "",
      b.receiver_pincode || "",
      b.goods_type || "",
      n(b.package_weight),
      b.chargeable_weight_g ? n(b.chargeable_weight_g) / 1000 : 0,
      n(b.length),
      n(b.width),
      n(b.height),
      n(b.shipment_value),
      partnerPayable,
      platform,
      taxable,
      cgst,
      sgst,
      igst,
      gst,
      pkg,
      ins,
      grand,
      recon,
      bookingFinancials(b).partnerPayable,
      bookingFinancials(b).needsReview ? "Review required: saved rate missing or inconsistent" : "Verified saved courier rate",
    ]);
  });

  // Totals row using SUM formulas
  const lastDataRow = rows.length + 1; // header is row 1
  const totalsRowIdx = lastDataRow + 1;
  const totalsRow: (string | number)[] = new Array(HEADERS.length).fill("");
  totalsRow[0] = "TOTAL";
  // Numeric columns (1-indexed positions): 21..37
  for (let c = 21; c <= 37; c++) {
    const L = colLetter(c);
    totalsRow[c - 1] = { f: `SUM(${L}2:${L}${lastDataRow})` } as unknown as string;
  }
  aoa.push(totalsRow as never);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Apply number formats to numeric columns
  const moneyCols = [27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 26];
  const weightCols = [21, 22, 23, 24, 25];
  for (let r = 2; r <= totalsRowIdx; r++) {
    moneyCols.forEach((c) => {
      const ref = colLetter(c) + r;
      const cell = ws[ref];
      if (cell) cell.z = MONEY_FMT;
    });
    weightCols.forEach((c) => {
      const ref = colLetter(c) + r;
      const cell = ws[ref];
      if (cell) cell.z = NUM_FMT;
    });
  }

  // Freeze header + autofilter
  ws["!freeze"] = { xSplit: 0, ySplit: 1 } as never;
  (ws as unknown as { "!autofilter"?: { ref: string } })["!autofilter"] = {
    ref: `A1:${colLetter(HEADERS.length)}${lastDataRow}`,
  };

  // Column widths
  ws["!cols"] = HEADERS.map((h) => ({
    wch: Math.min(28, Math.max(10, h.length + 2)),
  }));

  XLSX.utils.book_append_sheet(wb, ws, "Orders");

  // ───── Sheet 2: Monthly Summary (SUMIFS into Orders) ──────────────
  const months = Array.from(new Set(rows.map((b) => format(new Date(b.created_at), "MMM yyyy"))));
  const monthHeaders = [
    "Invoice Month",
    "Orders",
    "Gross Collections",
    "Partner Payable",
    "Platform Fee",
    "CGST",
    "SGST",
    "IGST",
    "Packaging",
    "Insurance",
  ];
  const sumifsCol = (col: number, monthRow: number) =>
    `SUMIFS(Orders!${colLetter(col)}2:${colLetter(col)}${lastDataRow},Orders!D2:D${lastDataRow},A${monthRow})`;
  const monthlyAoa: (string | number | { f: string })[][] = [monthHeaders];
  months.forEach((m, i) => {
    const r = i + 2;
    monthlyAoa.push([
      m,
      { f: `COUNTIF(Orders!D2:D${lastDataRow},A${r})` },
      { f: sumifsCol(36, r) }, // Grand Total
      { f: sumifsCol(38, r) },
      { f: sumifsCol(28, r) },
      { f: sumifsCol(30, r) },
      { f: sumifsCol(31, r) },
      { f: sumifsCol(32, r) },
      { f: sumifsCol(34, r) },
      { f: sumifsCol(35, r) },
    ]);
  });
  const wsMonthly = XLSX.utils.aoa_to_sheet(monthlyAoa);
  for (let r = 2; r <= months.length + 1; r++) {
    for (let c = 3; c <= 10; c++) {
      const cell = wsMonthly[colLetter(c) + r];
      if (cell) cell.z = MONEY_FMT;
    }
  }
  wsMonthly["!cols"] = monthHeaders.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, wsMonthly, "Monthly Summary");

  // ───── Sheet 3: Partner Summary ───────────────────────────────────
  const partners = Array.from(new Set(rows.map((b) => b.courier_name || "—")));
  const partnerHeaders = ["Courier Partner", "Orders", "Gross Collections", "Partner Payable", "Platform Fee", "Avg Ticket"];
  const partnerAoa: (string | number | { f: string })[][] = [partnerHeaders];
  partners.forEach((p, i) => {
    const r = i + 2;
    partnerAoa.push([
      p,
      { f: `COUNTIF(Orders!I2:I${lastDataRow},A${r})` },
      { f: `SUMIFS(Orders!AJ2:AJ${lastDataRow},Orders!I2:I${lastDataRow},A${r})` },
      { f: `SUMIFS(Orders!AL2:AL${lastDataRow},Orders!I2:I${lastDataRow},A${r})` },
      { f: `SUMIFS(Orders!AB2:AB${lastDataRow},Orders!I2:I${lastDataRow},A${r})` },
      { f: `IFERROR(C${r}/B${r},0)` },
    ]);
  });
  const wsPartner = XLSX.utils.aoa_to_sheet(partnerAoa);
  for (let r = 2; r <= partners.length + 1; r++) {
    ["C", "D", "E", "F"].forEach((L) => {
      const cell = wsPartner[L + r];
      if (cell) cell.z = MONEY_FMT;
    });
  }
  wsPartner["!cols"] = partnerHeaders.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, wsPartner, "Partner Summary");

  // ───── Sheet 4: GST Summary ───────────────────────────────────────
  const intra = rows.filter((b) => (b.sender_state || "").trim().toLowerCase() === PLACE_OF_SUPPLY_STATE.toLowerCase());
  const inter = rows.filter((b) => (b.sender_state || "").trim().toLowerCase() !== PLACE_OF_SUPPLY_STATE.toLowerCase());
  const sumField = (list: ExportBooking[], pick: (b: ExportBooking) => number) =>
    list.reduce((a, b) => a + pick(b), 0);
  const intraTaxable = sumField(intra, (b) => partnerPayableOf(b) + bookingFinancials(b).platformRevenue);
  const interTaxable = sumField(inter, (b) => partnerPayableOf(b) + bookingFinancials(b).platformRevenue);
  const intraGst = sumField(intra, (b) => n(b.gst));
  const interGst = sumField(inter, (b) => n(b.gst));
  const gstAoa: (string | number)[][] = [
    ["Category", "Orders", "Taxable Value", "CGST", "SGST", "IGST", "Total GST"],
    [`Intra-state (${PLACE_OF_SUPPLY_STATE})`, intra.length, intraTaxable, intraGst / 2, intraGst / 2, 0, intraGst],
    ["Inter-state", inter.length, interTaxable, 0, 0, interGst, interGst],
    ["TOTAL", rows.length, intraTaxable + interTaxable, intraGst / 2, intraGst / 2, interGst, intraGst + interGst],
  ];
  const wsGst = XLSX.utils.aoa_to_sheet(gstAoa);
  for (let r = 2; r <= 4; r++) {
    ["C", "D", "E", "F", "G"].forEach((L) => {
      const cell = wsGst[L + r];
      if (cell) cell.z = MONEY_FMT;
    });
  }
  wsGst["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsGst, "GST Summary");

  // ───── Sheet 5: Meta ──────────────────────────────────────────────
  const meta: (string | number)[][] = [
    ["ViaSetu — Accounts Report"],
    [],
    ["Generated at (IST)", format(new Date(), "dd MMM yyyy, HH:mm")],
    ["Generated by", opts.generatedBy || "admin"],
    ["Date range", opts.rangeLabel],
    ["Row count", rows.length],
    ["Place of supply", PLACE_OF_SUPPLY_STATE],
    [],
    ["Definitions"],
    ["Partner Payable", "Saved courier cost; failed/refunded quotes are not outstanding payables. Legacy missing-rate rows require review."],
    ["Platform Fee", "ViaSetu margin (hidden inside Base Fare in customer UI)"],
    ["Taxable Value", "Partner Payable + Platform Fee (== base_fare)"],
    ["CGST/SGST", "Each = GST/2 when sender state = place of supply (intra-state)"],
    ["IGST", "Full GST when sender state ≠ place of supply (inter-state)"],
    ["Grand Total", "Stored courier_price (amount charged; extras already included)"],
    ["Reconciliation Diff", "Should be 0 ± ₹1. Non-zero indicates pricing drift to investigate."],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(meta);
  wsMeta["!cols"] = [{ wch: 24 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, "Meta");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadAccountsWorkbook(
  rows: ExportBooking[],
  opts: BuildOptions,
): void {
  const blob = buildAccountsWorkbook(rows, opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `viasetu-accounts-${opts.rangeLabel.replace(/\s+/g, "-").toLowerCase()}-${format(
    new Date(),
    "yyyyMMdd",
  )}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
