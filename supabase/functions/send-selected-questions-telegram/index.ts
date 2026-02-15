import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

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

type TelegramMessage = {
  chat?: { id?: number | string };
  text?: string;
  reply_to_message?: { text?: string };
};

type TelegramUpdate = {
  message?: TelegramMessage;
};

type QuestionSnapshot = {
  id: number;
  author: string;
  text: string;
  previousStatus: string;
  previousVideoUrl: string | null;
  previousAnswer: string | null;
};

type BatchMeta = {
  lotCode: string;
  selectionTarget: SelectionTarget;
  createdAt: string;
  status: 'PENDING' | 'APPLIED' | 'REVERTED';
  youtubeUrl: string | null;
  questionCount: number;
  items: QuestionSnapshot[];
  appliedAt?: string | null;
  appliedByChatId?: string | null;
  revertedAt?: string | null;
  revertedByChatId?: string | null;
};

type BotRoutingConfig = {
  botToken: string;
  operatorChatIds: string[];
  notifyChatIds: string[];
};

const BATCH_BUCKET = 'telegram-bot-batches';
let bucketEnsured = false;

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const parseChatIdList = (raw: string | undefined | null): string[] => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const uniqueList = (items: string[]): string[] => Array.from(new Set(items));

const getTargetLabel = (target: SelectionTarget): string =>
  target === 'LIVE_GRATUITA' ? 'Live Gratuita' : 'Despertos';

const normalizeQuestionLine = (question: { id: number; author?: string; text: string }, index: number): string => {
  const author = question.author?.trim() || 'Anônimo';
  const normalizedText = question.text.replace(/\s+/g, ' ').trim();
  return `${index + 1}. [#${question.id}] ${author}: ${normalizedText}`;
};

const splitMessages = (headerText: string, lines: string[], maxLength = 3800): string[] => {
  const messages: string[] = [];
  let currentBody = '';
  const itemSeparator = '\n\n';

  for (const line of lines) {
    const candidateBody = currentBody ? `${currentBody}${itemSeparator}${line}` : line;
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

const isYoutubeUrl = (text: string): boolean =>
  /https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(text);

const normalizeYoutubeUrl = (raw: string): string => {
  // Remove trailing punctuation commonly added when pasting links in sentences.
  return raw.trim().replace(/[)\],.;!?]+$/g, '');
};

const extractFirstYoutubeUrl = (text: string): string | null => {
  const match = text.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+/i);
  return match?.[0] ? normalizeYoutubeUrl(match[0]) : null;
};

const parseLotIdFromText = (text: string | undefined): string | null => {
  if (!text) return null;
  const match = text.match(/LOTE_ID:\s*([A-Z0-9-]+)/i);
  return match?.[1]?.toUpperCase() || null;
};

