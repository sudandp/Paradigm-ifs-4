/** Test-only harness: mounts the REAL /api/paradigm-assist route (same dispatch as src/server.ts) WITHOUT the boot
 *  jobs (HRM automation / job scheduler) that write to the production DB. Usage: PORT=3101 npx tsx scripts/_assist-http-server.ts */
import * as dotenv from 'dotenv';
dotenv.config(); dotenv.config({ path: '.env.local', override: true });
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
const { handleAssistChat, handleAssistFeedback, getAssistConversations, getConversationMessages, deleteAssistConversation } = await import('../src/api/controllers/assist.controller.js') as any;
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json({ limit: '10mb' }));
app.post('/api/paradigm-assist', (req, res) => {
  const action = (req.query.action as string) || req.body?.action || 'chat';
  switch (action) {
    case 'chat': return handleAssistChat(req, res);
    case 'feedback': return handleAssistFeedback(req, res);
    case 'conversations': return getAssistConversations(req, res);
    case 'conversation_messages': return getConversationMessages(req, res);
    case 'delete_conversation': return deleteAssistConversation(req, res);
    default: return handleAssistChat(req, res);
  }
});
app.listen(Number(process.env.PORT || 3101), '127.0.0.1', () => console.log('Server running on port ' + process.env.PORT));
