import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Loader2, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const EMPTY = {
  plan_code: "starter",
  name: "",
  price: "",
  currency: "NAD",
  trip_allowance: "",
  is_unlimited: false,
  billing_cycle: "monthly",
  is_active: true,
  description: "",
  sort_order: 0,
};

export default function AdminSubscriptionPlans() {
  const { toast } = useToast();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.DriverSubscriptionPlan.list("sort_order", 50);
      setPlans(list || []);
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to load plans", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setForm(EMPTY);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (p) => {
    setForm({
      ...EMPTY,
      ...p,
      price: p.price ?? "",
      trip_allowance: p.trip_allowance ?? "",
      sort_order: p.sort_order ?? 0,
    });
    setEditingId(p.id);
    setOpen(true);
  };

  const save = async () => {
    if (!form.name || form.price === "") {
      toast({ variant: "destructive", title: "Name and price are required" });
      return;
    }
    setSaving(true);
    const payload = {
      plan_code: form.plan_code,
      name: form.name,
      price: Number(form.price),
      currency: form.currency || "NAD",
      trip_allowance: Number(form.trip_allowance || 0),
      is_unlimited: !!form.is_unlimited,
      billing_cycle: form.billing_cycle || "monthly",
      is_active: !!form.is_active,
      description: form.description || "",
      sort_order: Number(form.sort_order || 0),
    };
    try {
      if (editingId) {
        await base44.entities.DriverSubscriptionPlan.update(editingId, payload);
        toast({ title: "Plan updated" });
      } else {
        await base44.entities.DriverSubscriptionPlan.create(payload);
        toast({ title: "Plan created" });
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast({ variant: "destructive", title: "Save failed", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Driver Subscription Plans</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure the subscription products drivers can choose. Treba charges no commission on passenger fares —
            only the monthly subscription fee.
          </p>
        </div>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> New plan
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card treba-shadow">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Price / month</th>
                <th className="px-4 py-3 font-semibold">Trip allowance</th>
                <th className="px-4 py-3 font-semibold">Active</th>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {plans.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-semibold">
                    {p.name}
                    <div className="text-xs font-normal text-muted-foreground">{p.plan_code}</div>
                  </td>
                  <td className="px-4 py-3">N${Number(p.price || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">{p.is_unlimited ? "Unlimited" : `${p.trip_allowance} trips`}</td>
                  <td className="px-4 py-3">{p.is_active ? <Check className="h-4 w-4 text-emerald-600" /> : "—"}</td>
                  <td className="px-4 py-3">{p.sort_order}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No plans yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit plan" : "New subscription plan"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Plan name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Standard"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Plan code</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.plan_code}
                onChange={(e) => setForm({ ...form, plan_code: e.target.value })}
              >
                <option value="starter">starter</option>
                <option value="standard">standard</option>
                <option value="premium">premium</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Price (NAD) / month</Label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Trip allowance</Label>
              <Input
                type="number"
                disabled={form.is_unlimited}
                value={form.trip_allowance}
                onChange={(e) => setForm({ ...form, trip_allowance: e.target.value })}
                placeholder={form.is_unlimited ? "Unlimited" : "e.g. 14"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sort order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <div className="text-sm font-medium">Unlimited trips</div>
                <div className="text-xs text-muted-foreground">No cap on completed trips per month</div>
              </div>
              <Switch
                checked={form.is_unlimited}
                onCheckedChange={(v) => setForm({ ...form, is_unlimited: v })}
              />
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div className="text-sm font-medium">Active (available to drivers)</div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}