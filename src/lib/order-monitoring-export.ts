import { format } from "date-fns";
import XLSX from "xlsx-js-style";

import { bookingFinancials } from "./booking-financials";
import { bucketOfStatus } from "./booking-status";

export type OrderMonitoringView = "all" | "active" | "completed";
export type OrderMonitoringStatusFilter =
  | "all"
  | "pending"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | "cop_pending";

export interface OrderMonitoringBooking {
  id: string;
  tracking_id?: string | null;
  prayog_order_id?: string | null;
  prayog_awb?: string | null;
  status?: string | null;
  payment_status?: string | null;
  booking_source?: string | null;
  courier_name?: string | null;
  created_at: string;
  updated_at?: string | null;
  pickup_date?: string | null;
  sender_name?: string | null;
  sender_phone?: string | null;
  sender_address?: string | null;
  sender_city?: string | null;
  sender_state?: string | null;
  sender_pincode?: string | null;
  receiver_name?: string | null;
  receiver_phone?: string | null;
  receiver_address?: string | null;
  receiver_city?: string | null;
  receiver_state?: string | null;
  receiver_pincode?: string | null;
  goods_type?: string | null;
  package_weight?: string | number | null;
  dead_weight_g?: number | null;
  volumetric_weight_g?: number | null;
  chargeable_weight_g?: number | null;
  length?: string | number | null;
  width?: string | number | null;
  height?: string | number | null;
  urgency?: string | null;
  delivery_time?: string | null;
  shipment_value?: number | null;
  insurance_required?: boolean | null;
  packaging_required?: boolean | null;
  box_count?: number | null;
  parcel_photos?: unknown;
  courier_price?: number | null;
  courier_rate?: number | null;
  base_fare?: number | null;
  platform_fee?: number | null;
  consumer_platform_fee?: number | null;
  gst?: number | null;
  packaging_amount?: number | null;
  insurance_amount?: number | null;
  payment_id?: string | null;
  refund_id?: string | null;
  cancellation_stage?: string | null;
  cancellation_fee?: number | null;
  refund_amount?: number | null;
  refund_reason?: string | null;
}

export interface OrderMonitoringFilters {
  searchTerm: string;
  statusFilter: OrderMonitoringStatusFilter;
  dateFrom?: Date;
  dateTo?: Date;
  view: OrderMonitoringView;
}

export interface OrderMonitoringWorkbookOptions extends OrderMonitoringFilters {
  generatedAt?: Date;
  generatedBy?: string;
}

const IN_TRANSIT_BUCKETS = new Set([
  "confirmed",
  "picked_up",
  "in_transit",
  "out_for_delivery",
]);

const HEADERS = [
  "Order ID",
  "AWB Number",
  "Partner Order ID",
  "Order Date & Time",
  "Pickup Date & Time",
  "Estimated Delivery (Shown at Booking)",
  "Parcel Amount (INR)",
  "Order Status",
  "Payment Status",
  "Booking Source",
  "Courier Partner",
  "Last Updated",
  "Sender Name",
  "Sender Phone",
  "Sender Address",
  "Sender City",
  "Sender State",
  "Sender Pincode",
  "Receiver Name",
  "Receiver Phone",
  "Receiver Address",
  "Receiver City",
  "Receiver State",
  "Receiver Pincode",
  "Route",
  "Goods Type",
  "Package Weight (kg)",
  "Dead Weight (kg)",
  "Volumetric Weight (kg)",
  "Chargeable Weight (kg)",
  "Length (cm)",
  "Width (cm)",
  "Height (cm)",
  "Urgency",
  "Declared Parcel Value (INR)",
  "Insurance Required",
  "Packaging Required",
  "Parcel Count",
  "Photo Count",
  "Courier Cost from Saved Order (INR)",
  "Platform Revenue excl. GST (INR)",
  "GST (INR)",
  "Packaging Amount (INR)",
  "Insurance Amount (INR)",
  "Payment ID",
  "Refund ID",
  "Cancellation Stage",
  "Cancellation Fee (INR)",
  "Refund Amount (INR)",
  "Refund Reason",
  "Accounting Review",
] as const;

const HEADER_ROW = 9;
const MONEY_FORMAT = '#,##0.00;[Red](#,##0.00);"-"';
const NUMBER_FORMAT = "0.00";
const COLORS = {
  navy: "102A43",
  navySoft: "DCE8F5",
  teal: "0F8F95",
  cyan: "20C9D7",
  cyanSoft: "E8FAFB",
  green: "1F7A4D",
  greenSoft: "E8F5EE",
  amberSoft: "FFF5DB",
  white: "FFFFFF",
  ink: "10233F",
  muted: "52606D",
  grid: "C9D7E3",
  stripe: "F7FAFC",
} as const;

