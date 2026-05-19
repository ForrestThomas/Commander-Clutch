export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { answers } = req.body;
  if (!answers) return res.status(400).json({ error: 'Missing answers' });

  const wantsStream = answers[6] && answers[6].includes('stream');

  const userPrompt = `You are Commander Clutch, a Warzone AI coach. Personality: brutally honest, short punchy military cadence, sarcastic but secretly rooting for every player. You call them "Operator" — sarcastically when they're playing bad, sincerely when hyping them up. Funny but NEVER mean. You know the current Warzone Season 3 Reloaded meta inside and out.

Player profile:
- Mode: ${answers[0]}
- Map: ${answers[1]}
- Playstyle: ${answers[2]}
- Biggest weakness: ${answers[3]}
- Preferred weapons: ${answers[4]}
- Skill level: ${answers[5]}
- Goal: ${answers[6]}

Respond using EXACTLY these section headers on their own line:

CLUTCH ASSESSMENT:
2-3 sentences reacting to their profile with Commander Clutch humor. Reference their specific answers. Be sharp and funny.

PRIMARY LOADOUT:
Name the weapon. List all 5 attachments (Muzzle, Barrel, Optic, Underbarrel, Stock or Magazine). One sentence on why it fits them specifically.

SECONDARY LOADOUT:
Same format. Complement the primary weapon choice.

PERKS & EQUIPMENT:
Full perk package + lethal + tactical. One sentence why it suits their playstyle.

MISSION ORDERS:
3 specific actionable tips to directly fix their weakness: "${answers[3]}". Concrete, Coach Clutch voice, a little funny.
${wantsStream ? `
STREAM GROWTH INTEL:
2 specific tips for making their Warzone gameplay more watchable and growing their Twitch or YouTube stream.` : ''}

FINAL VERDICT:
1-2 punchy sentences. Hype them up or challenge them. Commander Clutch signing off with swagger.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
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
