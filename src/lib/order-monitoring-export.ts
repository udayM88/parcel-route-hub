import { format } from "date-fns";
import * as XLSX from "xlsx";

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
  "Tracking ID / AWB",
  "Partner Order ID",
  "Created At",
  "Last Updated",
  "Order Status",
  "Payment Status",
  "Booking Source",
  "Courier Partner",
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
  "Estimated Delivery",
  "Declared Value (INR)",
  "Insurance Required",
  "Packaging Required",
  "Parcel Count",
  "Photo Count",
  "Total Amount (INR)",
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
    validDate(booking.updated_at),
    titleCase(booking.status, "Pending"),
    titleCase(booking.payment_status),
    text(booking.booking_source),
    text(booking.courier_name),
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
    text(booking.delivery_time),
    numberOrBlank(booking.shipment_value),
    yesNo(booking.insurance_required),
    yesNo(booking.packaging_required),
    numberOrBlank(booking.box_count),
    photoCount,
    numberOrBlank(booking.courier_price),
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
    [],
    [...HEADERS],
    ...rows.map(orderRow),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data, { cellDates: true });
  const lastColumn = XLSX.utils.encode_col(HEADERS.length - 1);
  const lastRow = Math.max(HEADER_ROW, HEADER_ROW + rows.length);

  worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS.length - 1 } }];
  worksheet["!autofilter"] = { ref: `A${HEADER_ROW}:${lastColumn}${lastRow}` };
  worksheet["!cols"] = HEADERS.map((header) => {
    if (header.includes("Address")) return { wch: 34 };
    if (header.includes("Name") || header.includes("Reason") || header.includes("Review")) return { wch: 26 };
    if (header.includes("Date") || header.includes("Updated") || header.includes("Created")) return { wch: 20 };
    if (header.includes("ID") || header.includes("AWB")) return { wch: 24 };
    if (header.includes("Amount") || header.includes("Revenue") || header.includes("Cost")) return { wch: 22 };
    return { wch: Math.min(Math.max(header.length + 2, 14), 24) };
  });
  (worksheet as XLSX.WorkSheet & { "!freeze"?: { xSplit: number; ySplit: number } })["!freeze"] = {
    xSplit: 0,
    ySplit: HEADER_ROW,
  };

  if (worksheet.B2) worksheet.B2.z = "dd mmm yyyy hh:mm";
  for (let row = HEADER_ROW + 1; row <= lastRow; row += 1) {
    ["D", "E"].forEach((column) => {
      const cell = worksheet[`${column}${row}`];
      if (cell) cell.z = "dd mmm yyyy hh:mm";
    });
    ["X", "Y", "Z", "AA", "AB", "AC", "AD"].forEach((column) => {
      const cell = worksheet[`${column}${row}`];
      if (cell) cell.z = NUMBER_FORMAT;
    });
    ["AG", "AL", "AM", "AN", "AO", "AP", "AQ", "AU", "AV"].forEach((column) => {
      const cell = worksheet[`${column}${row}`];
      if (cell) cell.z = MONEY_FORMAT;
    });
  }

  const titleCell = worksheet.A1;
  if (titleCell) {
    titleCell.s = { font: { bold: true, sz: 16, color: { rgb: "16324F" } } };
  }
  HEADERS.forEach((_, columnIndex) => {
    const cell = worksheet[XLSX.utils.encode_cell({ r: HEADER_ROW - 1, c: columnIndex })];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "16324F" } },
        alignment: { vertical: "center", wrapText: true },
      };
    }
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
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
