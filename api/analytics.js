export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } }
};

const COST_PER_INPUT_TOKEN = 0.80 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 4.00 / 1_000_000;

async function redis(command, ...args) {
  const url = process.env.KV_REST_API_URL || process.env.STORAGE_KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.STORAGE_KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Redis not configured');
  const res = await fetch(`${url}/${[command, ...args].map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data.result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { tool, inputTokens, outputTokens, success } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    const cost = ((inputTokens||0) * COST_PER_INPUT_TOKEN) + ((outputTokens||0) * COST_PER_OUTPUT_TOKEN);
    const now = Date.now();
    const dateKey = new Date().toISOString().slice(0, 10);
    const toolName = tool || 'unknown';

    // Store event
    const eventKey = `events:${now}:${Math.random().toString(36).slice(2,6)}`;
    await redis('SET', eventKey, JSON.stringify({
      tool: toolName, inputTokens: inputTokens||0, outputTokens: outputTokens||0,
      cost: parseFloat(cost.toFixed(6)), success: success !== false, ip, ts: now
    }), 'EX', String(60*60*24*30));

    // Update daily totals using pipeline-style individual sets
    const dayKey = `day:${dateKey}`;
    const existing = JSON.parse(await redis('GET', dayKey) || '{}');
    const updated = {
      ...existing,
      total: (existing.total||0) + 1,
      totalCost: parseFloat(((existing.totalCost||0) + cost).toFixed(6)),
      totalTokens: (existing.totalTokens||0) + (inputTokens||0) + (outputTokens||0),
      [toolName]: (existing[toolName]||0) + 1,
      [`${toolName}_cost`]: parseFloat(((existing[`${toolName}_cost`]||0) + cost).toFixed(6)),
      [`${toolName}_tokens`]: (existing[`${toolName}_tokens`]||0) + (inputTokens||0) + (outputTokens||0),
    };
    await redis('SET', dayKey, JSON.stringify(updated), 'EX', String(60*60*24*30));

    // Track unique IPs
    await redis('SADD', `ips:${dateKey}`, ip);
    await redis('EXPIRE', `ips:${dateKey}`, String(60*60*24*30));

    // Update all-time
    const allTime = JSON.parse(await redis('GET', 'alltime') || '{}');
    await redis('SET', 'alltime', JSON.stringify({
      ...allTime,
      total: (allTime.total||0) + 1,
      totalCost: parseFloat(((allTime.totalCost||0) + cost).toFixed(6)),
      totalTokens: (allTime.totalTokens||0) + (inputTokens||0) + (outputTokens||0),
      [toolName]: (allTime[toolName]||0) + 1,
      [`${toolName}_cost`]: parseFloat(((allTime[`${toolName}_cost`]||0) + cost).toFixed(6)),
    }));

    return res.status(200).json({ ok: true });
  } catch(e) {
    console.error('Analytics error:', e.message);
    return res.status(200).json({ ok: false, error: e.message });
  }
}
