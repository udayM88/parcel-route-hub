import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Shield, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";

const edgeFunctionError = async (error: unknown, fallback: string) => {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.clone().json();
      if (body?.error) return String(body.error);
    } catch {
      try {
        const text = await context.clone().text();
        if (text) return text;
      } catch { /* fall through */ }
    }
  }
  return (error as Error)?.message || fallback;
};

const emailSchema = z.string().email("Invalid email address");

type AdminRole = "super_admin" | "cms_editor" | "operations" | "support";

type AdminUser = {
  id: string;
  email: string;
  role: AdminRole;
  created_at: string;
  is_active: boolean;
};

const roleLabels: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  cms_editor: "CMS Editor",
  operations: "Operations",
  support: "Support (legacy)",
};

const roleDescriptions: Record<AdminRole, string> = {
  super_admin: "Full access to all sections.",
  cms_editor: "Can manage Content (CMS) only. Logs in via /cms/login.",
  operations: "Can manage Orders, Tracking, Users, Support, Reconciliation. Logs in via /ops/login.",
  support: "Legacy role — same access as Operations.",
};

const AdminUserManagement = () => {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<AdminRole>("operations");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [setupLink, setSetupLink] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminUsers();
    fetchCurrentUserRole();
  }, []);

  useRealtimeTable("admin_users", () => fetchAdminUsers(), { channelName: "admin-users-mgmt" });

  const fetchCurrentUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase
        .from("admin_users")
        .select("role")
        .eq("user_id", session.user.id)
        .single();
      if (data) setCurrentUserRole(data.role);
    }
  };

  const fetchAdminUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAdminUsers((data ?? []) as AdminUser[]);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      toast.error("Failed to load admin users");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailValidation = emailSchema.safeParse(newUserEmail);
    if (!emailValidation.success) {
      toast.error(emailValidation.error.errors[0].message);
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to create admin users");
        return;
      }
      const response = await supabase.functions.invoke("create-admin-user", {
        body: { email: newUserEmail.trim(), role: newUserRole },
      });
      if (response.error) throw response.error;
      if (response.data?.error) { toast.error(response.data.error); return; }

      toast.success(`User created. A password reset email has been sent to ${newUserEmail}`);
      setIsAddDialogOpen(false);
      setNewUserEmail("");
      setNewUserRole("operations");
      fetchAdminUsers();
    } catch (error: any) {
      console.error("Error creating admin user:", error);
      toast.error(error.message || "Failed to create admin user");
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("admin_users")
        .update({ is_active: !currentStatus })
        .eq("id", userId);
      if (error) throw error;
      toast.success(`User ${!currentStatus ? "activated" : "deactivated"} successfully`);
      fetchAdminUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user status");
    }
  };

  const handleResetPassword = async (user: AdminUser) => {
    setResettingId(user.id);
    try {
      const response = await supabase.functions.invoke("reset-admin-password", {
        body: { admin_user_id: user.id },
      });
      if (response.error) {
        toast.error(await edgeFunctionError(response.error, "Failed to send password reset"));
        return;
      }
      if (response.data?.error) { toast.error(response.data.error); return; }

      if (response.data?.email_sent) {
        toast.success(`Password reset email sent to ${user.email}`);
      } else if (response.data?.setup_link) {
        setSetupLink(response.data.setup_link);
        toast.warning("Email could not be delivered. Share the reset link manually.");
      } else {
        toast.error(response.data?.email_error || "Could not generate a reset link");
      }
    } catch (error: any) {
      console.error("Error resetting admin password:", error);
      toast.error(error.message || "Failed to reset password");
    } finally {
      setResettingId(null);
    }
  };

  const isSuperAdmin = currentUserRole === "super_admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admin User Management</h2>
          <p className="text-muted-foreground">Create role-based sub-users for CMS and Operations</p>
        </div>
        {isSuperAdmin && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Sub-User</DialogTitle>
                <DialogDescription>
                  Create a role-based user. Any email domain is allowed for sub-users.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={newUserRole} onValueChange={(v: AdminRole) => setNewUserRole(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cms_editor">CMS Editor</SelectItem>
                      <SelectItem value="operations">Operations</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{roleDescriptions[newUserRole]}</p>
                </div>
                <Button type="submit" className="w-full">Create User</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Users
          </CardTitle>
          <CardDescription>
            {isSuperAdmin
              ? "Manage all admin, CMS, and operations users"
              : "View users (Super admin privileges required to manage users)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : adminUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No users found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  {isSuperAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "super_admin" ? "default" : "secondary"}>
                        {roleLabels[user.role] ?? user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "destructive"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    {isSuperAdmin && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(user.id, user.is_active)}
                        >
                          {user.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUserManagement;
