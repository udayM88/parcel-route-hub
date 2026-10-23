import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import * as XLSX from "xlsx";

import {
  buildOrderMonitoringWorkbook,
  filterOrderMonitoringBookings,
  hasInvalidOrderMonitoringDateRange,
  type OrderMonitoringBooking,
} from "./order-monitoring-export";

const bookings: OrderMonitoringBooking[] = [
  {
    id: "order-pending",
    tracking_id: null,
    status: "pending",
    payment_status: "paid",
    created_at: "2026-10-20T10:00:00+05:30",
    sender_name: "Alpha Sender",
    receiver_name: "First Receiver",
  },
  {
    id: "order-active",
    tracking_id: "AWB-200",
    prayog_awb: "AWB-200",
    status: "in_transit",
    payment_status: "paid",
    created_at: "2026-10-21T11:00:00+05:30",
    sender_name: "Beta Sender",
    receiver_name: "Second Receiver",
  },
  {
    id: "order-delivered",
    tracking_id: "AWB-300",
    status: "delivered",
    payment_status: "paid",
    created_at: "2026-10-22T12:00:00+05:30",
    sender_name: "Gamma Sender",
    receiver_name: "Third Receiver",
  },
  {
    id: "order-rto",
    tracking_id: "AWB-400",
    status: "rto",
    payment_status: "cop_pending",
    created_at: "2026-10-23T13:00:00+05:30",
    sender_name: "Delta Sender",
    receiver_name: "Fourth Receiver",
  },
];

describe("order monitoring Excel export", () => {
  test("applies search, status, date and active-tab filters together", () => {
    const rows = filterOrderMonitoringBookings(bookings, {
      searchTerm: "awb-200",
      statusFilter: "in_transit",
      dateFrom: new Date(2026, 9, 21),
      dateTo: new Date(2026, 9, 21),
      view: "active",
    });

    assert.deepEqual(rows.map((row) => row.id), ["order-active"]);
  });

  test("keeps completed and cancelled/RTO scopes distinct", () => {
    const completed = filterOrderMonitoringBookings(bookings, {
      searchTerm: "",
      statusFilter: "all",
      view: "completed",
    });
    const cancelled = filterOrderMonitoringBookings(bookings, {
      searchTerm: "",
      statusFilter: "cancelled",
      view: "all",
    });

    assert.deepEqual(completed.map((row) => row.id), ["order-delivered"]);
    assert.deepEqual(cancelled.map((row) => row.id), ["order-rto"]);
  });

  test("rejects a reversed date range without throwing", () => {
    const dateFrom = new Date(2026, 9, 24);
    const dateTo = new Date(2026, 9, 23);
    assert.equal(hasInvalidOrderMonitoringDateRange(dateFrom, dateTo), true);
    assert.deepEqual(filterOrderMonitoringBookings(bookings, {
      searchTerm: "",
      statusFilter: "all",
      dateFrom,
      dateTo,
      view: "all",
    }), []);
  });

  test("creates a typed, filterable workbook without raw private diagnostics", async () => {
    const row: OrderMonitoringBooking = {
      id: "6a5dcb83-1111-2222-3333-123456789012",
      tracking_id: "AWB-500",
      prayog_awb: "AWB-500",
      prayog_order_id: "PARTNER-500",
      status: "in_transit",
      payment_status: "paid",
      booking_source: "merchant_api",
      courier_name: "Test Courier",
      created_at: "2026-10-23T10:15:00+05:30",
      updated_at: "2026-10-23T11:30:00+05:30",
      sender_name: "Sender",
      sender_phone: "09876543210",
      sender_address: "Pickup address",
      sender_city: "Pune",
      sender_state: "Maharashtra",
      sender_pincode: "001234",
      receiver_name: "Receiver",
      receiver_phone: "01234567890",
      receiver_address: "Delivery address",
      receiver_city: "Mumbai",
      receiver_state: "Maharashtra",
      receiver_pincode: "004321",
      goods_type: "documents",
      package_weight: "1.25",
      dead_weight_g: 1250,
      volumetric_weight_g: 1000,
      chargeable_weight_g: 1250,
      length: "20",
      width: "15",
      height: "10",
      urgency: "standard",
      delivery_time: "2-3 days",
      shipment_value: 500,
      insurance_required: false,
      packaging_required: true,
      box_count: 1,
      parcel_photos: [{ path: "private/photo.jpg" }],
      courier_price: 118,
      courier_rate: 60,
      base_fare: 100,
      platform_fee: 40,
      gst: 18,
      packaging_amount: 0,
      insurance_amount: 0,
      payment_id: "pay_500",
      refund_id: null,
      cancellation_fee: 0,
      refund_amount: 0,
    };

    const blob = buildOrderMonitoringWorkbook([row], {
      searchTerm: "awb-500",
      statusFilter: "in_transit",
      view: "active",
      generatedAt: new Date("2026-10-23T12:00:00+05:30"),
      generatedBy: "ops@viasetu.com",
    });
    const workbook = XLSX.read(await blob.arrayBuffer(), { cellDates: true });
    const sheet = workbook.Sheets.Orders;

    assert.equal(sheet.A1.v, "ViaSetu Order Monitoring Report");
    assert.equal(sheet.A9.v, "Order ID");
    assert.equal(sheet.A10.v, row.id);
    assert.equal(sheet.O10.v, "001234");
    assert.equal(sheet.O10.t, "s");
    assert.equal(sheet.X10.v, 1.25);
    assert.equal(sheet.AL10.v, 118);
    assert.equal(sheet.AM10.v, 60);
    assert.equal(sheet.AN10.v, 40);
    assert.equal(sheet.D7.v, 1);
    assert.equal(sheet["!autofilter"]?.ref, "A9:AX10");

    const headers = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      range: 8,
      blankrows: false,
    })[0];
    assert.equal(headers.includes("Partner Error Raw"), false);
    assert.equal(headers.includes("Label URL"), false);
  });
});
