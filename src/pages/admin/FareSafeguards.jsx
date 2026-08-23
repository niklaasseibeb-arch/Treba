import React, { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Save, Trash2, Plus, Info } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export default function FareSafeguards() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState([]);
  const [name, setName] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [currency, setCurrency] = useState("NAD");
  const [activeId, setActiveId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const list = await base44.entities.FareNegotiationConfig.list("-created_date", 50);
      setConfigs(list || []);
      const active = (list || []).find((c) => c.is_active);
      setActiveId(active?.id || null);
    } catch (err) {
      toast({ title: "Could not load safeguards", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!name.trim()) {
      toast({ title: "Enter a name", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.FareNegotiationConfig.create({
        name: name.trim(),
        min_amount: minAmount === "" ? 0 : Number(minAmount),
        max_amount: maxAmount === "" ? 0 : Number(maxAmount),
        currency: currency || "NAD",
        is_active: false,
      });
      toast({ title: "Safeguard added" });
      setName(""); setMinAmount(""); setMaxAmount("");
      load();
    } catch (err) {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (cfg) => {
    try {
      // Deactivate others, activate the chosen one.
      for (const c of configs) {
        if (c.is_active && c.id !== cfg.id) {
          await base44.entities.FareNegotiationConfig.update(c.id, { is_active: false });
        }
      }
      await base44.entities.FareNegotiationConfig.update(cfg.id, { is_active: !cfg.is_active });
      load();
    } catch (err) {
      toast({ title: "Could not update", description: err.message, variant: "destructive" });
    }
  };

  const remove = async (cfg) => {
    try {
      await base44.entities.FareNegotiationConfig.delete(cfg.id);
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
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ShieldCheck className="h-6 w-6 text-primary" /> Fare Safeguards</h1>
        <p className="mt-1 text-muted-foreground">Optional minimum/maximum transaction rules. These are operational safeguards only and are never shown to users as a Treba fare estimate.</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Treba never estimates, suggests or ranges a fare. The fare is always negotiated between passenger and driver. Safeguards only reject offers outside the permitted range, without revealing a fare estimate.</span>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
        <div className="flex items-center gap-2 text-sm font-semibold"><Plus className="h-4 w-4 text-primary" /> Add a safeguard</div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Default safeguards" className="h-10" /></div>
          <div className="space-y-1.5"><Label>Minimum amount (NAD, 0 = none)</Label><Input type="number" min="0" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="h-10" /></div>
          <div className="space-y-1.5"><Label>Maximum amount (NAD, 0 = none)</Label><Input type="number" min="0" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className="h-10" /></div>
          <div className="space-y-1.5"><Label>Currency</Label><Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-10" /></div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button className="h-10" disabled={saving} onClick={save}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save safeguard
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
        <div className="text-sm font-semibold">Configured safeguards</div>
        {configs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No safeguards configured. All negotiated fares are accepted.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {configs.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div>
                  <div className="text-sm font-semibold">{c.name} {c.is_active && <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Active</span>}</div>
                  <div className="text-xs text-muted-foreground">Min: N${c.min_amount || 0} · Max: N${c.max_amount || 0} · {c.currency || "NAD"}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="h-8" onClick={() => toggleActive(c)}>{c.is_active ? "Deactivate" : "Activate"}</Button>
                  <Button variant="ghost" className="h-8 text-destructive hover:bg-destructive/5" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}