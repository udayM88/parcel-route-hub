import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Loader2, Mail, MoreHorizontal, Plus, RefreshCw, Search, ShieldCheck, UserRound, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBusinessAuth } from "@/contexts/useBusinessAuth";
import { supabase } from "@/integrations/supabase/client";
import { isBusinessDemoSession } from "@/lib/business-demo";
import { MERCHANT_ROLE_DETAILS, type MerchantRole } from "@/lib/merchant-permissions";

type TeamRole = Exclude<MerchantRole, "owner">;
type TeamMember = {
  id: string; user_id: string | null; name: string; email: string; phone: string | null;
  role: MerchantRole; permissions: string[]; status: "invited" | "active" | "suspended";
  invited_at?: string; joined_at?: string | null; created_at?: string; is_owner?: boolean;
};

const roleEntries = Object.entries(MERCHANT_ROLE_DETAILS) as Array<[TeamRole, typeof MERCHANT_ROLE_DETAILS[TeamRole]]>;
const demoOwner: TeamMember = { id: "demo-owner", user_id: "demo-owner", name: "Demo Admin", email: "demo@viasetu.local", phone: "9000000000", role: "owner", permissions: ["*"], status: "active", is_owner: true };
const demoMembers: TeamMember[] = [
  { id: "demo-ops", user_id: "demo-ops", name: "Aarav Sharma", email: "operations@example.com", phone: "9876543210", role: "operations", permissions: [], status: "active", joined_at: "2026-10-22T08:00:00.000Z" },
  { id: "demo-dev", user_id: "demo-dev", name: "Meera Shah", email: "developer@example.com", phone: null, role: "developer", permissions: [], status: "invited", invited_at: "2026-10-27T08:00:00.000Z" },
];
const emptyInvite: { name: string; email: string; phone: string; role: TeamRole } = { name: "", email: "", phone: "", role: "viewer" };
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value)) : "—";
const roleLabel = (role: MerchantRole) => role === "owner" ? "Owner" : MERCHANT_ROLE_DETAILS[role].label;

