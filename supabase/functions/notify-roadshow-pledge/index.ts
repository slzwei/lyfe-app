import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PledgePayload {
  eventId: string;
  agentId: string;
  agentName: string;
  pledgedSitdowns: number;
  pledgedPitches: number;
  pledgedClosed: number;
  pledgedAfyc: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: PledgePayload = await req.json();
    const { eventId, agentId, agentName, pledgedSitdowns, pledgedPitches, pledgedClosed, pledgedAfyc } = payload;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get the event to find creator (T2 manager)
    const { data: event } = await supabase
      .from('events')
      .select('created_by, title')
      .eq('id', eventId)
      .single();

    if (!event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: corsHeaders });
    }

    // Get T2 (manager) and T3 (director = manager's reports_to)
    const { data: manager } = await supabase
      .from('users')
      .select('id, push_token, reports_to')
      .eq('id', event.created_by)
      .single();

    const recipientIds: string[] = [];
    if (manager && manager.id !== agentId) recipientIds.push(manager.id);

    if (manager?.reports_to && manager.reports_to !== agentId) {
      const { data: director } = await supabase
        .from('users')
        .select('id, push_token')
        .eq('id', manager.reports_to)
        .single();
      if (director && !recipientIds.includes(director.id)) {
        recipientIds.push(director.id);
      }
    }

    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });
    }

    // Fetch push tokens for recipients
    const { data: recipients } = await supabase
      .from('users')
      .select('id, push_token')
      .in('id', recipientIds)
      .not('push_token', 'is', null);

    const tokens = (recipients || []).map((r: any) => r.push_token).filter(Boolean);
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });
    }

    const message = {
      to: tokens,
      sound: 'default',
      title: `${agentName} pledged for ${event.title}`,
      body: `S${pledgedSitdowns} P${pledgedPitches} C${pledgedClosed} AFYC $${pledgedAfyc.toLocaleString()}`,
      data: { eventId, agentId },
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    return new Response(JSON.stringify({ sent: tokens.length }), { headers: corsHeaders });
  } catch (err) {
    console.error('notify-roadshow-pledge error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
