import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handleAssistChat,
  handleAssistFeedback,
  getAssistConversations,
  getConversationMessages,
  resolveUnansweredQuestion,
  getAssistStats
} from '../src/api/controllers/assist.controller.js';

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://paradigm-ifs-4.vercel.app',
  'https://www.paradigm-ifs-4.vercel.app',
  'capacitor://localhost',
  'http://localhost'
];

export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query.action as string) || (req.body?.action as string) || 'chat';

  // Adapt express controller to Vercel
  const expressReq = req as any;
  const expressRes = res as any;

  switch (action) {
    case 'chat':
      return handleAssistChat(expressReq, expressRes);
    case 'feedback':
      return handleAssistFeedback(expressReq, expressRes);
    case 'conversations':
      return getAssistConversations(expressReq, expressRes);
    case 'conversation_messages':
      return getConversationMessages(expressReq, expressRes);
    case 'resolve_unanswered':
      return resolveUnansweredQuestion(expressReq, expressRes);
    case 'stats':
      return getAssistStats(expressReq, expressRes);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
