import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOwnerAuth } from "@/components/owner-auth-provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Pencil, Trash2, Plus, Save, X, ChevronLeft, ChevronRight, ArrowUp, ArrowDown,
} from "lucide-react";
import { TABLE_LABELS } from "@/pages/owner/db-stats";

const DB_TABLES = Object.keys(TABLE_LABELS);
const PAGE_SIZE = 20;

interface TableData {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  columns: string[];
  primaryKey: string[];
  hidden: string[];
  allowInsert: boolean;
  allowDelete: boolean;
}

type FieldType = "boolean" | "number" | "json" | "text";

function inferType(value: unknown): FieldType {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (value !== null && typeof value === "object") return "json";
  return "text";
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function convertValue(type: FieldType, raw: unknown): unknown {
  if (type === "boolean") return !!raw;
  if (type === "number") {
    if (raw === "" || raw === null || raw === undefined) return null;
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  if (type === "json") {
    if (typeof raw !== "string") return raw;
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    return JSON.parse(trimmed);
  }
  return raw === "" ? null : raw;
}

function pkMatch(row: Record<string, unknown>, primaryKey: string[]): Record<string, unknown> {
  const match: Record<string, unknown> = {};
  for (const pk of primaryKey) match[pk] = row[pk];
  return match;
}

function rowKey(row: Record<string, unknown>, primaryKey: string[]): string {
  return primaryKey.map((pk) => String(row[pk])).join("::");
}

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/40 italic">null</span>;
  }
  if (typeof value === "boolean") {
    return <span className={value ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>{String(value)}</span>;
  }
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  const truncated = str.length > 50 ? `${str.slice(0, 50)}…` : str;
  return <span title={str} className={typeof value === "object" ? "font-mono" : ""}>{truncated}</span>;
}

export function DbTableBrowser() {
  const { password } = useOwnerAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [table, setTable] = useState(DB_TABLES[0]);
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});
  const [editTypes, setEditTypes] = useState<Record<string, FieldType>>({});
  const [adding, setAdding] = useState(false);
  const [newValues, setNewValues] = useState<Record<string, unknown>>({});
  const [deleteRow, setDeleteRow] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    setPage(1);
    setSortCol(null);
    setSortAsc(false);
    setEditingKey(null);
    setAdding(false);
  }, [table]);

  const { data, isLoading, error } = useQuery<TableData>({
    queryKey: ["owner-db-table", table, page, sortCol, sortAsc],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (sortCol) { params.set("sort", sortCol); params.set("order", sortAsc ? "asc" : "desc"); }
      const res = await fetch(`/api/owner/db/${table}?${params}`, {
        headers: { "x-owner-password": password ?? "" },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to load table");
      return res.json();
    },
    enabled: !!password,
    refetchOnWindowFocus: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["owner-db-table", table] });

  const updateMutation = useMutation({
    mutationFn: async ({ match, fields }: { match: Record<string, unknown>; fields: Record<string, unknown> }) => {
      const res = await fetch(`/api/owner/db/${table}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-owner-password": password ?? "" },
        body: JSON.stringify({ match, fields }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Update failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Row updated" });
      setEditingKey(null);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const insertMutation = useMutation({
    mutationFn: async (fields: Record<string, unknown>) => {
      const res = await fetch(`/api/owner/db/${table}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-owner-password": password ?? "" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Insert failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Row added" });
      setAdding(false);
      setNewValues({});
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Insert failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (match: Record<string, unknown>) => {
      const res = await fetch(`/api/owner/db/${table}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-owner-password": password ?? "" },
        body: JSON.stringify({ match }),
      });
      if (!res.ok && res.status !== 204) throw new Error((await res.json().catch(() => ({})))?.error || "Delete failed");
    },
    onSuccess: () => {
      toast({ title: "Row deleted" });
      setDeleteRow(null);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const startEdit = (row: Record<string, unknown>) => {
    if (!data) return;
    const key = rowKey(row, data.primaryKey);
    const values: Record<string, unknown> = {};
    const types: Record<string, FieldType> = {};
    for (const col of data.columns) {
      values[col] = row[col];
      types[col] = inferType(row[col]);
    }
    setEditValues(values);
    setEditTypes(types);
    setEditingKey(key);
  };

  const saveEdit = (row: Record<string, unknown>) => {
    if (!data) return;
    const fields: Record<string, unknown> = {};
    try {
      for (const col of data.columns) {
        if (data.primaryKey.includes(col)) continue;
        fields[col] = convertValue(editTypes[col], editValues[col]);
      }
    } catch {
      toast({ title: "Invalid JSON", description: "Check your JSON fields and try again.", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ match: pkMatch(row, data.primaryKey), fields });
  };

  const startAdd = () => {
    if (!data) return;
    const sample = data.rows[0];
    const values: Record<string, unknown> = {};
    for (const col of data.columns) {
      values[col] = sample && inferType(sample[col]) === "boolean" ? false : "";
    }
    setNewValues(values);
    setAdding(true);
  };

  const saveAdd = () => {
    if (!data) return;
    const sample = data.rows[0];
    const fields: Record<string, unknown> = {};
    try {
      for (const col of data.columns) {
        const type: FieldType = sample ? inferType(sample[col]) : "text";
        const raw = newValues[col];
        if (raw === "" || raw === undefined) {
          if (data.primaryKey.includes(col) && col === "id") continue;
          if (type === "boolean") { fields[col] = false; continue; }
          continue;
        }
        fields[col] = convertValue(type, raw);
      }
    } catch {
      toast({ title: "Invalid JSON", description: "Check your JSON fields and try again.", variant: "destructive" });
      return;
    }
    insertMutation.mutate(fields);
  };

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortAsc((a) => !a);
    else { setSortCol(col); setSortAsc(true); }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Select value={table} onValueChange={setTable}>
            <SelectTrigger className="w-[220px] rounded-xl border-border bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DB_TABLES.map((t) => (
                <SelectItem key={t} value={t}>{TABLE_LABELS[t] ?? t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data && (
            <span className="text-xs text-muted-foreground font-medium">
              {data.total} row{data.total === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {data?.allowInsert && !adding && (
          <Button size="sm" onClick={startAdd} className="gap-1.5 rounded-xl bg-primary text-white hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Add Row
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {(error as Error).message}
        </div>
      ) : data ? (
        <>
          <div className="rounded-xl bg-white border border-border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {data.columns.map((col) => (
                    <TableHead key={col} className="whitespace-nowrap">
                      <button
                        onClick={() => toggleSort(col)}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {col}
                        {sortCol === col && (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </button>
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adding && (
                  <TableRow className="bg-primary/5">
                    {data.columns.map((col) => {
                      const isPk = data.primaryKey.includes(col);
                      const sample = data.rows[0];
                      const type: FieldType = sample ? inferType(sample[col]) : "text";
                      return (
                        <TableCell key={col}>
                          {isPk && col === "id" ? (
                            <span className="text-xs text-muted-foreground italic">auto</span>
                          ) : type === "boolean" ? (
                            <Checkbox
                              checked={!!newValues[col]}
                              onCheckedChange={(c) => setNewValues((v) => ({ ...v, [col]: !!c }))}
                            />
                          ) : type === "json" ? (
                            <Textarea
                              value={String(newValues[col] ?? "")}
                              onChange={(e) => setNewValues((v) => ({ ...v, [col]: e.target.value }))}
                              className="h-16 text-xs font-mono min-w-[140px]"
                              placeholder="JSON"
                            />
                          ) : (
                            <Input
                              type={type === "number" ? "number" : "text"}
                              value={String(newValues[col] ?? "")}
                              onChange={(e) => setNewValues((v) => ({ ...v, [col]: e.target.value }))}
                              className="h-8 text-xs min-w-[100px]"
                            />
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={saveAdd} disabled={insertMutation.isPending} className="h-8 w-8 text-emerald-600 hover:bg-emerald-50">
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setAdding(false)} className="h-8 w-8 text-muted-foreground hover:bg-muted">
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
                {data.rows.length === 0 && !adding ? (
                  <TableRow>
                    <TableCell colSpan={data.columns.length + 1} className="text-center text-muted-foreground py-8">
                      No rows.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.rows.map((row) => {
                    const key = rowKey(row, data.primaryKey);
                    const isEditing = editingKey === key;
                    return (
                      <TableRow key={key}>
                        {data.columns.map((col) => {
                          const isPk = data.primaryKey.includes(col);
                          if (isEditing && !isPk) {
                            const type = editTypes[col];
                            return (
                              <TableCell key={col}>
                                {type === "boolean" ? (
                                  <Checkbox
                                    checked={!!editValues[col]}
                                    onCheckedChange={(c) => setEditValues((v) => ({ ...v, [col]: !!c }))}
                                  />
                                ) : type === "json" ? (
                                  <Textarea
                                    value={displayValue(editValues[col])}
                                    onChange={(e) => setEditValues((v) => ({ ...v, [col]: e.target.value }))}
                                    className="h-16 text-xs font-mono min-w-[140px]"
                                  />
                                ) : (
                                  <Input
                                    type={type === "number" ? "number" : "text"}
                                    value={displayValue(editValues[col])}
                                    onChange={(e) => setEditValues((v) => ({ ...v, [col]: e.target.value }))}
                                    className="h-8 text-xs min-w-[100px]"
                                  />
                                )}
                              </TableCell>
                            );
                          }
                          return (
                            <TableCell key={col} className="text-xs max-w-[240px]">
                              <CellValue value={row[col]} />
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-right whitespace-nowrap">
                          {isEditing ? (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => saveEdit(row)} disabled={updateMutation.isPending} className="h-8 w-8 text-emerald-600 hover:bg-emerald-50">
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setEditingKey(null)} className="h-8 w-8 text-muted-foreground hover:bg-muted">
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => startEdit(row)} className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {data.allowDelete && (
                                <Button size="icon" variant="ghost" onClick={() => setDeleteRow(row)} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">
              Page {data.page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-xl gap-1">
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-xl gap-1">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      ) : null}

      <AlertDialog open={!!deleteRow} onOpenChange={(open) => !open && setDeleteRow(null)}>
        <AlertDialogContent className="bg-white border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this row?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the row from <strong>{TABLE_LABELS[table] ?? table}</strong>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRow && data && deleteMutation.mutate(pkMatch(deleteRow, data.primaryKey))}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
