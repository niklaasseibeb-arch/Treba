import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getTrialPolicy, maybeSendTrialReminder } from '../../shared/driverSubscription.ts';

/**
 * Scan all active free trials and send any due reminder notifications at the
 * configured days-remaining thresholds (default 30, 14, 7, 3, 1). Intended to
 * run on a daily schedule, or be triggered manually by an admin.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const admin = base44.asServiceRole;
    const policy = await getTrialPolicy(admin);

    const subs = await admin.entities.DriverSubscription.filter({ is_trial: true, status: 'trial' }, '-created_date', 500).catch(() => []);
    let processed = 0;
    let notified = 0;
    for (const s of (subs || [])) {
      processed++;
      try {
        const sent = await maybeSendTrialReminder(admin, s, policy);
        if (sent) notified++;
      } catch (e) {}
    }

    return Response.json({ processed, notified });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}