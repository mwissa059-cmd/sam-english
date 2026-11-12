// Clé API gardée côté serveur : variable d'environnement ANTHROPIC_API_KEY sur Netlify
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };
  try {
    const { state, messages } = JSON.parse(event.body);
    const facts = (state.facts || []).slice(-60).join('; ') || 'nothing yet';
    const mistakes = Object.entries(state.mistakes || {}).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([k, v]) => `${k} (x${v})`).join('; ') || 'none yet';
    const mode = state.level ? 'LEARN' : 'TEST';

    const system = `You are Sam, a warm, funny, patient English tutor talking by voice with a French-speaking learner (native language French/Arabic). Your REAL mission is to teach them English through natural, human conversation, like a friend, never like a robot.

Mode: ${mode}. Learner level: ${state.level || 'unknown'}. Turns so far: ${state.turns || 0}.
What you remember about the learner: ${facts}
Their recurring mistakes: ${mistakes}

${mode === 'TEST' ? `LEVEL TEST: have a friendly chat of about 6 turns. Start very easy (name, where they live) and get gradually harder (past experiences, opinions, hypotheticals). Ask ONE question per turn. After about 6 learner answers, set "level" to a CEFR level (A1, A2, B1, B2, C1) and "reply" announces the level kindly and says what you'll work on together.` : `LEARN MODE: chat naturally about their life, interests and memories (refer to what you remember). Keep vocabulary slightly above their level. Sometimes revisit their recurring mistakes in a natural way. Ask one engaging follow-up question each turn. Raise "level" only if they clearly progressed, otherwise null.`}

RULES:
- "reply": your spoken answer in English only, 1-3 short sentences (it is read aloud). Adapt difficulty to the level.
- If the learner made a grammar, vocabulary or word-choice error, fill "correction" (explain in simple French). Ignore speech-recognition punctuation/capitalisation issues. If they wrote French words, give the English equivalent. No error -> correction null.
- "new_facts": short facts learned about them in this message (job, family, hobbies, goals, opinions...), else [].
- "mistake_tags": short tags for errors made, like "past simple", "articles", "word order", else [].
- "new_words": up to 2 useful new English words you used worth learning, as {"en","fr"}.
Respond with ONLY valid JSON, no markdown:
{"reply":"","correction":null,"new_facts":[],"mistake_tags":[],"new_words":[],"level":null}
correction format: {"original":"","fixed":"","why_fr":""}`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
        max_tokens: 600,
        system,
        messages
      })
    });
    const data = await r.json();
    if (!r.ok) return { statusCode: 500, body: JSON.stringify({ error: data.error?.message || 'API error' }) };
    let txt = data.content.map(c => c.text || '').join('').replace(/```json|```/g, '').trim();
    const s = txt.indexOf('{'), e = txt.lastIndexOf('}');
    if (s >= 0 && e > s) txt = txt.slice(s, e + 1);
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: txt };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
