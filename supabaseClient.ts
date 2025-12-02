import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase baseada nas informações fornecidas
// Nota: Em produção, nunca exponha a chave privada (secret/service_role) no frontend.
// Estamos usando a URL baseada no ID do projeto e a chave pública para conexão.

const PROJECT_ID = 'lvxbqwqpehpupsgfpcoe';
const SUPABASE_URL = `https://${PROJECT_ID}.supabase.co`;
const SUPABASE_ANON_KEY = 'sb_publishable_5RqhL_FqwAcahRs--YviiQ_I-IOrd3w';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
