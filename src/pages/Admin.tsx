import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Users,
  Palette,
  Image,
  UserCheck,
  DollarSign,
  Search,
  Pencil,
  Trash2,
  Plus,
  BarChart3,
  RefreshCw,
} from "lucide-react";

const TABLES = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "profiles", label: "Users", icon: Users },
  { key: "brands", label: "Brands", icon: Palette },
  { key: "designs", label: "Designs", icon: Image },
  { key: "affiliates", label: "Affiliates", icon: UserCheck },
  { key: "affiliate_commissions", label: "Commissions", icon: DollarSign },
  { key: "affiliate_payouts", label: "Payouts", icon: DollarSign },
  { key: "user_roles", label: "Roles", icon: Users },
];

async function adminAction(payload: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-action`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Admin action failed");
  }

  return res.json();
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminAction({ operation: "stats" }),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  const stats = data?.stats || {};

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Dashboard Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={stats.profiles || 0} icon={Users} />
        <StatCard title="Brands" value={stats.brands || 0} icon={Palette} />
        <StatCard title="Designs" value={stats.designs || 0} icon={Image} />
        <StatCard title="Affiliates" value={stats.affiliates || 0} icon={UserCheck} />
      </div>
    </div>
  );
}

function DataTable({ tableName }: { tableName: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const limit = 20;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-list", tableName, page, search],
    queryFn: () =>
      adminAction({
        operation: "list",
        table: tableName,
        offset: page * limit,
        limit,
        search,
      }),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown> }) =>
      adminAction({
        operation: "update",
        table: tableName,
        id: payload.id,
        data: payload.data,
      }),
    onSuccess: () => {
      toast.success("Record updated");
      queryClient.invalidateQueries({ queryKey: ["admin-list", tableName] });
      setSheetOpen(false);
      setEditItem(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      adminAction({ operation: "delete", table: tableName, id }),
    onSuccess: () => {
      toast.success("Record deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-list", tableName] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rows = data?.rows || [];
  const count = data?.count || 0;
  const totalPages = Math.ceil(count / limit);

  const getDisplayValue = (row: Record<string, unknown>) => {
    if (tableName === "profiles") return row.full_name || row.user_id;
    if (tableName === "brands") return row.name;
    if (tableName === "designs") return row.title || row.prompt?.toString().slice(0, 40);
    if (tableName === "affiliates") return row.affiliate_code;
    if (tableName === "affiliate_commissions") return `$${row.commission_amount}`;
    if (tableName === "affiliate_payouts") return `$${row.amount}`;
    if (tableName === "user_roles") return row.role;
    return row.id;
  };

  const getSubtitle = (row: Record<string, unknown>) => {
    if (tableName === "profiles") return row.subscription_tier;
    if (tableName === "brands") return row.tagline;
    if (tableName === "affiliates") return row.status;
    if (tableName === "affiliate_commissions") return row.status;
    if (tableName === "affiliate_payouts") return row.status;
    if (tableName === "user_roles") return row.user_id?.toString().slice(0, 8);
    return new Date(row.created_at as string).toLocaleDateString();
  };

  const handleEdit = (row: Record<string, unknown>) => {
    setEditItem({ ...row });
    setSheetOpen(true);
  };

  const handleSave = () => {
    if (!editItem) return;
    const { id, ...rest } = editItem;
    // Remove non-editable fields
    delete rest.created_at;
    delete rest.updated_at;
    updateMutation.mutate({ id: id as string, data: rest });
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9 rounded-xl"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} className="rounded-xl">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Cards list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No records found</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row: Record<string, unknown>) => (
            <Card key={row.id as string} className="rounded-2xl">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{String(getDisplayValue(row))}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {String(getSubtitle(row))}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(row)}
                    className="rounded-xl"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(row.id as string)}
                    className="rounded-xl text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-xl"
          >
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-xl"
          >
            Next
          </Button>
        </div>
      )}

      {/* Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Record</SheetTitle>
          </SheetHeader>
          {editItem && (
            <div className="space-y-4 mt-6">
              {Object.entries(editItem).map(([key, value]) => {
                if (key === "id" || key === "created_at" || key === "updated_at") {
                  return (
                    <div key={key}>
                      <label className="text-sm font-medium text-muted-foreground">{key}</label>
                      <p className="text-sm mt-1 truncate">{String(value)}</p>
                    </div>
                  );
                }

                return (
                  <div key={key}>
                    <label className="text-sm font-medium">{key}</label>
                    <Input
                      className="mt-1 rounded-xl"
                      value={
                        typeof value === "object" ? JSON.stringify(value) : String(value ?? "")
                      }
                      onChange={(e) =>
                        setEditItem((prev) => (prev ? { ...prev, [key]: e.target.value } : null))
                      }
                    />
                  </div>
                );
              })}
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="w-full rounded-xl"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deleteMutation.mutate(deleteId);
                setDeleteId(null);
              }}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Admin Panel</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <ScrollArea className="w-full">
            <TabsList className="inline-flex w-max gap-1 p-1 mb-6 rounded-2xl bg-muted">
              {TABLES.map((t) => (
                <TabsTrigger
                  key={t.key}
                  value={t.key}
                  className="rounded-xl px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <t.icon className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <TabsContent value="overview">
            <OverviewTab />
          </TabsContent>

          {TABLES.filter((t) => t.key !== "overview").map((t) => (
            <TabsContent key={t.key} value={t.key}>
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <t.icon className="h-5 w-5" />
                    {t.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable tableName={t.key} />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
