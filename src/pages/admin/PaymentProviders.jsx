import React, { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Power, Landmark, Info } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const CATEGORIES = [
  { value: "bank_card", label: "Bank Card" },
  { value: "mobile_wallet", label: "Mobile Wallet" },
  { value: "pay2cell", label: "Pay2Cell" },
  { value: "other_digital", label: "Other Digital Provider" },
  { value: "cash_to_driver", label: "Cash to Driver" },
];

export default function AdminPaymentProviders() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState([]);
  const [form, setForm] = useState({ name: "", provider_code: "", category: "bank_card", display_order: 0, description: "", icon_url: "", uses_stripe: false });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const list = await base44.entities.PaymentProvider.list("display_order", 200);
      setProviders(list || []);
    } catch (err) {
      toast({ title: "Could not load providers", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim() || !form.provider_code.trim()) {
      toast({ title: "Name and provider code are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const configuration = form.uses_stripe ? { uses_stripe: true, secret_name: "STRIPE_SECRET_KEY" } : {};
      await base44.entities.PaymentProvider.create({
        name: form.name.trim(),
        provider_code: form.provider_code.trim(),
        category: form.category,
        is_active: true,
        display_order: Number(form.display_order) || 0,
        description: form.description.trim(),
        icon_url: form.icon_url.trim() || null,
        configuration,
      });
      toast({ title: "Payment provider added" });
      setForm({ name: "", provider_code: "", category: "bank_card", display_order: 0, description: "", icon_url: "", uses_stripe: false });
      load();
    } catch (err) {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p) => {
    try {
      await base44.entities.PaymentProvider.update(p.id, { is_active: !p.is_active });
      load();
    } catch (err) {
      toast({ title: "Could not update", description: err.message, variant: "destructive" });
    }
  };

  const remove = async (p) => {
    try {
      await base44.entities.PaymentProvider.delete(p.id);
      load();
    } catch (err) {
      toast({ title: "Could not delete", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Landmark className="h-6 w-6 text-primary" /> Payment Providers</h1>
        <p className="mt-1 text-muted-foreground">Configure the payment providers available to passengers. Treba is provider-agnostic — add any bank card, mobile wallet, Pay2Cell, other digital provider, or cash-to-driver option.</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Treba never stores card PINs, wallet PINs, passwords or OTPs. For bank cards via Stripe, set the <strong>STRIPE_SECRET_KEY</strong> app secret on the main branch; without it, card payments use the manual confirmation flow.</span>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
        <div className="flex items-center gap-2 text-sm font-semibold"><Plus className="h-4 w-4 text-primary" /> Add a provider</div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Visa/Mastercard" className="h-10" /></div>
          <div className="space-y-1.5"><Label>Provider code</Label><Input value={form.provider_code} onChange={(e) => setForm({ ...form, provider_code: e.target.value })} placeholder="e.g. stripe" className="h-10" /></div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Display order</Label><Input type="number" min="0" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} className="h-10" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short note shown to passengers" className="h-10" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Icon URL (optional)</Label><Input value={form.icon_url} onChange={(e) => setForm({ ...form, icon_url: e.target.value })} className="h-10" /></div>
          {form.category === "bank_card" && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.uses_stripe} onChange={(e) => setForm({ ...form, uses_stripe: e.target.checked })} />
              Use Stripe for card payment intents (requires STRIPE_SECRET_KEY)
            </label>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Button className="h-10" disabled={saving} onClick={save}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Save provider
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
        <div className="text-sm font-semibold">Configured providers</div>
        {providers.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No payment providers configured yet. Passengers won't see any payment methods until you add one.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {providers.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div>
                  <div className="text-sm font-semibold">
                    {p.name}
                    {!p.is_active && <span className="ml-2 inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">Inactive</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.category.replace("_", " ")} · code: {p.provider_code}{p.configuration?.uses_stripe ? " · Stripe" : ""}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="h-8" onClick={() => toggle(p)}>
                    <Power className="mr-2 h-4 w-4" /> {p.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button variant="ghost" className="h-8 text-destructive hover:bg-destructive/5" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}