export default function BusinessUsersPanel() {
  const { business, access, can } = useBusinessAuth();
  const demo = isBusinessDemoSession();
  const [members, setMembers] = useState<TeamMember[]>(demo ? [demoOwner, ...demoMembers] : []);
  const [loading, setLoading] = useState(!demo);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState(emptyInvite);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const mayManage = can("team:manage");

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error: invokeError } = await supabase.functions.invoke("merchant-team", { body });
    if (invokeError) throw new Error(data?.error || invokeError.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const load = useCallback(async () => {
    if (demo) { setLoading(false); return; }
    if (!mayManage) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const data = await invoke({ action: "list" });
      setMembers([data.owner as TeamMember, ...((data.members || []) as TeamMember[])]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Team members could not be loaded.");
    } finally { setLoading(false); }
  }, [demo, invoke, mayManage]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => members.filter((member) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${member.name} ${member.email} ${member.phone || ""}`.toLowerCase().includes(query);
    return matchesSearch && (roleFilter === "all" || member.role === roleFilter) && (statusFilter === "all" || member.status === statusFilter);
  }), [members, roleFilter, search, statusFilter]);

  const submitInvite = async (event: FormEvent) => {
    event.preventDefault();
    if (invite.name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email.trim())) { setError("Enter the team member's name and a valid work email."); return; }
    if (invite.phone && !/^\d{10}$/.test(invite.phone)) { setError("Phone number must contain 10 digits."); return; }
    setBusy("invite"); setError("");
    try {
      if (demo) {
        setMembers((current) => [...current, { id: crypto.randomUUID(), user_id: null, ...invite, permissions: [], status: "invited", invited_at: new Date().toISOString() }]);
      } else {
        const data = await invoke({ action: "invite", ...invite });
        setMembers((current) => [...current, data.member as TeamMember]);
      }
      toast.success(`Invitation prepared for ${invite.email}`, { position: "top-center" });
      setInvite(emptyInvite); setInviteOpen(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Invitation could not be sent."); }
    finally { setBusy(null); }
  };

  const updateMember = async (member: TeamMember, action: "update_role" | "update_status" | "resend", value?: string) => {
    setBusy(member.id); setError("");
    try {
      if (demo) {
        if (action !== "resend") setMembers((current) => current.map((item) => item.id === member.id ? { ...item, ...(action === "update_role" ? { role: value as TeamRole } : { status: value as TeamMember["status"] }) } : item));
      } else {
        const data = await invoke({ action, member_id: member.id, ...(action === "update_role" ? { role: value } : action === "update_status" ? { status: value } : {}) });
        if (data.member) setMembers((current) => current.map((item) => item.id === member.id ? data.member as TeamMember : item));
      }
      toast.success(action === "resend" ? "Access email sent" : "Team access updated", { position: "top-center" });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Team access could not be updated."); }
    finally { setBusy(null); }
  };

  const removeMember = async () => {
    if (!removeTarget) return;
    setBusy(removeTarget.id); setError("");
    try {
      if (!demo) await invoke({ action: "remove", member_id: removeTarget.id });
      setMembers((current) => current.filter((member) => member.id !== removeTarget.id));
      toast.success("Team member removed from this workspace", { position: "top-center" }); setRemoveTarget(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Team member could not be removed."); }
    finally { setBusy(null); }
  };

  if (!mayManage) return <Alert className="border-amber-200 bg-amber-50/80"><ShieldCheck /><AlertTitle>Administrator access required</AlertTitle><AlertDescription>Your {access?.role || "current"} role does not include team management. Ask the merchant owner or an administrator to change users and roles.</AlertDescription></Alert>;

  return <div className="space-y-4" data-testid="merchant-users-panel">
    {demo ? <Alert className="border-cyan-200 bg-cyan-50/80"><Users /><AlertTitle>Safe sample team</AlertTitle><AlertDescription>Add, edit and remove sample members here. Changes stay in this browser session and never reach Supabase.</AlertDescription></Alert> : null}
    {error ? <Alert variant="destructive"><UserX /><AlertTitle>Team action could not be completed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
    <Card className="merchant-bordered-card overflow-hidden">
      <CardHeader className="gap-4 border-b bg-muted/15 lg:flex-row lg:items-center lg:justify-between">
        <div><CardTitle className="flex items-center gap-2"><Users className="size-5 text-primary" />Users & roles</CardTitle><CardDescription>Invite people to {business?.company_name || "this merchant"} and grant only the access they need.</CardDescription></div>
        <Dialog open={inviteOpen} onOpenChange={(open) => { setInviteOpen(open); if (!open) setInvite(emptyInvite); }}>
          <DialogTrigger asChild><Button data-testid="add-merchant-user"><Plus />Add new user</Button></DialogTrigger>
          <DialogContent className="sm:max-w-xl"><form onSubmit={submitInvite}>
            <DialogHeader><DialogTitle>Invite a merchant team member</DialogTitle><DialogDescription>They will receive a secure email to set a password and enter this merchant workspace.</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="team-name">Full name</Label><Input id="team-name" autoFocus value={invite.name} onChange={(event) => setInvite((current) => ({ ...current, name: event.target.value }))} placeholder="Team member name" /></div>
              <div className="space-y-2"><Label htmlFor="team-email">Work email</Label><Input id="team-email" type="email" value={invite.email} onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))} placeholder="name@company.com" /></div>
              <div className="space-y-2"><Label htmlFor="team-phone">Phone (optional)</Label><Input id="team-phone" inputMode="numeric" value={invite.phone} onChange={(event) => setInvite((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "").slice(0, 10) }))} placeholder="10-digit number" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Role</Label><Select value={invite.role} onValueChange={(role: TeamRole) => setInvite((current) => ({ ...current, role }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roleEntries.map(([role, details]) => <SelectItem key={role} value={role}>{details.label}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">{MERCHANT_ROLE_DETAILS[invite.role].description}</p></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button><Button type="submit" disabled={busy === "invite"}>{busy === "invite" ? <Loader2 className="animate-spin" /> : <Mail />}Send invitation</Button></DialogFooter>
          </form></DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid gap-3 border-b p-4 md:grid-cols-[minmax(220px,1fr)_190px_170px_auto]">
          <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or phone" /></div>
          <Select value={roleFilter} onValueChange={setRoleFilter}><SelectTrigger><SelectValue placeholder="All roles" /></SelectTrigger><SelectContent><SelectItem value="all">All roles</SelectItem><SelectItem value="owner">Owner</SelectItem>{roleEntries.map(([role, details]) => <SelectItem key={role} value={role}>{details.label}</SelectItem>)}</SelectContent></Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="invited">Invited</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select>
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh team"><RefreshCw className={loading ? "animate-spin" : ""} /></Button>
        </div>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Joined / invited</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
          {filtered.map((member) => <TableRow key={member.id} data-testid={`merchant-user-${member.role}`}>
            <TableCell><div className="flex min-w-64 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full border bg-accent text-primary"><UserRound className="size-5" /></span><div className="min-w-0"><p className="font-bold">{member.name}</p><p className="truncate text-xs text-muted-foreground">{member.email}{member.phone ? ` · +91 ${member.phone}` : ""}</p></div>{member.is_owner ? <Badge variant="outline">Account owner</Badge> : null}</div></TableCell>
            <TableCell>{member.is_owner ? <Badge>Owner</Badge> : <Select value={member.role} disabled={busy === member.id} onValueChange={(role) => void updateMember(member, "update_role", role)}><SelectTrigger className="w-44"><SelectValue>{roleLabel(member.role)}</SelectValue></SelectTrigger><SelectContent>{roleEntries.map(([role, details]) => <SelectItem key={role} value={role}>{details.label}</SelectItem>)}</SelectContent></Select>}</TableCell>
            <TableCell><Badge variant={member.status === "active" ? "default" : member.status === "suspended" ? "destructive" : "secondary"} className="gap-1">{member.status === "active" ? <CheckCircle2 className="size-3" /> : <Clock3 className="size-3" />}{member.status}</Badge></TableCell>
            <TableCell className="text-sm text-muted-foreground">{formatDate(member.joined_at || member.invited_at || member.created_at)}</TableCell>
            <TableCell className="text-right">{member.is_owner ? <span className="text-xs text-muted-foreground">Protected</span> : <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={busy === member.id} aria-label={`Actions for ${member.name}`}>{busy === member.id ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => void updateMember(member, "resend")}><Mail />Send access email</DropdownMenuItem><DropdownMenuItem onClick={() => void updateMember(member, "update_status", member.status === "suspended" ? "active" : "suspended")}>{member.status === "suspended" ? <CheckCircle2 /> : <UserX />}{member.status === "suspended" ? "Reactivate" : "Suspend access"}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setRemoveTarget(member)}><UserX />Remove from team</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</TableCell>
          </TableRow>)}
          {!loading && !filtered.length ? <TableRow><TableCell colSpan={5}><div className="grid min-h-56 place-items-center text-center"><div><Users className="mx-auto mb-3 size-9 text-primary/50" /><p className="font-bold">No matching users</p><p className="mt-1 text-sm text-muted-foreground">Change the filters or invite a new team member.</p></div></div></TableCell></TableRow> : null}
        </TableBody></Table></div>
      </CardContent>
    </Card>
    <div className="grid gap-3 md:grid-cols-3">{roleEntries.slice(0, 3).map(([role, details]) => <Card key={role} className="merchant-bordered-card"><CardHeader className="pb-3"><CardTitle className="text-base">{details.label}</CardTitle><CardDescription>{details.description}</CardDescription></CardHeader><CardContent><p className="text-xs font-semibold text-muted-foreground">{details.permissions.length} assigned permissions</p></CardContent></Card>)}</div>
    <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove {removeTarget?.name}?</AlertDialogTitle><AlertDialogDescription>Their ViaSetu merchant access will stop immediately. Shipment and activity records will remain intact for audit history.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep user</AlertDialogCancel><AlertDialogAction onClick={() => void removeMember()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove access</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
