import fetch from 'node-fetch';

export async function extractFieldsUsingOpenAI({ rawText = '', imageUrl = null, idType = 'national-id', timeoutMs = 10000 } = {}) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || null;
  if (!apiKey) return { success: false, error: 'OPENAI_API_KEY not configured' };

  const system = `You are a JSON extraction assistant. When asked, you must return a JSON object following the provided schema for identity fields. Do not emit extra commentary.`;
  const user = `OCR text:\n${String(rawText || '').slice(0, 32000)}\n\nImage URL: ${imageUrl || 'none'}\nRequested idType: ${idType || 'national-id'}`;

  const functions = [
    {
      name: 'extract_identity_fields',
      description: 'Extract identity fields from OCR text and return JSON following the schema',
      parameters: {
        type: 'object',
        properties: {
          firstName: { type: ['string', 'null'], description: 'Given name(s) or first name' },
          lastName: { type: ['string', 'null'], description: 'Family name / last name' },
          idNumber: { type: ['string', 'null'], description: 'ID number printed on the document' },
          birthDate: { type: ['string', 'null'], description: 'Birth date in ISO YYYY-MM-DD if available' },
          confidence: { type: ['string', 'null'], enum: ['low','medium','high'], description: 'Estimated confidence level' }
        },
        required: []
      }
    }
  ];

  const body = {
    model: 'gpt-3.5-turbo-16k',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.0,
    max_tokens: 800,
    functions,
    function_call: { name: 'extract_identity_fields' }
  };

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  if (controller) setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller ? controller.signal : undefined
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { success: false, error: `OpenAI HTTP ${res.status}: ${text}` };
    }

    const j = await res.json();
    const choice = j.choices?.[0];
    const func = choice?.message?.function_call;
    let parsed = null;
    let rawAssistant = choice?.message?.content || null;

    if (func?.arguments) {
      rawAssistant = func.arguments;
      try {
        parsed = JSON.parse(func.arguments);
      } catch (e) {
        parsed = null;
      }
    }

    return { success: true, rawAssistant, parsed, fullResponse: j };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

export default { extractFieldsUsingOpenAI };
