import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MessageSquare, Clock, AlertCircle, CheckCircle, User, Search, RefreshCw, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { format } from "date-fns";

interface Ticket {
  id: string;
  user_id: string;
  booking_id: string | null;
  subject: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  created_at: string;
}

const SupportManagement = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchTickets(); }, []);

  useRealtimeTable("support_tickets", () => fetchTickets(), { channelName: "admin-support-tickets" });
  useRealtimeTable(
    "ticket_messages",
    () => {
      if (selectedTicket) fetchMessages(selectedTicket.id);
      fetchTickets();
    },
    { channelName: "admin-ticket-messages" }
  );

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTickets(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (ticketId: string) => {
    const { data, error } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (!error) setMessages(data || []);
  };

  const openTicketDetails = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setDetailsOpen(true);
    fetchMessages(ticket.id);
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase.from("ticket_messages").insert({
        ticket_id: selectedTicket.id,
        sender_id: session.user.id,
        sender_type: "admin",
        message: replyText.trim(),
      });
      if (error) throw error;

      // Update ticket status to in_progress if it was open
      if (selectedTicket.status === "open") {
        await supabase.from("support_tickets")
          .update({ status: "in_progress", assigned_to: session.user.id })
          .eq("id", selectedTicket.id);
      }

      setReplyText("");
      fetchMessages(selectedTicket.id);
      fetchTickets();
      toast({ title: "Reply sent" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    try {
      const update: {status:string;resolved_at?:string} = { status: newStatus };
      if (newStatus === "resolved") update.resolved_at = new Date().toISOString();
      
      const { error } = await supabase.from("support_tickets").update(update).eq("id", ticketId);
      if (error) throw error;
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      }
      toast({ title: `Ticket ${newStatus}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase());
    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && t.status === statusFilter;
  });

  const openCount = tickets.filter(t => t.status === "open").length;
  const inProgressCount = tickets.filter(t => t.status === "in_progress").length;
  const resolvedCount = tickets.filter(t => t.status === "resolved").length;

  const getPriorityColor = (p: string) => {
    switch (p) { case "high": return "destructive"; case "medium": return "secondary"; default: return "outline"; }
  };
  const getStatusColor = (s: string) => {
    switch (s) { case "open": return "destructive"; case "in_progress": return "secondary"; case "resolved": return "default"; default: return "outline"; }
  };

  const supportStats = [
    { title: "Open Tickets", value: openCount.toString(), icon: MessageSquare, color: "text-blue-600" },
    { title: "In Progress", value: inProgressCount.toString(), icon: Clock, color: "text-orange-600" },
    { title: "Resolved", value: resolvedCount.toString(), icon: CheckCircle, color: "text-green-600" },
    { title: "Total", value: tickets.length.toString(), icon: AlertCircle, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Support Management</h2>
          <p className="text-muted-foreground">Manage customer support tickets</p>
        </div>
        <Button variant="outline" onClick={fetchTickets} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {supportStats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{loading ? "..." : stat.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tickets..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tickets</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Support Tickets</CardTitle>
          <CardDescription>All customer support requests</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading tickets...</div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No tickets found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium text-xs">{ticket.id.slice(0, 8)}...</TableCell>
                    <TableCell>{ticket.subject}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{ticket.category}</Badge></TableCell>
                    <TableCell><Badge variant={getPriorityColor(ticket.priority)} className="capitalize">{ticket.priority}</Badge></TableCell>
                    <TableCell><Badge variant={getStatusColor(ticket.status)} className="capitalize">{ticket.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-sm">{format(new Date(ticket.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell className="space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openTicketDetails(ticket)}>View</Button>
                      {ticket.status !== "resolved" && (
                        <Button size="sm" onClick={() => handleUpdateStatus(ticket.id, "resolved")}>Resolve</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ticket Detail Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ticket: {selectedTicket?.subject}</DialogTitle>
            <DialogDescription>
              {selectedTicket && (
                <div className="flex gap-2 mt-2">
                  <Badge variant={getStatusColor(selectedTicket.status)} className="capitalize">{selectedTicket.status.replace("_", " ")}</Badge>
                  <Badge variant={getPriorityColor(selectedTicket.priority)} className="capitalize">{selectedTicket.priority}</Badge>
                  <Badge variant="outline" className="capitalize">{selectedTicket.category}</Badge>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4">
              {selectedTicket.description && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Description</p>
                  <p className="text-sm text-muted-foreground">{selectedTicket.description}</p>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-sm font-medium">Messages</p>
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet</p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`p-3 rounded-lg ${msg.sender_type === "admin" ? "bg-primary/10 ml-8" : "bg-muted mr-8"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={msg.sender_type === "admin" ? "default" : "secondary"} className="text-xs">
                          {msg.sender_type === "admin" ? "Admin" : "Customer"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{format(new Date(msg.created_at), "dd MMM, HH:mm")}</span>
                      </div>
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  ))
                )}
              </div>

              {selectedTicket.status !== "resolved" && (
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={2}
                    className="flex-1"
                  />
                  <Button onClick={handleReply} disabled={sending || !replyText.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                {selectedTicket.status === "open" && (
                  <Button variant="outline" onClick={() => handleUpdateStatus(selectedTicket.id, "in_progress")}>Mark In Progress</Button>
                )}
                {selectedTicket.status !== "resolved" && (
                  <Button onClick={() => handleUpdateStatus(selectedTicket.id, "resolved")}>Resolve Ticket</Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupportManagement;
