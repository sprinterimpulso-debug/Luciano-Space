<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/15lKMAjKSVxDWxOWuBLY8D3VfZ-2_zFVO

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Telegram (Admin) via Supabase Edge Function

Para manter o token do bot fora do frontend, o envio de perguntas selecionadas no admin usa a funcao:

- `supabase/functions/send-selected-questions-telegram/index.ts`

### Setup (uma vez por projeto Supabase)

1. Fazer login na CLI:
   `supabase login`
2. Linkar o projeto:
   `supabase link --project-ref lvxbqwqpehpupsgfpcoe`
3. Definir secrets da funcao (nao versionar token):
   `supabase secrets set TELEGRAM_BOT_TOKEN=seu_token TELEGRAM_CHAT_ID=seu_chat_id`
4. Deploy da funcao:
   `supabase functions deploy send-selected-questions-telegram`

Depois disso, o botao de envio no `#admin` chama essa funcao e dispara para o Telegram.

## Migracao de propriedade (Vercel + Supabase proprio)

1. Criar um novo projeto Supabase na sua conta.
2. Rodar o SQL/schema da tabela `questions` no novo projeto.
3. Importar backup local:
   `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-questions.mjs`
4. Ajustar `.env.local` com o novo `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
5. Publicar o frontend no Vercel (novo link) e atualizar seu redirect `lucianocesa.com.br/space`.

O arquivo de backup fica em:
- `backups/questions-backup-*.json`
- `backups/questions-backup-*.csv`
