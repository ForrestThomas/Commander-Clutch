import { kv } from '@vercel/kv';

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } }
};

// Token costs per million for claude-haiku-4-5
const COST_PER_INPUT_TOKEN = 0.80 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 4.00 / 1_000_000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const {
      tool,           // 'briefing' | 'drop' | 'meta' | 'gulag' | 'loadouts' | 'stream'
      inputTokens,    // from Anthropic response
      outputTokens,   // from Anthropic response
      success,        // bool
    } = req.body;

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const cost = (inputTokens * COST_PER_INPUT_TOKEN) + (outputTokens * COST_PER_OUTPUT_TOKEN);
    const now = Date.now();
    const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const event = {
      tool: tool || 'unknown',
      inputTokens: inputTokens || 0,
      outputTokens: outputTokens || 0,
      cost: parseFloat(cost.toFixed(6)),
      success: success !== false,
      ip,
      ts: now,
    };

    // Store individual event (keep last 1000)
    const eventKey = `events:${now}:${Math.random().toString(36).slice(2,6)}`;
    await kv.set(eventKey, event, { ex: 60 * 60 * 24 * 30 }); // 30 day TTL

    // Update daily totals
    const dayKey = `day:${dateKey}`;
    const existing = await kv.get(dayKey) || {};
    const toolKey = tool || 'unknown';

    const updated = {
      ...existing,
      total: (existing.total || 0) + 1,
      totalCost: parseFloat(((existing.totalCost || 0) + cost).toFixed(6)),
      totalTokens: (existing.totalTokens || 0) + (inputTokens || 0) + (outputTokens || 0),
      [toolKey]: (existing[toolKey] || 0) + 1,
      [`${toolKey}_cost`]: parseFloat(((existing[`${toolKey}_cost`] || 0) + cost).toFixed(6)),
      [`${toolKey}_tokens`]: (existing[`${toolKey}_tokens`] || 0) + (inputTokens || 0) + (outputTokens || 0),
    };

    // Track unique IPs per day
    const ipSetKey = `ips:${dateKey}`;
    await kv.sadd(ipSetKey, ip);
    await kv.expire(ipSetKey, 60 * 60 * 24 * 30);
    await kv.set(dayKey, updated, { ex: 60 * 60 * 24 * 30 });

    // Update all-time totals
    const allTime = await kv.get('alltime') || {};
    await kv.set('alltime', {
      total: (allTime.total || 0) + 1,
      totalCost: parseFloat(((allTime.totalCost || 0) + cost).toFixed(6)),
      totalTokens: (allTime.totalTokens || 0) + (inputTokens || 0) + (outputTokens || 0),
      [toolKey]: (allTime[toolKey] || 0) + 1,
      [`${toolKey}_cost`]: parseFloat(((allTime[`${toolKey}_cost`] || 0) + cost).toFixed(6)),
    });

    return res.status(200).json({ ok: true });
  } catch(e) {
    // Never let analytics break the main flow
    console.error('Analytics error:', e.message);
    return res.status(200).json({ ok: false, error: e.message });
  }
}
