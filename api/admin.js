export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } }
};

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

  const { pwd } = req.query;
  if (pwd !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const allTime = JSON.parse(await redis('GET', 'alltime') || '{}');

    // Get last 14 days
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const dayData = JSON.parse(await redis('GET', `day:${dateKey}`) || '{}');
      const uniqueIPs = await redis('SCARD', `ips:${dateKey}`) || 0;
      days.push({ date: dateKey, ...dayData, uniqueUsers: uniqueIPs });
    }

    // Get recent events
    const keys = await redis('KEYS', 'events:*') || [];
    const recentKeys = keys.sort().slice(-50);
    const recentEvents = [];
    for (const k of recentKeys) {
      const val = await redis('GET', k);
      if (val) recentEvents.push(JSON.parse(val));
    }

    const adminIP = process.env.ADMIN_IP || '';

    return res.status(200).json({
      allTime,
      days: days.reverse(),
      recentEvents: recentEvents
        .sort((a, b) => b.ts - a.ts)
        .map(e => ({
          ...e,
          isAdmin: adminIP && e.ip === adminIP,
          time: new Date(e.ts).toLocaleString('en-US', { timeZone: 'America/Chicago' })
        }))
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
