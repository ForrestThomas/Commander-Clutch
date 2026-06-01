export const config = {
  api: { bodyParser: false }
};

// Cache playlist in memory for 6 hours
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 6 * 60 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Return cached data if fresh
  if (cache.data && Date.now() - cache.timestamp < CACHE_TTL) {
    return res.status(200).json(cache.data);
  }

  try {
    // Use Claude with web search to get live playlist
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'interleaved-thinking-2025-05-14'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Search wzhub.gg/playlist/wz and return the CURRENT live Warzone playlist right now. 

Return ONLY a JSON object with NO other text, in this exact format:
{
  "season": "Season X Reloaded",
  "updated": "Month DD",
  "modes": [
    {
      "mode": "Battle Royale",
      "maps": ["Verdansk", "Avalon"],
      "squads": ["Solos", "Duos", "Trios", "Quads"],
      "label": "Battle Royale"
    }
  ],
  "maps": ["Verdansk", "Avalon", "Rebirth Island", "Haven's Hollow"]
}

Rules:
- modes array should have one entry per distinct mode type (Battle Royale, Resurgence, Plunder, etc)
- maps array should be all unique maps currently in rotation
- squads should only include squad sizes actually available for that mode
- Include LTMs with isLTM: true
- Only include modes actually live right now
- Return pure JSON only, no markdown, no explanation`
        }]
      })
    });

    const data = await response.json();

    // Extract text from response (may include tool use blocks)
    const textBlocks = data.content ? data.content.filter(b => b.type === 'text') : [];
    const rawText = textBlocks.map(b => b.text).join('').trim();

    // Parse JSON from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    const playlist = JSON.parse(jsonMatch[0]);

    // Cache it
    cache = { data: playlist, timestamp: Date.now() };

    return res.status(200).json(playlist);

  } catch (e) {
    // Fallback to known current playlist if AI fails
    const fallback = {
      season: 'Season 3 Reloaded',
      updated: 'May 2026',
      modes: [
        { mode: 'Battle Royale', label: 'Battle Royale', maps: ['Verdansk', 'Avalon'], squads: ['Quads'], isLTM: false },
        { mode: 'Hot Pursuit', label: 'Hot Pursuit (LTM)', maps: ['Avalon'], squads: ['Solos', 'Quads'], isLTM: true },
        { mode: 'Resurgence', label: 'Resurgence', maps: ["Haven's Hollow", 'Rebirth Island'], squads: ['Solos', 'Duos', 'Quads'], isLTM: false },
        { mode: 'Battle Royale Casual', label: 'BR Casual', maps: ['Verdansk', 'Avalon'], squads: ['Quads'], isLTM: false },
        { mode: 'Resurgence Casual', label: 'Resurgence Casual', maps: ["Haven's Hollow", 'Rebirth Island'], squads: ['Quads'], isLTM: false },
        { mode: 'Plunder', label: 'Plunder', maps: ['Verdansk'], squads: ['Quads'], isLTM: false },
      ],
      maps: ['Verdansk', 'Avalon', "Haven's Hollow", 'Rebirth Island']
    };
    cache = { data: fallback, timestamp: Date.now() };
    return res.status(200).json(fallback);
  }
}
