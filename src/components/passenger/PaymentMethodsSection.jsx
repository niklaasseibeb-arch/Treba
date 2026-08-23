import React, { useState } from "react";
import { CreditCard, Plus, Trash2, Star, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const METHOD_TYPES = [
  { value: "card", label: "Bank card" },
  { value: "wallet", label: "Mobile wallet" },
  { value: "cash", label: "Cash on boarding" },
];

export default function PaymentMethodsSection({ profile, profileId, onSaved }) {
  const { toast } = useToast();
  const [methods, setMethods] = useState(profile?.payment_methods || []);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ method_type: "card", label: "", is_default: false });

  const persist = async (next) => {
    setSaving(true);
    try {
      const saved = await base44.entities.PassengerProfile.update(profileId, { payment_methods: next });
      setMethods(next);
      onSaved?.(saved);
      toast({ title: "Payment methods updated" });
    } catch (err) {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.label.trim()) {
      toast({ title: "Add a label for this method", variant: "destructive" });
      return;
    }
    let next = [...methods];
    if (form.is_default) next = next.map((m) => ({ ...m, is_default: false }));
    next.push({ ...form, is_default: form.is_default || next.length === 0 });
    persist(next);
    setForm({ method_type: "card", label: "", is_default: false });
    setAdding(false);
  };

  const remove = (idx) => {
    let next = methods.filter((_, i) => i !== idx);
    if (next.length && !next.some((m) => m.is_default)) next[0].is_default = true;
    persist(next);
  };

  const setDefault = (idx) => {
    const next = methods.map((m, i) => ({ ...m, is_default: i === idx }));
    persist(next);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6 treba-shadow">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Payment methods</h2>
          <p className="text-sm text-muted-foreground">Manage how you pay for your trips.</p>
        </div>
        {!adding && (
          <Button variant="outline" className="h-9" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.method_type} onValueChange={(v) => setForm((f) => ({ ...f, method_type: v }))}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHOD_TYPES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pmLabel">Label</Label>
              <Input id="pmLabel" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. FNB Visa" className="h-11" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))} />
            Set as default
          </label>
          <div className="flex gap-2">
            <Button type="submit" className="h-9" disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />} Save method
            </Button>
            <Button type="button" variant="outline" className="h-9" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {methods.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">No payment methods yet. Add one to speed up your bookings.</p>
      ) : (
        <ul className="divide-y divide-border">
          {methods.map((m, i) => (
            <li key={i} className="flex items-center gap-3 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-medium">{m.label}</div>
                <div className="text-xs capitalize text-muted-foreground">{m.method_type.replace("_", " ")}</div>
              </div>
              {m.is_default && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                  <Star className="h-3 w-3" /> Default
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                {!m.is_default && (
                  <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setDefault(i)}>Set default</Button>
                )}
                <Button variant="ghost" className="h-8 px-2 text-destructive" onClick={() => remove(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}