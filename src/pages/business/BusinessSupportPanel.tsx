import { FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, LifeBuoy, Loader2, MessageSquare, Plus, RefreshCw, Send } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isBusinessDemoSession } from "@/lib/business-demo";
import { supabase } from "@/integrations/supabase/client";

type SupportTicket = {
  id: string;
  user_id: string;
  booking_id: string | null;
  subject: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type TicketMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  created_at: string;
};

const DEMO_TICKETS: SupportTicket[] = [
  {
    id: "VS-DEMO-1042",
    user_id: "demo-merchant",
    booking_id: null,
    subject: "Need help with a delayed sample shipment",
    description: "This is a session-only sample ticket. No support request was submitted.",
    category: "shipment",
    priority: "medium",
    status: "in_progress",
    created_at: "2026-10-19T10:20:00.000Z",
    updated_at: "2026-10-20T05:45:00.000Z",
  },
];

const formatDate = (value: string) => new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date(value));

const statusLabel = (status: string) => status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function BusinessSupportPanel() {
  const isDemo = isBusinessDemoSession();
  const [tickets, setTickets] = useState<SupportTicket[]>(isDemo ? DEMO_TICKETS : []);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(!isDemo);
  const [saving, setSaving] = useState(false);
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("shipment");
  const [priority, setPriority] = useState("medium");
  const [reply, setReply] = useState("");

  const loadTickets = useCallback(async () => {
    if (isDemo) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Your session has expired. Please sign in again.");

      const { data, error: queryError } = await supabase
        .from("support_tickets")
        .select("id,user_id,booking_id,subject,description,category,priority,status,created_at,updated_at")
        .eq("user_id", authData.user.id)
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setTickets((data as SupportTicket[]) || []);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Support tickets could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const loadMessages = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setError("");
    if (isDemo) {
      setMessages([
        {
          id: "demo-message-1",
          ticket_id: ticket.id,
          sender_id: "demo-merchant",
          sender_type: "user",
          message: ticket.description || "Sample support request",
          created_at: ticket.created_at,
        },
        {
          id: "demo-message-2",
          ticket_id: ticket.id,
          sender_id: "demo-support",
          sender_type: "admin",
          message: "Our operations team is reviewing this sample shipment.",
          created_at: ticket.updated_at,
        },
      ]);
      return;
    }

    const { data, error: queryError } = await supabase
      .from("ticket_messages")
      .select("id,ticket_id,sender_id,sender_type,message,created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    if (queryError) {
      setError(queryError.message);
      setMessages([]);
      return;
    }
    setMessages((data as TicketMessage[]) || []);
  };

  const createTicket = async (event: FormEvent) => {
    event.preventDefault();
    if (subject.trim().length < 5 || description.trim().length < 10) {
      setError("Add a clear subject and at least 10 characters of detail.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (isDemo) {
        const now = new Date().toISOString();
        const ticket: SupportTicket = {
          id: `VS-DEMO-${String(tickets.length + 1043)}`,
          user_id: "demo-merchant",
          booking_id: null,
          subject: subject.trim(),
          description: description.trim(),
          category,
          priority,
          status: "open",
          created_at: now,
          updated_at: now,
        };
        setTickets((current) => [ticket, ...current]);
        setSubject("");
        setDescription("");
        setSelectedTicket(ticket);
        setMessages([]);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Your session has expired. Please sign in again.");

      const { data, error: insertError } = await supabase
        .from("support_tickets")
        .insert({
          user_id: authData.user.id,
          subject: subject.trim(),
          description: description.trim(),
          category,
          priority,
        })
        .select("id,user_id,booking_id,subject,description,category,priority,status,created_at,updated_at")
        .single();
      if (insertError) throw insertError;
      const ticket = data as SupportTicket;
      setTickets((current) => [ticket, ...current]);
      setSubject("");
      setDescription("");
      await loadMessages(ticket);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Ticket could not be created.");
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTicket || reply.trim().length < 2) return;
    setReplying(true);
    setError("");
    try {
      if (isDemo) {
        setMessages((current) => [...current, {
          id: `demo-reply-${current.length + 1}`,
          ticket_id: selectedTicket.id,
          sender_id: "demo-merchant",
          sender_type: "user",
          message: reply.trim(),
          created_at: new Date().toISOString(),
        }]);
        setReply("");
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Your session has expired. Please sign in again.");
      const { data, error: insertError } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: authData.user.id,
          sender_type: "user",
          message: reply.trim(),
        })
        .select("id,ticket_id,sender_id,sender_type,message,created_at")
        .single();
      if (insertError) throw insertError;
      setMessages((current) => [...current, data as TicketMessage]);
      setReply("");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Reply could not be sent.");
    } finally {
      setReplying(false);
    }
  };

  const openCount = tickets.filter((ticket) => ticket.status === "open").length;
  const resolvedCount = tickets.filter((ticket) => ticket.status === "resolved").length;

  return (
    <div className="space-y-4">
      {isDemo ? (
        <Alert className="border-amber-200 bg-amber-50/80 text-amber-950">
          <LifeBuoy />
          <AlertTitle>Safe demo support workspace</AlertTitle>
          <AlertDescription>Tickets and replies created here stay in this browser session. No support request or database record is created.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive"><LifeBuoy /><AlertTitle>Support action could not be completed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Total tickets", tickets.length, MessageSquare, "bg-blue-50 text-blue-700"],
          ["Open", openCount, Clock3, "bg-amber-50 text-amber-700"],
          ["Resolved", resolvedCount, CheckCircle2, "bg-emerald-50 text-emerald-700"],
        ].map(([label, value, StatIcon, tone]) => {
          const Icon = StatIcon as typeof MessageSquare;
          return <Card key={String(label)} className="merchant-bordered-card"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm font-semibold text-muted-foreground">{String(label)}</p><p className="mt-1 text-2xl font-extrabold">{loading ? "—" : String(value)}</p></div><span className={`grid size-11 place-items-center rounded-xl ${String(tone)}`}><Icon className="size-5" /></span></CardContent></Card>;
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <Card className="merchant-bordered-card">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle>Your support tickets</CardTitle><CardDescription>Only requests owned by the signed-in account are loaded.</CardDescription></div>
            <Button variant="outline" size="icon" onClick={() => void loadTickets()} disabled={loading} aria-label="Refresh support tickets"><RefreshCw className={loading ? "animate-spin" : ""} /></Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {!loading && tickets.length === 0 ? <div className="grid min-h-56 place-items-center rounded-xl border border-dashed bg-muted/20 p-6 text-center"><div><LifeBuoy className="mx-auto mb-3 size-9 text-primary/60" /><p className="font-bold">No support tickets yet</p><p className="mt-1 text-sm text-muted-foreground">Create a request and the ViaSetu team can follow it here.</p></div></div> : null}
            {tickets.map((ticket) => (
              <button key={ticket.id} type="button" onClick={() => void loadMessages(ticket)} className={`w-full rounded-xl border p-4 text-left transition hover:border-primary/45 hover:bg-accent/35 ${selectedTicket?.id === ticket.id ? "border-primary bg-accent/45" : "bg-card"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{ticket.subject}</p><p className="mt-1 text-xs text-muted-foreground">{ticket.id} · {formatDate(ticket.created_at)}</p></div><Badge variant={ticket.status === "resolved" ? "default" : "secondary"}>{statusLabel(ticket.status)}</Badge></div>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{ticket.description || "No description provided."}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="merchant-surface merchant-bordered-card">
          <form onSubmit={createTicket}>
            <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="size-5 text-primary" />Create a ticket</CardTitle><CardDescription>Share the order or account issue with the support team.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label htmlFor="support-subject">Subject</Label><Input id="support-subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={120} placeholder="Example: Pickup was not attempted" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="shipment">Shipment</SelectItem><SelectItem value="billing">Billing</SelectItem><SelectItem value="account">Account</SelectItem><SelectItem value="integration">Integration</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Priority</Label><Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select></div>
              </div>
              <div className="space-y-2"><Label htmlFor="support-description">Details</Label><Textarea id="support-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={6} placeholder="Include the shipment ID and what you need help with." /></div>
            </CardContent>
            <CardFooter className="justify-end border-t pt-4"><Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus />}Create ticket</Button></CardFooter>
          </form>
        </Card>
      </div>

      {selectedTicket ? (
        <Card className="merchant-bordered-card">
          <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{selectedTicket.subject}</CardTitle><CardDescription>{selectedTicket.id} · {statusLabel(selectedTicket.status)}</CardDescription></div><Badge variant="outline">{statusLabel(selectedTicket.priority)} priority</Badge></div></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border bg-muted/25 p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Original request</p><p className="mt-2 text-sm leading-6">{selectedTicket.description}</p></div>
            {messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-xl border p-3 ${message.sender_type === "admin" ? "bg-accent/50" : "ml-auto bg-primary text-primary-foreground"}`}><p className="text-xs font-bold opacity-75">{message.sender_type === "admin" ? "ViaSetu support" : "You"}</p><p className="mt-1 text-sm">{message.message}</p><p className="mt-2 text-[11px] opacity-65">{formatDate(message.created_at)}</p></div>)}
          </CardContent>
          <CardFooter className="border-t pt-4"><form onSubmit={sendReply} className="flex w-full flex-col gap-2 sm:flex-row"><Input value={reply} onChange={(event) => setReply(event.target.value)} maxLength={2000} placeholder="Write a reply" aria-label="Support reply" /><Button type="submit" disabled={replying || reply.trim().length < 2}>{replying ? <Loader2 className="animate-spin" /> : <Send />}Send reply</Button></form></CardFooter>
        </Card>
      ) : null}
    </div>
  );
}
