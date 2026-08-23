import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { settlePayoutStatus } from '../../shared/payoutEngine.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * Driver Wallet & Payout Engine — an administrator settles a processing payout
 * as paid, failed, or reversed. Failed/reversed payouts return funds to the
 * driver's available earnings.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { payout_id, status } = body || {};
    if (!payout_id || !status) return Response.json({ error: 'payout_id and status are required' }, { status: 400 });

    const admin = base44.asServiceRole;
    const result = await settlePayoutStatus(admin, payout_id, status);

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id,
        user_role: user.role,
        action: `payout_${status}`,
        entity_type: 'PayoutTransaction',
        record_id: payout_id,
        metadata: { status },
      });
    } catch (e) {}

    try {
      const payout = await admin.entities.PayoutTransaction.get(payout_id);
      if (payout && payout.driver_user_id) {
        const isPaid = status === 'paid';
        await sendNotification(admin, {
          user_id: payout.driver_user_id,
          event_type: isPaid ? NOTIFICATION_EVENTS.PAYOUT_COMPLETED : NOTIFICATION_EVENTS.PAYOUT_FAILED,
          title: isPaid ? 'Payout completed' : 'Payout failed',
          message: isPaid
            ? `Your payout of N$${Number(payout.net_amount).toFixed(0)} has been completed.`
            : `Your payout of N$${Number(payout.net_amount).toFixed(0)} failed. The amount was returned to your available earnings.`,
          related_id: payout_id,
        });
      }
    } catch (e) {}

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}