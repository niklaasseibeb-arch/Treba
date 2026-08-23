import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Returns the sanitized list of active payment providers available to the
 * passenger. The raw provider configuration (which may reference gateway
 * settings) is never exposed to passengers.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = base44.asServiceRole;
    const providers = await admin.entities.PaymentProvider.list('display_order', 200);
    const methods = (providers || [])
      .filter((p) => p.is_active)
      .map((p) => ({
        id: p.id,
        name: p.name,
        provider_code: p.provider_code,
        category: p.category,
        description: p.description || '',
        display_order: p.display_order || 0,
        icon_url: p.icon_url || null,
      }))
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    return Response.json({ methods });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}