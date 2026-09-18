import * as XLSX from "xlsx";
import { format } from "date-fns";
import { bucketOfStatus } from "@/lib/booking-status";
import { PLACE_OF_SUPPLY_STATE } from "@/lib/accounts-export";

export interface CaBooking {
  id: string;
  payment_id: string | null;
  payment_status: string | null;
  status: string | null;
  courier_name: string | null;
  courier_price: number | null;
  courier_rate: number | null;
  base_fare: number | null;
  platform_fee: number | null;
  consumer_platform_fee: number | null;
  gst: number | null;
  packaging_amount: number | null;
  insurance_amount: number | null;
  sender_name: string | null;
  sender_phone: string | null;
  sender_city: string | null;
  sender_state: string | null;
  sender_pincode: string | null;
  receiver_name: string | null;
  receiver_city: string | null;
  receiver_state: string | null;
  receiver_pincode: string | null;
  tracking_id: string | null;
  prayog_awb: string | null;
  booking_source: string | null;
  account_type: string | null;
  box_count: number | null;
  refund_id: string | null;
  refund_reason: string | null;
  created_at: string;
}

export interface CaPayment {
  id: string;
  order_id: string | null;
  amount: number;
  amount_refunded: number;
  currency: string;
  method: string | null;
  contact: string | null;
  email: string | null;
  created_at: number;
  status: string;
}

export interface CaRefund {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
  created_at: number;
  notes?: Record<string, string> | null;
}

export interface CaException {
  type: string;
  payment_id?: string | null;
  booking_id?: string | null;
  amount?: number;
  detail: string;
}

export interface CaReportData {
  range: { from: string; to: string };
  payments: CaPayment[];
  refunds: CaRefund[];
  bookings: CaBooking[];
  exceptions: CaException[];
  cancellation_events: Record<string, string>;
}

const n = (value: unknown) => Number(value) || 0;
const money = '#,##0.00;(#,##0.00);"-"';
const istDateTime = (value: number | string | Date) => new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(value instanceof Date ? value : new Date(typeof value === "number" ? value * 1000 : value)).replace(",", "");
const dateTime = (unixSeconds: number) => istDateTime(unixSeconds);
const paymentAmount = (payment: CaPayment) => n(payment.amount) / 100;
const refundAmount = (refund: CaRefund) => n(refund.amount) / 100;

function gstSplit(gst: number, senderState: string | null) {
  const intra = (senderState || "").trim().toLowerCase() === PLACE_OF_SUPPLY_STATE.toLowerCase();
  if (!intra) return { cgst: 0, sgst: 0, igst: gst };
  const cgst = Math.round((gst / 2) * 100) / 100;
  return { cgst, sgst: gst - cgst, igst: 0 };
}

function bookingAmounts(booking: CaBooking) {
  const total = n(booking.courier_price);
  const gst = n(booking.gst);
  const packaging = n(booking.packaging_amount);
  const insurance = n(booking.insurance_amount);
  const taxable = Math.max(0, total - gst);
  const platform = n(booking.platform_fee);
  const partner = n(booking.courier_rate) || Math.max(0, n(booking.base_fare) - platform);
  return { total, gst, packaging, insurance, taxable, platform, partner };
}

function isReliableBooking(payment: CaPayment, booking: CaBooking) {
  const captured = paymentAmount(payment);
  const values = bookingAmounts(booking);
  const storedSplit = n(booking.base_fare) + values.gst + values.packaging + values.insurance;
  const incomplete = ["pending_payment", "payment_abandoned"].includes(String(booking.status || "").toLowerCase());
  return !incomplete && Math.abs(captured - values.total) <= 1 && Math.abs(storedSplit - values.total) <= 1;
}