const thinBorder = {
  top: { style: "thin", color: { rgb: COLORS.grid } },
  right: { style: "thin", color: { rgb: COLORS.grid } },
  bottom: { style: "thin", color: { rgb: COLORS.grid } },
  left: { style: "thin", color: { rgb: COLORS.grid } },
};

function startOfLocalDay(date: Date): number {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value.getTime();
}

function endOfLocalDay(date: Date): number {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value.getTime();
}

export function hasInvalidOrderMonitoringDateRange(dateFrom?: Date, dateTo?: Date): boolean {
  return Boolean(dateFrom && dateTo && startOfLocalDay(dateFrom) > endOfLocalDay(dateTo));
}

export function isPickupCompletionEvent(rawStatus?: string | null, rawCode?: string | null): boolean {
  if (String(rawCode || "").trim().toUpperCase() === "PU") return true;

  const status = String(rawStatus || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (!status.includes("pick")) return false;
  if (/(not|no) picked|out for pick|pick ?up attempt|attempt.*pick|pick.*fail|fail.*pick|pick.*pending|pending.*pick|pick.*cancel|cancel.*pick|pick.*scheduled|scheduled.*pick/.test(status)) {
    return false;
  }

  return /picked up|pick ?up (done|complete|completed|success|successful)/.test(status);
}

function matchesStatus(booking: OrderMonitoringBooking, statusFilter: OrderMonitoringStatusFilter): boolean {
  const bucket = bucketOfStatus(booking.status);
  switch (statusFilter) {
    case "pending":
      return bucket === "created";
    case "in_transit":
      return IN_TRANSIT_BUCKETS.has(bucket);
    case "delivered":
      return bucket === "delivered";
    case "cancelled":
      return bucket === "cancelled" || bucket === "rto";
    case "cop_pending":
      return booking.payment_status === "cop_pending";
    default:
      return true;
  }
}

function matchesView(booking: OrderMonitoringBooking, view: OrderMonitoringView): boolean {
  const bucket = bucketOfStatus(booking.status);
  if (view === "completed") return bucket === "delivered";
  if (view === "active") return bucket !== "delivered" && bucket !== "cancelled" && bucket !== "rto";
  return true;
}

export function filterOrderMonitoringBookings<T extends OrderMonitoringBooking>(
  rows: T[],
  filters: OrderMonitoringFilters,
): T[] {
  if (hasInvalidOrderMonitoringDateRange(filters.dateFrom, filters.dateTo)) return [];

  const search = filters.searchTerm.trim().toLocaleLowerCase();
  const from = filters.dateFrom ? startOfLocalDay(filters.dateFrom) : null;
  const to = filters.dateTo ? endOfLocalDay(filters.dateTo) : null;

  return rows.filter((booking) => {
    const createdAt = new Date(booking.created_at).getTime();
    if (!Number.isFinite(createdAt)) return false;
    if (from !== null && createdAt < from) return false;
    if (to !== null && createdAt > to) return false;

    if (search) {
      const searchableValues = [
        booking.id,
        booking.tracking_id,
        booking.prayog_awb,
        booking.prayog_order_id,
        booking.sender_name,
        booking.receiver_name,
      ];
      if (!searchableValues.some((value) => String(value || "").toLocaleLowerCase().includes(search))) {
        return false;
      }
    }

    return matchesStatus(booking, filters.statusFilter) && matchesView(booking, filters.view);
  });
}

function titleCase(value?: string | null, fallback = ""): string {
  if (!value) return fallback;
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function numberOrBlank(value: unknown): number | "" {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

function gramsToKilograms(value: unknown): number | "" {
  const grams = numberOrBlank(value);
  return grams === "" ? "" : grams / 1000;
}

function yesNo(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value ? "Yes" : "No";
}

function validDate(value?: string | null): Date | "" {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : "";
}

function viewLabel(view: OrderMonitoringView): string {
  if (view === "active") return "Active Orders";
  if (view === "completed") return "Completed Orders";
  return "All Orders";
}

function statusFilterLabel(status: OrderMonitoringStatusFilter): string {
  const labels: Record<OrderMonitoringStatusFilter, string> = {
    all: "All statuses",
    pending: "Pending",
    in_transit: "In Transit",
    delivered: "Delivered",
    cancelled: "Cancelled / RTO",
    cop_pending: "COP Pending",
  };
  return labels[status];
}

function dateRangeLabel(dateFrom?: Date, dateTo?: Date): string {
  if (dateFrom && dateTo) return `${format(dateFrom, "dd MMM yyyy")} to ${format(dateTo, "dd MMM yyyy")}`;
  if (dateFrom) return `From ${format(dateFrom, "dd MMM yyyy")}`;
  if (dateTo) return `Up to ${format(dateTo, "dd MMM yyyy")}`;
  return "All time";
}

function orderRow(booking: OrderMonitoringBooking): Array<string | number | Date> {
  const financials = bookingFinancials(booking);
  const photoCount = Array.isArray(booking.parcel_photos) ? booking.parcel_photos.length : 0;

  return [
    text(booking.id),
    text(booking.prayog_awb || booking.tracking_id),
    text(booking.prayog_order_id),
    validDate(booking.created_at),
    validDate(booking.pickup_date),
    text(booking.delivery_time),
    numberOrBlank(booking.courier_price),
    titleCase(booking.status, "Pending"),
    titleCase(booking.payment_status),
    text(booking.booking_source),
    text(booking.courier_name),
    validDate(booking.updated_at),
    text(booking.sender_name),
    text(booking.sender_phone),
    text(booking.sender_address),
    text(booking.sender_city),
    text(booking.sender_state),
    text(booking.sender_pincode),
    text(booking.receiver_name),
    text(booking.receiver_phone),
    text(booking.receiver_address),
    text(booking.receiver_city),
    text(booking.receiver_state),
    text(booking.receiver_pincode),
    `${text(booking.sender_pincode)} to ${text(booking.receiver_pincode)}`,
    text(booking.goods_type),
    numberOrBlank(booking.package_weight),
    gramsToKilograms(booking.dead_weight_g),
    gramsToKilograms(booking.volumetric_weight_g),
    gramsToKilograms(booking.chargeable_weight_g),
    numberOrBlank(booking.length),
    numberOrBlank(booking.width),
    numberOrBlank(booking.height),
    titleCase(booking.urgency),
    numberOrBlank(booking.shipment_value),
    yesNo(booking.insurance_required),
    yesNo(booking.packaging_required),
    numberOrBlank(booking.box_count),
    photoCount,
    financials.courierCost,
    financials.platformRevenue,
    numberOrBlank(booking.gst),
    numberOrBlank(booking.packaging_amount),
    numberOrBlank(booking.insurance_amount),
    text(booking.payment_id),
    text(booking.refund_id),
    titleCase(booking.cancellation_stage),
    numberOrBlank(booking.cancellation_fee),
    numberOrBlank(booking.refund_amount),
    text(booking.refund_reason),
    financials.needsReview ? "Review required: saved courier rate missing or inconsistent" : "Verified saved courier rate",
  ];
}

export function buildOrderMonitoringWorkbook(
  rows: OrderMonitoringBooking[],
  options: OrderMonitoringWorkbookOptions,
): Blob {
  const generatedAt = options.generatedAt || new Date();
  const data: Array<Array<string | number | Date>> = [
    ["ViaSetu Order Monitoring Report"],
    ["Generated at", generatedAt],
    ["Generated by", options.generatedBy || "admin"],
    ["Current view", viewLabel(options.view)],
    ["Status filter", statusFilterLabel(options.statusFilter)],
    ["Date range", dateRangeLabel(options.dateFrom, options.dateTo)],
    ["Search", options.searchTerm.trim() || "None", "Order count", rows.length],
    ["Pickup date source: earliest recorded pickup scan; blank when no pickup scan is available"],
    [...HEADERS],
    ...rows.map(orderRow),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data, { cellDates: true });
  const lastColumn = XLSX.utils.encode_col(HEADERS.length - 1);
  const lastRow = Math.max(HEADER_ROW, HEADER_ROW + rows.length);

  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS.length - 1 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: HEADERS.length - 1 } },
  ];
  worksheet["!autofilter"] = { ref: `A${HEADER_ROW}:${lastColumn}${lastRow}` };
  worksheet["!cols"] = HEADERS.map((header) => {
    if (header.includes("Address")) return { wch: 34 };
    if (header.includes("Name") || header.includes("Reason") || header.includes("Review")) return { wch: 26 };
    if (header.includes("Date") || header.includes("Updated") || header.includes("Created")) return { wch: 20 };
    if (header.includes("ID") || header.includes("AWB")) return { wch: 24 };
    if (header.includes("Amount") || header.includes("Revenue") || header.includes("Cost")) return { wch: 22 };
    return { wch: Math.min(Math.max(header.length + 2, 14), 24) };
  });
  worksheet["!rows"] = [
    { hpt: 30 },
    { hpt: 21 },
    { hpt: 21 },
    { hpt: 21 },
    { hpt: 21 },
    { hpt: 21 },
    { hpt: 21 },
    { hpt: 25 },
    { hpt: 42 },
    ...rows.map(() => ({ hpt: 30 })),
  ];
  (worksheet as XLSX.WorkSheet & { "!freeze"?: { xSplit: number; ySplit: number } })["!freeze"] = {
    xSplit: 2,
    ySplit: HEADER_ROW,
  };

  if (worksheet.B2) worksheet.B2.z = "dd mmm yyyy hh:mm";
  const dateColumns = new Set(["Order Date & Time", "Pickup Date & Time", "Last Updated"]);
  const numberColumns = new Set([
    "Package Weight (kg)",
    "Dead Weight (kg)",
    "Volumetric Weight (kg)",
    "Chargeable Weight (kg)",
    "Length (cm)",
    "Width (cm)",
    "Height (cm)",
  ]);
  const moneyColumns = new Set([
    "Parcel Amount (INR)",
    "Declared Parcel Value (INR)",
    "Courier Cost from Saved Order (INR)",
    "Platform Revenue excl. GST (INR)",
    "GST (INR)",
    "Packaging Amount (INR)",
    "Insurance Amount (INR)",
    "Cancellation Fee (INR)",
    "Refund Amount (INR)",
  ]);
  for (let row = HEADER_ROW + 1; row <= lastRow; row += 1) {
    HEADERS.forEach((header, columnIndex) => {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row - 1, c: columnIndex })];
      if (!cell) return;
      if (dateColumns.has(header)) cell.z = "dd mmm yyyy hh:mm";
      else if (numberColumns.has(header)) cell.z = NUMBER_FORMAT;
      else if (moneyColumns.has(header)) cell.z = MONEY_FORMAT;

      const isPrimary = columnIndex <= 6;
      const isAmount = header === "Parcel Amount (INR)";
      const fill = isAmount
        ? COLORS.greenSoft
        : isPrimary
          ? (row % 2 === 0 ? COLORS.cyanSoft : "F2FCFC")
          : (row % 2 === 0 ? COLORS.stripe : COLORS.white);
      cell.s = {
        fill: { patternType: "solid", fgColor: { rgb: fill } },
        font: {
          color: { rgb: COLORS.ink },
          bold: header === "AWB Number" || isAmount,
        },
        alignment: {
          vertical: "top",
          wrapText: header.includes("Address") || header.includes("Reason") || header.includes("Review"),
        },
        border: thinBorder,
      };
    });
  }

  const titleCell = worksheet.A1;
  if (titleCell) {
    titleCell.s = {
      font: { bold: true, sz: 17, color: { rgb: COLORS.white } },
      fill: { patternType: "solid", fgColor: { rgb: COLORS.navy } },
      alignment: { vertical: "center", horizontal: "left" },
      border: thinBorder,
    };
  }
  for (let metadataRow = 2; metadataRow <= 7; metadataRow += 1) {
    for (let column = 0; column < 4; column += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: metadataRow - 1, c: column })];
      if (!cell) continue;
      const isLabel = column % 2 === 0;
      cell.s = {
        font: { bold: isLabel, color: { rgb: isLabel ? COLORS.navy : COLORS.ink } },
        fill: { patternType: "solid", fgColor: { rgb: isLabel ? COLORS.navySoft : COLORS.white } },
        alignment: { vertical: "center" },
        border: thinBorder,
      };
    }
  }
  const pickupSourceCell = worksheet.A8;
  if (pickupSourceCell) {
    pickupSourceCell.s = {
      font: { italic: true, bold: true, color: { rgb: COLORS.navy } },
      fill: { patternType: "solid", fgColor: { rgb: COLORS.amberSoft } },
      alignment: { vertical: "center", horizontal: "left" },
      border: thinBorder,
    };
  }
  HEADERS.forEach((_, columnIndex) => {
    const cell = worksheet[XLSX.utils.encode_cell({ r: HEADER_ROW - 1, c: columnIndex })];
    if (cell) {
      const isPrimaryHeader = columnIndex <= 6;
      cell.s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { patternType: "solid", fgColor: { rgb: isPrimaryHeader ? COLORS.teal : COLORS.navy } },
        alignment: { vertical: "center", horizontal: "center", wrapText: true },
        border: {
          top: { style: "medium", color: { rgb: isPrimaryHeader ? COLORS.cyan : COLORS.navy } },
          right: { style: "thin", color: { rgb: COLORS.white } },
          bottom: { style: "medium", color: { rgb: COLORS.cyan } },
          left: { style: "thin", color: { rgb: COLORS.white } },
        },
      };
    }
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");

  const statusCounts = new Map<string, number>();
  rows.forEach((row) => {
    const status = titleCase(row.status, "Pending");
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  });
  const summary = XLSX.utils.aoa_to_sheet([
    ["ViaSetu Order Export Summary"],
    ["Generated at", generatedAt],
    ["Generated by", options.generatedBy || "admin"],
    ["Current view", viewLabel(options.view)],
    ["Status filter", statusFilterLabel(options.statusFilter)],
    ["Date range", dateRangeLabel(options.dateFrom, options.dateTo)],
    ["Search", options.searchTerm.trim() || "None"],
    [],
    ["Operational Summary", "Value"],
    ["Total orders", rows.length],
    ["Orders with AWB", rows.filter((row) => Boolean(row.prayog_awb || row.tracking_id)).length],
    ["Orders with pickup scan", rows.filter((row) => Boolean(row.pickup_date)).length],
    ["Total parcel amount (INR)", rows.reduce((sum, row) => sum + (Number(row.courier_price) || 0), 0)],
    [],
    ["Status Breakdown", "Orders"],
    ...Array.from(statusCounts.entries()).sort(([a], [b]) => a.localeCompare(b)),
  ], { cellDates: true });
  summary["!cols"] = [{ wch: 32 }, { wch: 28 }];
  summary["!rows"] = [
    { hpt: 30 },
    { hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 },
    { hpt: 12 },
    { hpt: 26 },
  ];
  summary["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  if (summary.B2) summary.B2.z = "dd mmm yyyy hh:mm";
  if (summary.B13) summary.B13.z = MONEY_FORMAT;
  const summaryRange = XLSX.utils.decode_range(summary["!ref"] || "A1:B1");
  for (let row = summaryRange.s.r; row <= summaryRange.e.r; row += 1) {
    for (let column = summaryRange.s.c; column <= summaryRange.e.c; column += 1) {
      const cell = summary[XLSX.utils.encode_cell({ r: row, c: column })];
      if (!cell) continue;
      const isTitle = row === 0;
      const isSectionHeader = row === 8 || row === 14;
      const isMoneyTotal = row === 12;
      cell.s = {
        font: {
          bold: isTitle || isSectionHeader || column === 0 || isMoneyTotal,
          sz: isTitle ? 17 : 11,
          color: { rgb: isTitle || isSectionHeader ? COLORS.white : isMoneyTotal ? COLORS.green : COLORS.ink },
        },
        fill: {
          patternType: "solid",
          fgColor: {
            rgb: isTitle
              ? COLORS.navy
              : isSectionHeader
                ? COLORS.teal
                : isMoneyTotal
                  ? COLORS.greenSoft
                  : row % 2 === 0
                    ? COLORS.stripe
                    : COLORS.white,
          },
        },
        alignment: { vertical: "center", wrapText: true },
        border: thinBorder,
      };
    }
  }
  XLSX.utils.book_append_sheet(workbook, summary, "Summary");
  workbook.Props = {
    Title: "ViaSetu Order Monitoring Report",
    Subject: `${viewLabel(options.view)} - ${dateRangeLabel(options.dateFrom, options.dateTo)}`,
    Author: options.generatedBy || "ViaSetu Admin",
    CreatedDate: generatedAt,
  };

  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array", cellStyles: true });
  return new Blob([output], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadOrderMonitoringWorkbook(
  rows: OrderMonitoringBooking[],
  options: OrderMonitoringWorkbookOptions,
): string {
  const generatedAt = options.generatedAt || new Date();
  const blob = buildOrderMonitoringWorkbook(rows, { ...options, generatedAt });
  const scope = options.view === "all" ? options.statusFilter : options.view;
  const filename = `viasetu-orders-${scope}-${format(generatedAt, "yyyyMMdd-HHmm")}.xlsx`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return filename;
}
