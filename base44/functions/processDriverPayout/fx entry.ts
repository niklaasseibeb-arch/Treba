import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { processPayout } from '../../shared/payoutEngine.ts';

/**
 * Driver Wallet & Payout Engine — a driver requests a payout of available
 * earnings to their registered, verified payout method. Creates a payout
 * record (payout_processing) with a secure reference. No specific provider API
 * is assumed; the provider adapter is abstracted in the payout gateway.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { amount } = body || {};
    if (!amount) return Response.json({ error: 'amount is required' }, { status: 400 });

    const admin = base44.asServiceRole;
    const payout = await processPayout(admin, user.id, amount);

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id,
        user_role: user.role,
        action: 'driver_payout_requested',
        entity_type: 'PayoutTransaction',
        record_id: payout.id,
        metadata: { amount: payout.amount, reference: payout.transaction_reference },
      });
    } catch (e) {}

    return Response.json({ payout });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}