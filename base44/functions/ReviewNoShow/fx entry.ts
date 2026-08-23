import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * No-Show Management — an administrator reviews a no-show / dispute case and
 * upholds or overturns it. The financial outcome is recorded per the configured
 * no-show policy. Treba does NOT automatically refund the passenger; any refund
 * amount is recorded as a decision and must be processed separately by an admin.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { no_show_report_id, decision, review_notes, refund_amount } = body || {};
    if (!no_show_report_id || !['upheld', 'overturned'].includes(decision)) {
      return Response.json({ error: 'no_show_report_id and decision (upheld|overturned) are required' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const report = await admin.entities.NoShowReport.get(no_show_report_id);
    if (!report) return Response.json({ error: 'No-show report not found' }, { status: 404 });

    let policy = null;
    try {
      const policies = await admin.entities.NoShowPolicy.list('-created_date', 50);
      policy = (policies || []).find((p) => p.is_active) || null;
    } catch (e) {}

    const now = new Date().toISOString();
    let financialOutcome = '';
    let refundAmount = Number(refund_amount) || 0;
    if (decision === 'upheld') {
      const pct = policy && Number(policy.refund_percentage) >= 0 ? Number(policy.refund_percentage) : 0;
      const charge = policy ? !!policy.charge_passenger : true;
      financialOutcome = `No-show upheld. ${charge ? 'Passenger is charged per the no-show policy.' : 'No charge applied.'}${policy && policy.refund_enabled && pct > 0 ? ` Refund of ${pct}% permitted by policy (not auto-processed).` : ' No refund under this policy.'}`;
    } else {
      financialOutcome = 'No-show overturned. The passenger is not penalised. Any refund is processed separately by an admin.';
      refundAmount = 0;
    }

    await admin.entities.NoShowReport.update(no_show_report_id, {
      no_show_status: decision,
      review_decision: decision,
      review_notes: review_notes || null,
      reviewed_by: user.id,
      reviewed_at: now,
      financial_outcome: financialOutcome,
      refund_amount: refundAmount,
    });

    if (report.booking_id) {
      try {
        await admin.entities.Booking.update(report.booking_id, {
          no_show_status: decision === 'upheld' ? 'upheld' : 'overturned',
          was_no_show: decision === 'upheld',
        });
      } catch (e) {}
    }

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id,
        user_role: user.role,
        action: `no_show_${decision}`,
        entity_type: 'NoShowReport',
        record_id: report.id,
        metadata: { booking_id: report.booking_id, refund_amount: refundAmount },
      });
    } catch (e) {}

    try {
      await sendNotification(admin, { user_id: report.passenger_id, event_type: NOTIFICATION_EVENTS.DISPUTE_UPDATE, title: `No-show ${decision}`, message: financialOutcome, related_id: report.trip_request_id });
    } catch (e) {}

    return Response.json({ status: decision, financial_outcome: financialOutcome });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}