function addSheet(
  workbook: XLSX.WorkBook,
  name: string,
  rows: (string | number | { f: string })[][],
  moneyColumns: number[] = [],
) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 } as never;
  if (rows.length > 1 && rows[0]?.length) {
    sheet["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(rows[0].length - 1)}${rows.length}` };
  }
  sheet["!cols"] = (rows[0] || []).map((header) => ({
    wch: Math.min(34, Math.max(12, String(header).length + 3)),
  }));
  for (let row = 2; row <= rows.length; row += 1) {
    for (const column of moneyColumns) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row - 1, c: column })];
      if (cell) cell.z = money;
    }
  }
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

export function buildCaWorkbook(data: CaReportData, generatedBy = "admin"): Blob {
  const workbook = XLSX.utils.book_new();
  const bookingByPayment = new Map(data.bookings.filter((b) => b.payment_id).map((b) => [b.payment_id as string, b]));
  const paymentById = new Map(data.payments.map((payment) => [payment.id, payment]));
  const periodStart = new Date(data.range.from).getTime() / 1000;
  const periodEnd = new Date(data.range.to).getTime() / 1000;
  const validSales = data.payments.filter((payment) => {
    const booking = bookingByPayment.get(payment.id);
    if (!booking || payment.status !== "captured" || payment.created_at < periodStart || payment.created_at > periodEnd) return false;
    return isReliableBooking(payment, booking);
  });

  const salesHeader = [
    "Payment Date (IST)", "Payment ID", "Razorpay Order ID", "Booking ID", "AWB", "Order Status",
    "Account Type", "Booking Source", "Customer", "Customer Phone", "Sender State", "Receiver State",
    "Courier", "Payment Method", "Captured Amount", "Stored Order Total", "Taxable Value", "CGST", "SGST",
    "IGST", "GST Total", "Partner Cost", "ViaSetu Revenue", "Packaging", "Insurance", "Reconciliation Difference",
  ];
  const salesRows: (string | number | { f: string })[][] = [salesHeader];
  for (const payment of validSales) {
    const booking = bookingByPayment.get(payment.id);
    if (!booking) continue;
    const values = bookingAmounts(booking);
    const split = gstSplit(values.gst, booking.sender_state);
    const captured = paymentAmount(payment);
    salesRows.push([
      dateTime(payment.created_at), payment.id, payment.order_id || "", booking.id, booking.prayog_awb || booking.tracking_id || "",
      booking.status || "", booking.account_type || "consumer", booking.booking_source || "", booking.sender_name || "",
      booking.sender_phone || payment.contact || "", booking.sender_state || "", booking.receiver_state || "",
      booking.courier_name || "", payment.method || "", captured, values.total, values.taxable, split.cgst, split.sgst,
      split.igst, values.gst, values.partner, values.platform, values.packaging, values.insurance,
      Math.round((captured - values.total) * 100) / 100,
    ]);
  }
  addSheet(workbook, "Sales Register", salesRows, [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]);

  const creditHeader = [
    "Refund Date (IST)", "Credit Note Reference", "Refund Status", "Original Payment ID", "Original Payment Date (IST)",
    "Booking ID", "AWB", "Customer", "Courier", "Cancellation Date", "Refund Reason", "Refund Amount",
    "Taxable Value Reversed", "CGST Reversed", "SGST Reversed", "IGST Reversed", "GST Reversed",
  ];
  const creditRows: (string | number | { f: string })[][] = [creditHeader];
  for (const refund of data.refunds) {
    const payment = paymentById.get(refund.payment_id);
    const booking = bookingByPayment.get(refund.payment_id);
    const original = payment ? paymentAmount(payment) : 0;
    const refunded = refundAmount(refund);
    const reliable = Boolean(payment && booking && isReliableBooking(payment, booking));
    const ratio = reliable && original > 0 ? Math.min(1, refunded / original) : 0;
    const values = booking ? bookingAmounts(booking) : { taxable: 0, gst: 0 };
    const reversedTaxable = Math.round(values.taxable * ratio * 100) / 100;
    const reversedGst = Math.round(values.gst * ratio * 100) / 100;
    const split = gstSplit(reversedGst, booking?.sender_state || null);
    creditRows.push([
      dateTime(refund.created_at), refund.id, refund.status, refund.payment_id,
      payment ? dateTime(payment.created_at) : "", booking?.id || "", booking?.prayog_awb || booking?.tracking_id || "",
      booking?.sender_name || "", booking?.courier_name || "", booking ? data.cancellation_events[booking.id] || "" : "",
      booking?.refund_reason || refund.notes?.reason || "", refunded, reversedTaxable, split.cgst, split.sgst, split.igst, reversedGst,
    ]);
  }
  addSheet(workbook, "Credit Notes", creditRows, [11, 12, 13, 14, 15, 16]);

  const statusHeader = ["Booking Date", "Booking ID", "AWB", "Customer", "Courier", "Raw Status", "Status Group", "Payment Status", "Total"];
  const statusRows: (string | number | { f: string })[][] = [statusHeader];
  for (const booking of data.bookings) {
    statusRows.push([
      istDateTime(booking.created_at), booking.id, booking.prayog_awb || booking.tracking_id || "",
      booking.sender_name || "", booking.courier_name || "", booking.status || "", bucketOfStatus(booking.status),
      booking.payment_status || "", n(booking.courier_price),
    ]);
  }
  addSheet(workbook, "Order Status", statusRows, [8]);

  const reconciliationHeader = [
    "Payment ID", "Booking ID", "Classification", "Captured Amount", "Stored Booking Total", "Refunded Amount", "Net Cash",
    "Difference", "Payment Status", "Order Status", "Notes",
  ];
  const reconciliationRows: (string | number | { f: string })[][] = [reconciliationHeader];
  for (const payment of data.payments) {
    const booking = bookingByPayment.get(payment.id);
    const captured = paymentAmount(payment);
    const refunded = n(payment.amount_refunded) / 100;
    const stored = booking ? n(booking.courier_price) : 0;
    const classification = !booking ? "ORPHAN" : refunded >= captured && captured > 0 ? "REFUNDED" : "MATCHED";
    reconciliationRows.push([
      payment.id, booking?.id || "", classification, captured, stored, refunded, captured - refunded,
      booking ? Math.round((captured - stored) * 100) / 100 : captured, booking?.payment_status || "",
      booking?.status || "", booking ? "" : "Captured payment has no booking record",
    ]);
  }
  addSheet(workbook, "Payment Reconciliation", reconciliationRows, [3, 4, 5, 6, 7]);

  const salesLastRow = Math.max(2, salesRows.length);
  const creditLastRow = Math.max(2, creditRows.length);
  const summaryRows: (string | number | { f: string })[][] = [
    ["ViaSetu Monthly Billing & GST Report", "Value"],
    ["Reporting period", `${format(new Date(data.range.from), "dd MMM yyyy")} to ${format(new Date(data.range.to), "dd MMM yyyy")}`],
    ["Captured booked payments", { f: `MAX(0,COUNTA('Sales Register'!B2:B${salesLastRow}))` }],
    ["Gross collections", { f: `SUM('Sales Register'!O2:O${salesLastRow})` }],
    ["Gross taxable value", { f: `SUM('Sales Register'!Q2:Q${salesLastRow})` }],
    ["Gross GST", { f: `SUM('Sales Register'!U2:U${salesLastRow})` }],
    ["Credit notes", { f: `MAX(0,COUNTA('Credit Notes'!B2:B${creditLastRow}))` }],
    ["Refunds", { f: `SUM('Credit Notes'!L2:L${creditLastRow})` }],
    ["Taxable value reversed", { f: `SUM('Credit Notes'!M2:M${creditLastRow})` }],
    ["GST reversed", { f: `SUM('Credit Notes'!Q2:Q${creditLastRow})` }],
    ["Net collections", { f: "B4-B8" }],
    ["Net taxable value", { f: "B5-B9" }],
    ["Net GST payable", { f: "B6-B10" }],
    ["Exceptions requiring review", data.exceptions.length],
  ];
  addSheet(workbook, "Executive Summary", summaryRows, [1]);

  const gstRows: (string | number | { f: string })[][] = [
    ["Tax Type", "Gross Output Tax", "Credit Note Reversal", "Net Payable"],
    ["CGST", { f: `SUM('Sales Register'!R2:R${salesLastRow})` }, { f: `SUM('Credit Notes'!N2:N${creditLastRow})` }, { f: "B2-C2" }],
    ["SGST", { f: `SUM('Sales Register'!S2:S${salesLastRow})` }, { f: `SUM('Credit Notes'!O2:O${creditLastRow})` }, { f: "B3-C3" }],
    ["IGST", { f: `SUM('Sales Register'!T2:T${salesLastRow})` }, { f: `SUM('Credit Notes'!P2:P${creditLastRow})` }, { f: "B4-C4" }],
    ["TOTAL", { f: "SUM(B2:B4)" }, { f: "SUM(C2:C4)" }, { f: "SUM(D2:D4)" }],
  ];
  addSheet(workbook, "GST Summary", gstRows, [1, 2, 3]);

  const courierMap = new Map<string, { orders: number; gross: number; partner: number; revenue: number; refunds: number }>();
  for (const payment of validSales) {
    const booking = bookingByPayment.get(payment.id);
    if (!booking) continue;
    const key = booking.courier_name || "Unknown";
    const amounts = bookingAmounts(booking);
    const current = courierMap.get(key) || { orders: 0, gross: 0, partner: 0, revenue: 0, refunds: 0 };
    current.orders += 1;
    current.gross += paymentAmount(payment);
    current.partner += amounts.partner;
    current.revenue += amounts.platform;
    courierMap.set(key, current);
  }
  for (const refund of data.refunds) {
    const booking = bookingByPayment.get(refund.payment_id);
    const key = booking?.courier_name || "Unknown";
    const current = courierMap.get(key) || { orders: 0, gross: 0, partner: 0, revenue: 0, refunds: 0 };
    current.refunds += refundAmount(refund);
    courierMap.set(key, current);
  }
  const courierRows: (string | number | { f: string })[][] = [["Courier", "Orders", "Gross Collections", "Partner Cost", "ViaSetu Revenue", "Refunds", "Net Collections"]];
  for (const [courier, value] of courierMap) {
    courierRows.push([courier, value.orders, value.gross, value.partner, value.revenue, value.refunds, value.gross - value.refunds]);
  }
  addSheet(workbook, "Courier Summary", courierRows, [2, 3, 4, 5, 6]);

  const exceptionRows: (string | number | { f: string })[][] = [["Exception Type", "Payment ID", "Booking ID", "Amount", "Review Detail"]];
  for (const exception of data.exceptions) {
    exceptionRows.push([exception.type, exception.payment_id || "", exception.booking_id || "", exception.amount || 0, exception.detail]);
  }
  addSheet(workbook, "Exceptions", exceptionRows, [3]);

  const notesRows: (string | number | { f: string })[][] = [
    ["Report Notes", "Detail"],
    ["Generated at (IST)", istDateTime(new Date())],
    ["Generated by", generatedBy],
    ["Place of supply", PLACE_OF_SUPPLY_STATE],
    ["Sales date", "Actual Razorpay payment capture date"],
    ["Credit note date", "Actual Razorpay refund creation date"],
    ["Historical values", "Stored booking values are preserved; current pricing rules are not reapplied"],
    ["GST split", "Maharashtra sender state: CGST + SGST; other states: IGST"],
    ["Refund treatment", "Refunds are shown as separate credit notes and reverse tax proportionally for partial refunds"],
    ["Exceptions", "Excluded from tax totals when accounting evidence is incomplete or values do not reconcile"],
  ];
  addSheet(workbook, "Report Notes", notesRows);

  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array", cellStyles: true });
  return new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadCaWorkbook(data: CaReportData, label: string, generatedBy?: string) {
  const blob = buildCaWorkbook(data, generatedBy);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `viasetu-ca-report-${label.replace(/\s+/g, "-").toLowerCase()}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}