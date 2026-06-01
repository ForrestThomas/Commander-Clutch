import { kv } from '@vercel/kv';

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Password check
  const { pwd } = req.query;
  if (pwd !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get all-time totals
    const allTime = await kv.get('alltime') || {};

    // Get last 14 days
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const dayData = await kv.get(`day:${dateKey}`) || {};
      const uniqueIPs = await kv.scard(`ips:${dateKey}`) || 0;
      days.push({ date: dateKey, ...dayData, uniqueUsers: uniqueIPs });
    }

    // Get recent events (last 50)
    const keys = await kv.keys('events:*');
    const recentKeys = keys.sort().slice(-50);
    const recentEvents = recentKeys.length > 0
      ? await Promise.all(recentKeys.map(k => kv.get(k)))
      : [];

    // Your IP for filtering (set ADMIN_IP env var)
    const adminIP = process.env.ADMIN_IP || '';

    return res.status(200).json({
      allTime,
      days: days.reverse(), // oldest first
      recentEvents: recentEvents
        .filter(Boolean)
        .sort((a, b) => b.ts - a.ts)
        .map(e => ({
          ...e,
          isAdmin: adminIP && e.ip === adminIP,
          time: new Date(e.ts).toLocaleString('en-US', { timeZone: 'America/Chicago' })
        })),
      adminIP: adminIP ? '(set)' : '(not set)'
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
