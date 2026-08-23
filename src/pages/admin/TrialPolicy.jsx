import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function AdminTrialPolicy() {
  const { toast } = useToast();
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "Default Trial Policy",
    trial_duration_days: 60,
    reminder_days: "30,14,7,3,1",
    transition_policy: "honor_existing_bookings",
    is_active: true,
    description: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.TrialPolicy.list("-created_date", 10);
      const p = (list && list[0]) || null;
      setPolicy(p);
      if (p) {
        setForm({
          name: p.name || "Default Trial Policy",
          trial_duration_days: p.trial_duration_days ?? 60,
          reminder_days: Array.isArray(p.reminder_days) ? p.reminder_days.join(",") : "30,14,7,3,1",
          transition_policy: p.transition_policy || "honor_existing_bookings",
          is_active: !!p.is_active,
          description: p.description || "",
        });
      }
    } catch (e) {
      // no policy yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    const reminderArr = form.reminder_days
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
    const payload = {
      name: form.name || "Default Trial Policy",
      trial_duration_days: Number(form.trial_duration_days || 60),
      reminder_days: reminderArr,
      transition_policy: form.transition_policy,
      is_active: !!form.is_active,
      description: form.description || "",
    };
    try {
      if (policy?.id) {
        await base44.entities.TrialPolicy.update(policy.id, payload);
      } else {
        const created = await base44.entities.TrialPolicy.create(payload);
        setPolicy(created);
      }
      toast({ title: "Trial policy saved" });
    } catch (e) {
      toast({ variant: "destructive", title: "Save failed", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trial Policy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the driver free trial: duration, reminder thresholds and how existing confirmed bookings are
          handled when a trial expires.
        </p>
      </div>

      <Card className="border-border treba-shadow">
        <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Policy name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Trial duration (days)</Label>
            <Input
              type="number"
              value={form.trial_duration_days}
              onChange={(e) => setForm({ ...form, trial_duration_days: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Reminder days (days remaining, comma-separated)</Label>
            <Input
              value={form.reminder_days}
              onChange={(e) => setForm({ ...form, reminder_days: e.target.value })}
              placeholder="30,14,7,3,1"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Transition policy when trial expires</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.transition_policy}
              onChange={(e) => setForm({ ...form, transition_policy: e.target.value })}
            >
              <option value="honor_existing_bookings">Honor existing confirmed bookings</option>
              <option value="release_bookings">Release existing bookings</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Active</Label>
            <div className="flex h-9 items-center">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save policy
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}