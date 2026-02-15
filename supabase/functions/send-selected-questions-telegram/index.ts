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

type PremiumCheckPayload = {
  action: 'CHECK_PREMIUM_ACCESS';
  email: string;
  questionId?: number;
  questionStatus?: string;
  questionAuthor?: string;
};

type TelegramMessage = {
  chat?: { id?: number | string };
  text?: string;
};

type TelegramUpdate = {
  update_id?: number;
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
  deaBotToken: string;
  deaGroupChatId: string;
  deaCarlaChatId: string;
  deaBroadcastEnabled: boolean;
  platformUrl: string;
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
  target === 'LIVE_GRATUITA' ? 'Conteúdo Gratuito' : 'Despertos';

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

const normalizeYoutubeUrl = (raw: string): string => raw.trim().replace(/[)\],.;!?]+$/g, '');

const extractFirstYoutubeUrl = (text: string): string | null => {
  const match = text.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+/i);
  return match?.[0] ? normalizeYoutubeUrl(match[0]) : null;
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

  return {
    botToken,
    operatorChatIds: uniqueList(operators.length > 0 ? operators : (fallbackMainChat ? [fallbackMainChat] : [])),
    notifyChatIds: uniqueList(notifiers),
    deaBotToken: Deno.env.get('TELEGRAM_DEA_BOT_TOKEN') || '',
    deaGroupChatId: Deno.env.get('TELEGRAM_DEA_GROUP_CHAT_ID') || '',
    deaCarlaChatId: Deno.env.get('TELEGRAM_DEA_CARLA_CHAT_ID') || '',
    deaBroadcastEnabled: (Deno.env.get('DEA_BROADCAST_ENABLED') || 'false').toLowerCase() === 'true',
    platformUrl: Deno.env.get('TELEGRAM_PLATFORM_URL') || 'https://lucianocesa.com.br/space',
  };
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
    if (createError && !createError.message.toLowerCase().includes('already exists')) throw createError;
  }

  bucketEnsured = true;
};

const batchPath = (lotCode: string): string => `by-lot/${lotCode.toUpperCase()}.json`;
const processedUpdatePath = (updateId: number): string => `processed-updates/${updateId}.txt`;
const premiumLeadPath = (isoDate: string, recordId: string): string => `premium-leads/${isoDate}/${recordId}.json`;

const saveBatch = async (supabaseAdmin: ReturnType<typeof createAdminClient>, batch: BatchMeta): Promise<void> => {
  await ensureBucket(supabaseAdmin);
  const payload = new Blob([JSON.stringify(batch)], { type: 'application/json' });
  const { error } = await supabaseAdmin.storage.from(BATCH_BUCKET).upload(batchPath(batch.lotCode), payload, {
    contentType: 'application/json',
    upsert: true,
  });
  if (error) throw error;
};

const getBatchByLotCode = async (supabaseAdmin: ReturnType<typeof createAdminClient>, lotCode: string): Promise<BatchMeta | null> => {
  await ensureBucket(supabaseAdmin);
  const { data, error } = await supabaseAdmin.storage.from(BATCH_BUCKET).download(batchPath(lotCode));
  if (error || !data) return null;
  return JSON.parse(await data.text()) as BatchMeta;
};

const listAllBatches = async (supabaseAdmin: ReturnType<typeof createAdminClient>): Promise<BatchMeta[]> => {
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

const markTelegramUpdateProcessed = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  updateId: number,
): Promise<boolean> => {
  await ensureBucket(supabaseAdmin);
  const payload = new Blob([new Date().toISOString()], { type: 'text/plain' });
  const { error } = await supabaseAdmin.storage.from(BATCH_BUCKET).upload(processedUpdatePath(updateId), payload, {
    contentType: 'text/plain',
    upsert: false,
  });

  if (!error) return true;

  const msg = error.message.toLowerCase();
  if (msg.includes('already exists') || msg.includes('duplicate')) {
    return false;
  }

  throw error;
};

type LeadProfile = {
  name: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
  phone: string | null;
  memberStatus: string | null;
};

const parseLeadProfile = (data: Record<string, unknown> | null | undefined): LeadProfile => ({
  name: typeof data?.name === 'string' ? data.name : null,
  telegramId: typeof data?.telegram_id === 'string'
      ? data.telegram_id
      : typeof data?.telegramId === 'string'
      ? data.telegramId
      : null,
  telegramUsername: typeof data?.telegram_username === 'string'
      ? data.telegram_username
      : typeof data?.telegramUsername === 'string'
      ? data.telegramUsername
      : null,
  phone: typeof data?.phone === 'string' ? data.phone : null,
  memberStatus: typeof data?.status === 'string'
      ? data.status
      : typeof data?.member_status === 'string'
      ? data.member_status
      : null,
});

