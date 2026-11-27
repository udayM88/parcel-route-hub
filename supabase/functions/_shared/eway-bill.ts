// Government e-way bill rule: consignments declared above ₹50,000 need an e-way bill.
export const EWAY_BILL_THRESHOLD = 50000;
export const requiresEwayBill = (value: unknown) => (Number(value) || 0) > EWAY_BILL_THRESHOLD;
export const isValidEwayBillNumber = (n: unknown) => /^\d{12}$/.test(String(n ?? "").replace(/\s/g, ""));
export function ewayBillError(value: unknown, number: unknown, path: unknown): string | null {
  if (!requiresEwayBill(value)) return null;
  if (!isValidEwayBillNumber(number)) return "A valid 12-digit E-Way Bill number is required for shipments above ₹50,000.";
  if (!String(path ?? "").trim()) return "Please upload the E-Way Bill document for shipments above ₹50,000.";
  return null;
}
