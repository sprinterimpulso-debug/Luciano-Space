const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type SelectionTarget = 'LIVE_GRATUITA' | 'DESPERTOS';

type IncomingQuestion = {
  id: number;
  author?: string;
  text: string;
};

type IncomingPayload = {
  selectionTarget: SelectionTarget;
  questions: IncomingQuestion[];
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const getTargetLabel = (target: SelectionTarget): string =>
  target === 'LIVE_GRATUITA' ? 'Live Gratuita' : 'Despertos';

const normalizeQuestionLine = (question: IncomingQuestion, index: number): string => {
  const author = question.author?.trim() || 'Anônimo';
  const normalizedText = question.text.replace(/\s+/g, ' ').trim();
  return `${index + 1}. [#${question.id}] ${author}: ${normalizedText}`;
};

const splitMessages = (headerText: string, lines: string[], maxLength = 3800): string[] => {
  const messages: string[] = [];
  let currentBody = '';

  for (const line of lines) {
    const candidateBody = currentBody ? `${currentBody}\n${line}` : line;
    const candidate = `${headerText}\n${candidateBody}`;

    if (candidate.length <= maxLength) {
      currentBody = candidateBody;
      continue;
    }

    if (currentBody) {
      messages.push(`${headerText}\n${currentBody}`);
    }

    const singleLineWithHeader = `${headerText}\n${line}`;
    if (singleLineWithHeader.length > maxLength) {
      const available = Math.max(20, maxLength - headerText.length - 1);
      messages.push(`${headerText}\n${line.slice(0, available)}`);
      currentBody = '';
      continue;
    }

    currentBody = line;
  }

  if (currentBody) {
    messages.push(`${headerText}\n${currentBody}`);
  }

  return messages;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' });
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');

  if (!botToken || !chatId) {
    return jsonResponse(500, {
      ok: false,
      error: 'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in Edge Function secrets',
    });
  }

  let payload: IncomingPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: 'Invalid JSON payload' });
  }

  const selectionTarget = payload.selectionTarget;
  const questions = Array.isArray(payload.questions) ? payload.questions : [];

  if (selectionTarget !== 'LIVE_GRATUITA' && selectionTarget !== 'DESPERTOS') {
    return jsonResponse(400, { ok: false, error: 'Invalid selectionTarget' });
  }

  if (questions.length === 0) {
    return jsonResponse(400, { ok: false, error: 'No questions provided' });
  }

  const hasInvalidQuestion = questions.some((q) => !Number.isInteger(q.id) || typeof q.text !== 'string' || q.text.trim() === '');
  if (hasInvalidQuestion) {
    return jsonResponse(400, { ok: false, error: 'Invalid questions payload' });
  }

  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());
  const destinationLabel = getTargetLabel(selectionTarget);

  const headerLines = [
    `Data: ${dateLabel}`,
    `Destino: ${destinationLabel}`,
    `Total de perguntas: ${questions.length}`,
    '',
    'Perguntas selecionadas:',
  ];

  const headerText = headerLines.join('\n');
  const lines = questions.map(normalizeQuestionLine);
  const messages = splitMessages(headerText, lines);

  try {
    for (const text of messages) {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) {
        return jsonResponse(502, {
          ok: false,
          error: data?.description || 'Telegram API error',
        });
      }
    }

    return jsonResponse(200, {
      ok: true,
      messageCount: messages.length,
      destination: destinationLabel,
    });
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});
