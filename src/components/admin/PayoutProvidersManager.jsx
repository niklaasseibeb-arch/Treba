import React, { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Power } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const TYPES = [
  { value: "bank_account", label: "Bank account" },
  { value: "mobile_wallet", label: "Mobile wallet" },
  { value: "ewallet", label: "E-wallet" },
  { value: "other", label: "Other" },
];

export default function PayoutProvidersManager() {
  const { toast } = useToast();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", provider_type: "bank_account", description: "" });

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.PayoutProvider.list("-created_date", 50);
      setProviders(list || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Provider name is required", variant: "destructive" });
      return;
    }
    try {
      await base44.entities.PayoutProvider.create({ ...form, is_active: true });
      setForm({ name: "", provider_type: "bank_account", description: "" });
      setAdding(false);
      toast({ title: "Payout provider added" });
      load();
    } catch (err) {
      toast({ title: "Could not add provider", description: err.message, variant: "destructive" });
    }
  };

  const toggle = async (p) => {
    try {
      await base44.entities.PayoutProvider.update(p.id, { is_active: !p.is_active });
      load();
    } catch (err) {
      toast({ title: "Could not update", description: err.message, variant: "destructive" });
    }
  };

  const remove = async (p) => {
    try {
      await base44.entities.PayoutProvider.delete(p.id);
      load();
    } catch (err) {
      toast({ title: "Could not delete", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payout Providers</h1>
        <p className="mt-1 text-muted-foreground">Configure the payout providers drivers can select during registration.</p>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setAdding((v) => !v)} className="h-10">
          <Plus className="mr-1 h-4 w-4" /> {adding ? "Cancel" : "Add provider"}
        </Button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="space-y-4 rounded-2xl border border-border bg-card p-6 treba-shadow">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Provider name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. FNB, MTC Mobile Money" className="h-11" /></div>
            <div className="space-y-2"><Label>Type</Label>
              <Select value={form.provider_type} onValueChange={(v) => setForm({ ...form, provider_type: v })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" className="h-11" /></div>
          <Button type="submit" className="h-10">Save provider</Button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : providers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payout providers configured yet. Drivers can still enter a provider name manually.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {providers.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-4">
              <div>
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-xs capitalize text-muted-foreground">{p.provider_type.replace("_", " ")} · {p.is_active ? "Active" : "Inactive"}</div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="ghost" className="h-8 px-2" onClick={() => toggle(p)}><Power className="h-4 w-4" /></Button>
                <Button variant="ghost" className="h-8 px-2 text-destructive" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}