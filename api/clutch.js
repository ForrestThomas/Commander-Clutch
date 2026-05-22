export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { answers, customPrompt } = req.body;
  let userPrompt;

  if (customPrompt) {
    userPrompt = customPrompt;
  } else if (answers) {
    const wantsStream = answers[6] && answers[6].includes('stream');
    userPrompt = `You are Commander Clutch, a Warzone AI coach. Brutally honest, short punchy military cadence, sarcastic but secretly rooting for every player. Call them "Operator". Funny but NEVER mean. You know Warzone Season 3 Reloaded meta inside and out.

Player profile:
- Mode: ${answers[0]}
- Map: ${answers[1]}
- Playstyle: ${answers[2]}
- Biggest weakness: ${answers[3]}
- Preferred weapons: ${answers[4]}
- Skill level: ${answers[5]}
- Goal: ${answers[6]}

Respond with EXACTLY these section headers:

CLUTCH ASSESSMENT:
2-3 sentences reacting to their profile with Commander Clutch humor. Sharp and funny.

PRIMARY LOADOUT:
Weapon name. All 5 attachments (Muzzle, Barrel, Optic, Underbarrel, Stock or Magazine). One sentence why it fits them.

SECONDARY LOADOUT:
Same format. Complement the primary.

PERKS & EQUIPMENT:
Full perk package + lethal + tactical. One sentence why.

MISSION ORDERS:
3 specific tips to fix their weakness: "${answers[3]}". Clutch voice, a little funny.
${wantsStream ? '\nSTREAM GROWTH INTEL:\n2 specific tips for growing their Twitch or YouTube stream.' : ''}

FINAL VERDICT:
1-2 punchy sentences. Commander Clutch signing off.`;
  } else {
    return res.status(400).json({ error: 'Missing answers or customPrompt' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1500,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data });
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    res.status(200).json({ result: text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
