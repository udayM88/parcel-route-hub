import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, UserPlus, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";

type BusinessAccountRow = {
  id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  pan_number: string | null;
  gst_number: string | null;
  shop_act_number: string | null;
  monthly_shipments: number;
  city: string | null;
  state: string | null;
  documents: { name?: string; url?: string }[] | null;
  status: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
  deletion_reason: string | null;
  deletion_note: string | null;
  deleted_by_email: string | null;
};

const DELETION_REASONS: { value: string; label: string }[] = [
  { value: "duplicate_account", label: "Duplicate account" },
  { value: "business_closed", label: "Business closed / no longer shipping" },
  { value: "fraud_or_misuse", label: "Fraud or misuse" },
  { value: "kyc_invalid", label: "KYC documents invalid or expired" },
  { value: "requested_by_business", label: "Requested by the business" },
  { value: "non_payment", label: "Non-payment / dispute" },
  { value: "other", label: "Other" },
];

const reasonLabel = (value: string | null) =>
  DELETION_REASONS.find((r) => r.value === value)?.label ?? value ?? "—";

const emptyForm = {
  company_name: "",
  contact_person: "",
  email: "",
  phone: "",
  pan_number: "",
  gst_number: "",
  shop_act_number: "",
  monthly_shipments: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  notes: "",
};


const BusinessManagement = () => {
  const [rows, setRows] = useState<BusinessAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [docFiles, setDocFiles] = useState<File[]>([]);

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("business_accounts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load business accounts");
    setRows((data ?? []) as BusinessAccountRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, []);
  useRealtimeTable("business_accounts", () => fetchRows(), { channelName: "business-accounts-mgmt" });

  const setField = (key: keyof typeof emptyForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const uploadDocuments = async (): Promise<{ name: string; url: string }[]> => {
    const uploaded: { name: string; url: string }[] = [];
    for (const file of docFiles) {
      const path = `business-kyc/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("cms-media").upload(path, file);
      if (error) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }
      const { data } = supabase.storage.from("cms-media").getPublicUrl(path);
      uploaded.push({ name: file.name, url: data.publicUrl });
    }
    return uploaded;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(form.phone.trim())) { toast.error("Phone must be exactly 10 digits"); return; }
    setSubmitting(true);
    try {
      const documents = await uploadDocuments();
      const response = await supabase.functions.invoke("create-business-user", {
        body: {
          ...form,
          monthly_shipments: Number(form.monthly_shipments) || 0,
          documents,
        },
      });
      if (response.error) throw response.error;
      if (response.data?.error) { toast.error(response.data.error); return; }

      toast.success(`Business user created. A password setup email was sent to ${form.email}`);
      setOpen(false);
      setForm({ ...emptyForm });
      setDocFiles([]);
      fetchRows();
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message || "Failed to create business user");
    } finally {
      setSubmitting(false);
    }
  };

  const updateRow = async (id: string, patch: Partial<BusinessAccountRow>) => {
    const { error } = await supabase.from("business_accounts").update(patch).eq("id", id);
    if (error) { toast.error("Update failed"); return; }
    toast.success("Business account updated");
    fetchRows();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Manage Businesses</h2>
          <p className="text-muted-foreground">
            Verify documents and create business accounts for ViaSetu for Businesses
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" />Create Business User</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Business User</DialogTitle>
              <DialogDescription>
                The business receives an email to set their password and can then sign in at
                /viasetuforbusinesses.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Company Name *</Label>
                <Input value={form.company_name} onChange={(e) => setField("company_name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Contact Person *</Label>
                <Input value={form.contact_person} onChange={(e) => setField("contact_person", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Work Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Phone (10 digits) *</Label>
                <Input value={form.phone} maxLength={10} onChange={(e) => setField("phone", e.target.value.replace(/\D/g, ""))} required />
              </div>
              <div className="space-y-2">
                <Label>Company PAN *</Label>
                <Input value={form.pan_number} onChange={(e) => setField("pan_number", e.target.value.toUpperCase())} required />
              </div>
              <div className="space-y-2">
                <Label>GST Number</Label>
                <Input value={form.gst_number} onChange={(e) => setField("gst_number", e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-2">
                <Label>Shop Act Number</Label>
                <Input value={form.shop_act_number} onChange={(e) => setField("shop_act_number", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Monthly Shipments *</Label>
                <Input type="number" min={0} value={form.monthly_shipments}
                  onChange={(e) => setField("monthly_shipments", e.target.value)} required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setField("address", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setField("city", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setField("state", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Pincode</Label>
                <Input value={form.pincode} maxLength={6}
                  onChange={(e) => setField("pincode", e.target.value.replace(/\D/g, ""))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>KYC Documents (PAN, GST, Shop Act)</Label>
                <Input type="file" multiple accept=".pdf,image/*"
                  onChange={(e) => setDocFiles(Array.from(e.target.files ?? []))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Internal Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} rows={2} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Business User"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Business Accounts</CardTitle>
          <CardDescription>All business rates are shown inclusive of GST.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No business accounts yet</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>PAN / GST</TableHead>
                    <TableHead className="text-center">Monthly Vol.</TableHead>
                    <TableHead>Docs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <p className="font-medium">{row.company_name}</p>
                        <p className="text-xs text-muted-foreground">{row.city || "—"}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{row.contact_person}</p>
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                        <p className="text-xs text-muted-foreground">{row.phone}</p>
                      </TableCell>
                      <TableCell className="text-xs">
                        <p>{row.pan_number || "—"}</p>
                        <p className="text-muted-foreground">{row.gst_number || "No GST"}</p>
                      </TableCell>
                      <TableCell className="text-center">{row.monthly_shipments}</TableCell>
                      <TableCell>
                        {(row.documents ?? []).length === 0 ? (
                          <span className="text-xs text-muted-foreground">None</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {(row.documents ?? []).map((doc, i) => (
                              <a key={i} href={doc.url} target="_blank" rel="noreferrer"
                                className="text-xs text-primary underline inline-flex items-center gap-1">
                                <FileText className="h-3 w-3" />{doc.name || `Doc ${i + 1}`}
                              </a>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.status === "approved" && row.is_active ? "default" : "secondary"}>
                          {row.is_active ? row.status : "disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {row.status !== "approved" && (
                            <Button size="sm" variant="ghost"
                              onClick={() => updateRow(row.id, { status: "approved", is_active: true })}>
                              Approve
                            </Button>
                          )}
                          {row.status !== "info_requested" && (
                            <Button size="sm" variant="ghost"
                              onClick={() => updateRow(row.id, { status: "info_requested" })}>
                              Request Info
                            </Button>
                          )}
                          <Button size="sm" variant="ghost"
                            onClick={() => updateRow(row.id, { is_active: !row.is_active })}>
                            {row.is_active ? "Disable" : "Enable"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessManagement;