const persistPremiumLead = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  record: Record<string, unknown>,
): Promise<void> => {
  const timestamp = new Date();
  const dateKey = timestamp.toISOString().slice(0, 10);
  const recordId = `${timestamp.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  await ensureBucket(supabaseAdmin);
  const payload = new Blob([JSON.stringify(record)], { type: 'application/json' });
  await supabaseAdmin.storage.from(BATCH_BUCKET).upload(premiumLeadPath(dateKey, recordId), payload, {
    contentType: 'application/json',
    upsert: false,
  });
};

const pushPremiumLeadToSheetWebhook = async (record: Record<string, unknown>): Promise<void> => {
  const webhookUrl = Deno.env.get('PREMIUM_LEADS_WEBHOOK_URL') || '';
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
  } catch (error) {
    console.error('Erro ao enviar lead para webhook da planilha:', error);
  }
};

const getLatestBatch = (batches: BatchMeta[], predicate: (batch: BatchMeta) => boolean): BatchMeta | null => {
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
  const nextStatus = batch.selectionTarget === 'LIVE_GRATUITA' ? 'ANSWERED' : 'PREMIUM';

  const { error: updateError } = await supabaseAdmin
    .from('questions')
    .update({
      status: nextStatus,
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

const notifyDespertosGroup = async (routing: BotRoutingConfig, youtubeUrl: string): Promise<void> => {
  if (!routing.deaBroadcastEnabled || !routing.deaBotToken) return;

  const groupText = [
    'Despertos da Era de Aquario ✨',
    '',
    'Aqui estao as respostas exclusivas para as perguntas do Luciano Space.',
    `Video: ${youtubeUrl}`,
    '',
    `Se voce ainda nao conhece a plataforma, ou quer deixar sua duvida para ser respondida: ${routing.platformUrl}`,
  ].join('\n');

  if (routing.deaGroupChatId) {
    await sendTelegramMessage(routing.deaBotToken, routing.deaGroupChatId, groupText);
  }

  if (routing.deaCarlaChatId) {
    const carlaText = [
      'Aviso para equipe:',
      'Subir na Kiwify no modulo Perguntas e Respostas - Luciano Space.',
      `Link do video Despertos: ${youtubeUrl}`,
    ].join('\n');
    await sendTelegramMessage(routing.deaBotToken, routing.deaCarlaChatId, carlaText);
  }
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

  if (dbError) return jsonResponse(500, { ok: false, error: dbError.message });

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

  const instruction = selectionTarget === 'LIVE_GRATUITA'
    ? '\n\nEnvie: /publico <e o link do youtube referente às respostas deste lote>'
    : '\n\nEnvie: /dea <e o link do youtube no modo não-listado referente às respostas deste lote>';

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

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const checkDespertosAccess = async (
  payload: PremiumCheckPayload,
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  req: Request,
) => {
  const email = payload.email.trim().toLowerCase();
  if (!isValidEmail(email)) {
    return jsonResponse(400, { ok: false, error: 'Email invalido' });
  }

  let allowed = false;
  let source = 'env_list';
  let profile: LeadProfile = {
    name: null,
    telegramId: null,
    telegramUsername: null,
    phone: null,
    memberStatus: null,
  };

  const allowAll = (Deno.env.get('DESPERTOS_ALLOW_ALL') || '').toLowerCase() === 'true';
  if (allowAll) {
    allowed = true;
    source = 'allow_all';
  } else {
    const webhook = Deno.env.get('DESPERTOS_VALIDATION_WEBHOOK_URL') || '';
    if (webhook) {
      try {
        const response = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await response.json();
        allowed = Boolean(data?.active);
        source = 'webhook';
        profile = parseLeadProfile(data);
      } catch {
        allowed = false;
        source = 'webhook_error';
      }
    } else {
      const allowedEmails = parseChatIdList(Deno.env.get('DESPERTOS_ACTIVE_EMAILS')).map((item) => item.toLowerCase());
      allowed = allowedEmails.includes(email);
      source = 'env_list';
    }
  }

  const leadRecord: Record<string, unknown> = {
    createdAt: new Date().toISOString(),
    email,
    allowed,
    source,
    questionId: payload.questionId ?? null,
    questionStatus: payload.questionStatus ?? null,
    questionAuthor: payload.questionAuthor ?? null,
    name: profile.name,
    telegramId: profile.telegramId,
    telegramUsername: profile.telegramUsername,
    phone: profile.phone,
    memberStatus: profile.memberStatus ?? (allowed ? 'ativo' : 'inativo'),
    userAgent: req.headers.get('user-agent') || null,
    ip: req.headers.get('x-forwarded-for') || null,
  };

  try {
    await persistPremiumLead(supabaseAdmin, leadRecord);
    await pushPremiumLeadToSheetWebhook(leadRecord);
  } catch (error) {
    console.error('Erro ao registrar lead de acesso premium:', error);
  }

  return jsonResponse(200, {
    ok: true,
    allowed,
    source,
    leadRecorded: true,
    profile: {
      name: profile.name,
      telegramId: profile.telegramId,
      telegramUsername: profile.telegramUsername,
      phone: profile.phone,
      memberStatus: profile.memberStatus,
    },
  });
};

const helpText = [
  'Comandos disponiveis:',
  '/publico <link_youtube> -> aplica no ultimo lote pendente de Conteúdo Gratuito',
  '/dea <link_youtube>   -> aplica no ultimo lote pendente de Despertos',
  '/desfazer ultimo publico -> desfaz o ultimo lote aplicado de Conteúdo Gratuito',
  '/desfazer ultimo dea     -> desfaz o ultimo lote aplicado de Despertos',
  '',
  'Dica: mandar somente um link do YouTube aplica no ultimo lote pendente de Conteúdo Gratuito.',
].join('\n');

const handleTelegramUpdate = async (
  update: TelegramUpdate,
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  routing: BotRoutingConfig,
) => {
  const msg = update.message;
  const chatIdRaw = msg?.chat?.id;
  const chatId = chatIdRaw !== undefined && chatIdRaw !== null ? String(chatIdRaw) : '';
  const text = msg?.text?.trim() || '';

  if (!chatId || !text) return jsonResponse(200, { ok: true, ignored: true });
  if (!routing.operatorChatIds.includes(chatId)) return jsonResponse(200, { ok: true, ignored: true });

  if (typeof update.update_id === 'number') {
    const firstProcess = await markTelegramUpdateProcessed(supabaseAdmin, update.update_id);
    if (!firstProcess) {
      return jsonResponse(200, { ok: true, duplicate: true, ignored: true });
    }
  }

  const allBatches = await listAllBatches(supabaseAdmin);

  const undoLegacyCmd = /^\/desfazer\s+ultimo$/i.test(text);
  const undoScopedCmd = text.match(/^\/desfazer\s+ultimo\s+(dea|publico|live)$/i);

  if (undoLegacyCmd) {
    await sendTelegramMessage(
      routing.botToken,
      chatId,
      'Agora o desfazer exige destino.\nUse:\n/desfazer ultimo publico\n/desfazer ultimo dea',
    );
    return jsonResponse(200, { ok: true, ignored: true });
  }

  if (undoScopedCmd) {
    const scope = undoScopedCmd[1].toLowerCase();
    const undoTarget: SelectionTarget = scope === 'dea' ? 'DESPERTOS' : 'LIVE_GRATUITA';
    const lastApplied = allBatches
      .filter((batch) => batch.status === 'APPLIED' && batch.selectionTarget === undoTarget)
      .sort((a, b) => new Date(b.appliedAt || b.createdAt).getTime() - new Date(a.appliedAt || a.createdAt).getTime())[0];

    if (!lastApplied) {
      await sendTelegramMessage(
        routing.botToken,
        chatId,
        `Nenhum lote aplicado de ${getTargetLabel(undoTarget)} encontrado para desfazer.`,
      );
      return jsonResponse(200, { ok: true });
    }

    const reverted = await undoBatch(supabaseAdmin, lastApplied, chatId);
    await sendTelegramMessage(
      routing.botToken,
      chatId,
      `Lote ${reverted.lotCode} (${getTargetLabel(undoTarget)}) desfeito com sucesso.\nPerguntas restauradas: ${reverted.questionCount}.`,
    );

    const notifyTargets = routing.notifyChatIds.filter((id) => id !== chatId);
    if (notifyTargets.length > 0) {
      await broadcastTelegramMessage(
        routing.botToken,
        notifyTargets,
        `[AVISO] /desfazer ultimo ${scope} executado\nLOTE_ID: ${reverted.lotCode}\nDestino: ${getTargetLabel(undoTarget)}\nPor: ${chatId}`,
      );
    }

    return jsonResponse(200, { ok: true, action: 'undo', lotCode: reverted.lotCode });
  }

  const cmdPublico = text.match(/^\/publico\s+(https?:\/\/\S+)/i);
  const cmdLive = text.match(/^\/live\s+(https?:\/\/\S+)/i);
  const cmdDea = text.match(/^\/dea\s+(https?:\/\/\S+)/i);
  const cmdVincular = text.match(/^\/vincular\s+([A-Za-z0-9-]+)\s+(https?:\/\/\S+)/i);

  let youtubeUrl: string | null = null;
  let requestedTarget: SelectionTarget | null = null;
  let lotCode: string | null = null;

  if (cmdPublico) {
    youtubeUrl = normalizeYoutubeUrl(cmdPublico[1]);
    requestedTarget = 'LIVE_GRATUITA';
  } else if (cmdLive) {
    // Backward compatibility for operators already acostumados com /live.
    youtubeUrl = normalizeYoutubeUrl(cmdLive[1]);
    requestedTarget = 'LIVE_GRATUITA';
  } else if (cmdDea) {
    youtubeUrl = normalizeYoutubeUrl(cmdDea[1]);
    requestedTarget = 'DESPERTOS';
  } else if (cmdVincular) {
    lotCode = cmdVincular[1].toUpperCase();
    youtubeUrl = normalizeYoutubeUrl(cmdVincular[2]);
  } else {
    youtubeUrl = extractFirstYoutubeUrl(text);
    requestedTarget = 'LIVE_GRATUITA';
  }

  if (!youtubeUrl || !isYoutubeUrl(youtubeUrl)) {
    await sendTelegramMessage(routing.botToken, chatId, `Nao consegui identificar um link valido do YouTube.\n\n${helpText}`);
    return jsonResponse(200, { ok: true, ignored: true });
  }

  let targetBatch: BatchMeta | null = null;

  if (lotCode) {
    targetBatch = await getBatchByLotCode(supabaseAdmin, lotCode);
    if (!targetBatch) {
      await sendTelegramMessage(routing.botToken, chatId, `Nao encontrei o lote ${lotCode}.`);
      return jsonResponse(200, { ok: true, ignored: true });
    }
  } else if (requestedTarget) {
    targetBatch = getLatestBatch(
      allBatches,
      (batch) => batch.status === 'PENDING' && batch.selectionTarget === requestedTarget,
    );

    if (!targetBatch) {
      await sendTelegramMessage(routing.botToken, chatId, `Nenhum lote pendente de ${getTargetLabel(requestedTarget)} encontrado.`);
      return jsonResponse(200, { ok: true, ignored: true });
    }
  }

  if (!targetBatch) {
    await sendTelegramMessage(routing.botToken, chatId, helpText);
    return jsonResponse(200, { ok: true, ignored: true });
  }

  if (targetBatch.status !== 'PENDING') {
    await sendTelegramMessage(routing.botToken, chatId, `O lote ${targetBatch.lotCode} esta com status ${targetBatch.status}.`);
    return jsonResponse(200, { ok: true, ignored: true });
  }

  const applied = await applyBatchYoutube(supabaseAdmin, targetBatch, youtubeUrl, chatId);

  const success = [
    `${getTargetLabel(applied.selectionTarget)} aplicado com sucesso.`,
    `Perguntas atualizadas: ${applied.questionCount}`,
    `Link das respostas: ${youtubeUrl}`,
  ].join('\n');

  await sendTelegramMessage(routing.botToken, chatId, success);

  const notifyTargets = routing.notifyChatIds.filter((id) => id !== chatId);
  if (notifyTargets.length > 0) {
    const notice = `[AVISO] Lote aplicado\nLOTE_ID: ${applied.lotCode}\nDestino: ${getTargetLabel(applied.selectionTarget)}\nPor: ${chatId}\nLink: ${youtubeUrl}`;
    await broadcastTelegramMessage(routing.botToken, notifyTargets, notice);
  }

  if (applied.selectionTarget === 'DESPERTOS') {
    await notifyDespertosGroup(routing, youtubeUrl);
  }

  return jsonResponse(200, { ok: true, action: 'apply', lotCode: applied.lotCode });
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { ok: false, error: 'Method not allowed' });

  const routing = getBotRoutingConfig();
  if (!routing.botToken || routing.operatorChatIds.length === 0) {
    return jsonResponse(500, { ok: false, error: 'Missing TELEGRAM_BOT_TOKEN and/or operator chat ids' });
  }

  const supabaseAdmin = createAdminClient();

  try {
    const body = await req.json();

    if (body?.action === 'CHECK_PREMIUM_ACCESS') {
      return await checkDespertosAccess(body as PremiumCheckPayload, supabaseAdmin, req);
    }

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