const generateLotCode = (): string => {
  const now = new Date();
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const t = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LS-${d}-${t}-${suffix}`;
};

const getBotRoutingConfig = (): BotRoutingConfig => {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
  const fallbackMainChat = Deno.env.get('TELEGRAM_CHAT_ID') || '';
  const operators = parseChatIdList(Deno.env.get('TELEGRAM_OPERATOR_CHAT_IDS'));
  const notifiers = parseChatIdList(Deno.env.get('TELEGRAM_NOTIFY_CHAT_IDS'));

  const operatorChatIds = uniqueList(operators.length > 0 ? operators : (fallbackMainChat ? [fallbackMainChat] : []));
  const notifyChatIds = uniqueList(notifiers);

  return { botToken, operatorChatIds, notifyChatIds };
};

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const sendTelegramMessage = async (botToken: string, chatId: string, text: string): Promise<void> => {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || 'Telegram API error');
  }
};

const broadcastTelegramMessage = async (botToken: string, chatIds: string[], text: string): Promise<void> => {
  for (const chatId of uniqueList(chatIds)) {
    await sendTelegramMessage(botToken, chatId, text);
  }
};

const ensureBucket = async (supabaseAdmin: ReturnType<typeof createAdminClient>): Promise<void> => {
  if (bucketEnsured) return;

  const { data, error } = await supabaseAdmin.storage.getBucket(BATCH_BUCKET);
  if (error || !data) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(BATCH_BUCKET, {
      public: false,
      fileSizeLimit: '2MB',
    });
    if (createError && !createError.message.toLowerCase().includes('already exists')) {
      throw createError;
    }
  }

  bucketEnsured = true;
};

const batchPath = (lotCode: string): string => `by-lot/${lotCode.toUpperCase()}.json`;

const saveBatch = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  batch: BatchMeta,
): Promise<void> => {
  await ensureBucket(supabaseAdmin);
  const payload = new Blob([JSON.stringify(batch)], { type: 'application/json' });
  const { error } = await supabaseAdmin.storage
    .from(BATCH_BUCKET)
    .upload(batchPath(batch.lotCode), payload, {
      contentType: 'application/json',
      upsert: true,
    });

  if (error) throw error;
};

const getBatchByLotCode = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  lotCode: string,
): Promise<BatchMeta | null> => {
  await ensureBucket(supabaseAdmin);
  const { data, error } = await supabaseAdmin.storage.from(BATCH_BUCKET).download(batchPath(lotCode));
  if (error || !data) return null;
  return JSON.parse(await data.text()) as BatchMeta;
};

const listAllBatches = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
): Promise<BatchMeta[]> => {
  await ensureBucket(supabaseAdmin);
  const { data, error } = await supabaseAdmin.storage.from(BATCH_BUCKET).list('by-lot', {
    limit: 1000,
    sortBy: { column: 'name', order: 'desc' },
  });

  if (error || !data) return [];

  const batches: BatchMeta[] = [];
  for (const file of data) {
    if (!file.name.endsWith('.json')) continue;
    const lotCode = file.name.replace('.json', '').toUpperCase();
    const batch = await getBatchByLotCode(supabaseAdmin, lotCode);
    if (batch) batches.push(batch);
  }
  return batches;
};

const getLatestBatch = (
  batches: BatchMeta[],
  predicate: (batch: BatchMeta) => boolean,
): BatchMeta | null => {
  return batches
    .filter(predicate)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
};

const applyBatchYoutube = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  batch: BatchMeta,
  youtubeUrl: string,
  byChatId: string,
): Promise<BatchMeta> => {
  const questionIds = batch.items.map((item) => item.id);
  const { error: updateError } = await supabaseAdmin
    .from('questions')
    .update({
      status: 'ANSWERED',
      video_url: youtubeUrl,
    })
    .in('id', questionIds);

  if (updateError) throw updateError;

  const updated: BatchMeta = {
    ...batch,
    status: 'APPLIED',
    youtubeUrl,
    appliedAt: new Date().toISOString(),
    appliedByChatId: byChatId,
  };

  await saveBatch(supabaseAdmin, updated);
  return updated;
};

const undoBatch = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  batch: BatchMeta,
  byChatId: string,
): Promise<BatchMeta> => {
  for (const item of batch.items) {
    const { error } = await supabaseAdmin
      .from('questions')
      .update({
        status: item.previousStatus,
        video_url: item.previousVideoUrl,
        answer: item.previousAnswer,
      })
      .eq('id', item.id);
    if (error) throw error;
  }

  const updated: BatchMeta = {
    ...batch,
    status: 'REVERTED',
    revertedAt: new Date().toISOString(),
    revertedByChatId: byChatId,
  };

  await saveBatch(supabaseAdmin, updated);
  return updated;
};

const handleAdminDispatch = async (
  payload: IncomingPayload,
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  routing: BotRoutingConfig,
) => {
  const selectionTarget = payload.selectionTarget;
  const questions = Array.isArray(payload.questions) ? payload.questions : [];

  if (selectionTarget !== 'LIVE_GRATUITA' && selectionTarget !== 'DESPERTOS') {
    return jsonResponse(400, { ok: false, error: 'Invalid selectionTarget' });
  }

  if (questions.length === 0) {
    return jsonResponse(400, { ok: false, error: 'No questions provided' });
  }

  const invalid = questions.some((q) => !Number.isInteger(q.id) || typeof q.text !== 'string' || q.text.trim() === '');
  if (invalid) {
    return jsonResponse(400, { ok: false, error: 'Invalid questions payload' });
  }

  const uniqueIds = Array.from(new Set(questions.map((q) => q.id)));
  const { data: dbQuestions, error: dbError } = await supabaseAdmin
    .from('questions')
    .select('id, author, text, status, video_url, answer')
    .in('id', uniqueIds);

  if (dbError) {
    return jsonResponse(500, { ok: false, error: dbError.message });
  }

  const snapshotMap = new Map((dbQuestions || []).map((q: any) => [q.id, q]));
  const missing = uniqueIds.filter((id) => !snapshotMap.has(id));
  if (missing.length > 0) {
    return jsonResponse(400, { ok: false, error: `Questions not found: ${missing.join(', ')}` });
  }

  const lotCode = generateLotCode();
  const batchItems: QuestionSnapshot[] = uniqueIds.map((id) => {
    const q = snapshotMap.get(id) as any;
    return {
      id: q.id,
      author: q.author || 'Anônimo',
      text: q.text,
      previousStatus: q.status,
      previousVideoUrl: q.video_url || null,
      previousAnswer: q.answer || null,
    };
  });

  const batch: BatchMeta = {
    lotCode,
    selectionTarget,
    createdAt: new Date().toISOString(),
    status: 'PENDING',
    youtubeUrl: null,
    questionCount: batchItems.length,
    items: batchItems,
  };

  await saveBatch(supabaseAdmin, batch);

  const dateLabel = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const destinationLabel = getTargetLabel(selectionTarget);

  const headerLines = [
    `Data: ${dateLabel}`,
    `Destino: ${destinationLabel}`,
    `Total de perguntas: ${batchItems.length}`,
    '',
    'Perguntas selecionadas:',
  ];

  const headerText = headerLines.join('\n');
  const lines = batchItems.map((question, index) => normalizeQuestionLine(question, index));
  const messages = splitMessages(headerText, lines);

  const instruction = '\n\nEnvie somente o link do YouTube referente a este lote.';

  for (let i = 0; i < messages.length; i++) {
    const suffix = i === messages.length - 1 ? instruction : '';
    await broadcastTelegramMessage(routing.botToken, routing.operatorChatIds, `${messages[i]}${suffix}`);
  }

  const notifyTargets = routing.notifyChatIds.filter((chatId) => !routing.operatorChatIds.includes(chatId));
  if (notifyTargets.length > 0) {
    const notice = `[AVISO] Novo lote criado\nLOTE_ID: ${lotCode}\nDestino: ${destinationLabel}\nTotal: ${batchItems.length}`;
    await broadcastTelegramMessage(routing.botToken, notifyTargets, notice);
  }

  return jsonResponse(200, {
    ok: true,
    lotCode,
    destination: destinationLabel,
    messageCount: messages.length,
  });
};

const helpText = `Comandos:\n/vincular LOTE_ID <link_youtube>\n/desfazer ultimo\n\nDica: voce tambem pode enviar somente o link do YouTube para aplicar no ultimo lote pendente.`;

const handleTelegramUpdate = async (
  update: TelegramUpdate,
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  routing: BotRoutingConfig,
) => {
  const msg = update.message;
  const chatIdRaw = msg?.chat?.id;
  const chatId = chatIdRaw !== undefined && chatIdRaw !== null ? String(chatIdRaw) : '';
  const text = msg?.text?.trim() || '';

  if (!chatId || !text) {
    return jsonResponse(200, { ok: true, ignored: true });
  }

  if (!routing.operatorChatIds.includes(chatId)) {
    return jsonResponse(200, { ok: true, ignored: true });
  }

  const allBatches = await listAllBatches(supabaseAdmin);

  if (/^\/desfazer\s+ultimo$/i.test(text)) {
    const lastApplied = allBatches
      .filter((batch) => batch.status === 'APPLIED')
      .sort((a, b) => new Date(b.appliedAt || b.createdAt).getTime() - new Date(a.appliedAt || a.createdAt).getTime())[0];

    if (!lastApplied) {
      await sendTelegramMessage(routing.botToken, chatId, 'Nenhum lote aplicado encontrado para desfazer.');
      return jsonResponse(200, { ok: true });
    }

    const reverted = await undoBatch(supabaseAdmin, lastApplied, chatId);
    const done = `Lote ${reverted.lotCode} desfeito com sucesso.\nPerguntas restauradas: ${reverted.questionCount}.`;
    await sendTelegramMessage(routing.botToken, chatId, done);

    const notifyTargets = routing.notifyChatIds.filter((id) => id !== chatId);
    if (notifyTargets.length > 0) {
      await broadcastTelegramMessage(routing.botToken, notifyTargets, `[AVISO] /desfazer ultimo executado\nLOTE_ID: ${reverted.lotCode}\nPor: ${chatId}`);
    }

    return jsonResponse(200, { ok: true, action: 'undo', lotCode: reverted.lotCode });
  }

  const vincular = text.match(/^\/vincular\s+([A-Za-z0-9-]+)\s+(https?:\/\/\S+)/i);

  let lotCode: string | null = null;
  let youtubeUrl: string | null = null;

  if (vincular) {
    lotCode = vincular[1].toUpperCase();
    youtubeUrl = normalizeYoutubeUrl(vincular[2]);
  } else {
    youtubeUrl = extractFirstYoutubeUrl(text);
    if (!youtubeUrl) {
      await sendTelegramMessage(routing.botToken, chatId, `Comando nao reconhecido.\n\n${helpText}`);
      return jsonResponse(200, { ok: true, ignored: true });
    }

    const replyLot = parseLotIdFromText(msg?.reply_to_message?.text);
    if (replyLot) {
      lotCode = replyLot;
    }
  }

  if (!youtubeUrl || !isYoutubeUrl(youtubeUrl)) {
    await sendTelegramMessage(routing.botToken, chatId, 'Link invalido. Envie um link do YouTube valido.');
    return jsonResponse(200, { ok: true, ignored: true });
  }

  let targetBatch: BatchMeta | null = null;

  if (lotCode) {
    targetBatch = await getBatchByLotCode(supabaseAdmin, lotCode);
    if (!targetBatch) {
      await sendTelegramMessage(routing.botToken, chatId, `Nao encontrei o lote ${lotCode}.`);
      return jsonResponse(200, { ok: true, ignored: true });
    }
  } else {
    targetBatch = getLatestBatch(
      allBatches,
      (batch) => batch.status === 'PENDING' && batch.selectionTarget === 'LIVE_GRATUITA',
    );

    if (!targetBatch) {
      await sendTelegramMessage(routing.botToken, chatId, 'Nenhum lote pendente de Live Gratuita encontrado.');
      return jsonResponse(200, { ok: true, ignored: true });
    }
  }

  if (targetBatch.status !== 'PENDING') {
    await sendTelegramMessage(
      routing.botToken,
      chatId,
      `O lote ${targetBatch.lotCode} esta com status ${targetBatch.status}. Use /desfazer ultimo ou outro lote.`,
    );
    return jsonResponse(200, { ok: true, ignored: true });
  }

  const applied = await applyBatchYoutube(supabaseAdmin, targetBatch, youtubeUrl, chatId);

  const success = [
    `Lote ${applied.lotCode} vinculado com sucesso.`,
    `Destino: ${getTargetLabel(applied.selectionTarget)}`,
    `Perguntas atualizadas: ${applied.questionCount}`,
    `Link interpretado: ${youtubeUrl}`,
    `Link: ${youtubeUrl}`,
  ].join('\n');

  await sendTelegramMessage(routing.botToken, chatId, success);

  const notifyTargets = routing.notifyChatIds.filter((id) => id !== chatId);
  if (notifyTargets.length > 0) {
    const notice = `[AVISO] Lote aplicado\nLOTE_ID: ${applied.lotCode}\nPor: ${chatId}\nLink: ${youtubeUrl}`;
    await broadcastTelegramMessage(routing.botToken, notifyTargets, notice);
  }

  return jsonResponse(200, {
    ok: true,
    action: 'apply',
    lotCode: applied.lotCode,
  });
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' });
  }

  const routing = getBotRoutingConfig();
  if (!routing.botToken || routing.operatorChatIds.length === 0) {
    return jsonResponse(500, {
      ok: false,
      error: 'Missing TELEGRAM_BOT_TOKEN and/or operator chat ids',
    });
  }

  const supabaseAdmin = createAdminClient();

  try {
    const body = await req.json();

    if (body?.message?.chat?.id) {
      return await handleTelegramUpdate(body as TelegramUpdate, supabaseAdmin, routing);
    }

    return await handleAdminDispatch(body as IncomingPayload, supabaseAdmin, routing);
  } catch (error) {
    console.error(error);
    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});
