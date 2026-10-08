import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

// Initialize elevated service-role Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// ============================================================================
// HINGLISH & REGIONAL VOCABULARY NORMALIZATION
// ============================================================================
const REGIONAL_TERMS: Record<string, string[]> = {
  water: ['paani', 'neeru', 'neellu', 'water', 'wtp', 'stp', 'tanki', 'tank', 'borewell', 'sump', 'motor', 'pump'],
  fire: ['aag', 'benki', 'manta', 'fire', 'smoke', 'dhuan', 'blaze', 'extinguisher', 'flame'],
  electricity: ['bijli', 'current', 'power', 'dg', 'diesel generator', 'transformer', 'ups', 'mcb', 'breaker', 'shock'],
  lift: ['lift', 'elevator', 'athava', 'stuck', 'phas gaya', 'trap', 'trapped', 'emergency alarm'],
  housekeeping: ['safai', 'kachra', 'cleaning', 'dusting', 'mop', 'garbage', 'waste', 'housekeeping', 'hk'],
  leave: ['chutti', 'leave', 'hafta', 'weekly off', 'sick leave', 'earned leave', 'holiday', 'absent', 'comp off'],
  salary: ['vetan', 'tankhah', 'paisa', 'salary', 'payment', 'payslip', 'wages', 'overtime', 'ot'],
  roster: ['roster', 'duty', 'shift', 'timing', 'schedule', 'attendance', 'kaam', 'kelsa', 'panulu'],
  escalation: ['contact', 'phone', 'number', 'call', 'manager', 'supervisor', 'escalate', 'complaint', 'nodal', 'helpdesk']
};

export function expandRegionalQuery(query: string): string {
  const lower = query.toLowerCase();
  const tokens = lower.split(/[\s,?.!-]+/);
  const expansions: Set<string> = new Set();

  for (const token of tokens) {
    if (!token) continue;
    for (const [concept, aliases] of Object.entries(REGIONAL_TERMS)) {
      if (aliases.includes(token)) {
        expansions.add(concept);
      }
    }
  }

  if (expansions.size > 0) {
    return `${query} (Keywords: ${Array.from(expansions).join(', ')})`;
  }
  return query;
}

// ============================================================================
// DETERMINISTIC EMERGENCY CLASSIFIER (P0 ZERO-HALLUCINATION)
// ============================================================================
interface EmergencyMatch {
  isEmergency: boolean;
  type: 'FIRE' | 'GAS_LEAK' | 'LIFT_TRAP' | 'ELECTRICAL_SHOCK' | 'CHEMICAL_SPILL' | 'MEDICAL' | 'GENERAL' | null;
  title: string;
  immediateActions: string[];
}

export function detectEmergency(query: string): EmergencyMatch {
  const q = query.toLowerCase();

  // 1. Fire / Smoke
  if (/\b(fire|smoke|aag|benki|manta|flame|fire alarm|drench|sprinkler|burning smell)\b/i.test(q)) {
    return {
      isEmergency: true,
      type: 'FIRE',
      title: '🚨 FIRE / SMOKE EMERGENCY PROTOCOL',
      immediateActions: [
        '1. Sound the manual call point / fire alarm immediately.',
        '2. Evacuate people through nearest fire staircase (NEVER use lifts).',
        '3. If safe and trained, deploy CO2 / ABC Dry Powder fire extinguisher.',
        '4. Dial Fire Emergency 101 and contact Site Facility Manager + Director on Duty.',
        '5. Cut off main electrical breaker and LPG supply lines to affected zone.'
      ]
    };
  }

  // 2. Gas Leak
  if (/\b(gas leak|lpg|gas smell|cylinder blast|gas pipe|pipeline leak|gas cylinder)\b/i.test(q)) {
    return {
      isEmergency: true,
      type: 'GAS_LEAK',
      title: '⚠️ CRITICAL LPG / GAS LEAK PROTOCOL',
      immediateActions: [
        '1. DO NOT touch electrical switches, mobile phones, or matchsticks in the area.',
        '2. Open all doors and windows for maximum cross ventilation.',
        '3. Turn OFF the main gas bank cylinder manifold valves immediately.',
        '4. Evacuate all residents/staff 100 meters away upwind.',
        '5. Call Site MEP Supervisor and Gas Vendor Emergency Hotline immediately.'
      ]
    };
  }

  // 3. Lift / Elevator Trap
  if (/\b(lift stuck|lift trap|elevator stuck|lift not opening|person inside lift|trapped in lift|lift failure|stuck in elevator)\b/i.test(q)) {
    return {
      isEmergency: true,
      type: 'LIFT_TRAP',
      title: '🛗 LIFT PASSENGER ENTRAPMENT PROTOCOL',
      immediateActions: [
        '1. Talk to trapped passengers through the intercom: assure them they are safe and ventilation is active.',
        '2. Locate the lift cabin position on the floor indicator / machine room.',
        '3. Turn OFF the main electrical isolator for that lift before manual rescue.',
        '4. Apply manual brake release tool slowly to level cabin with nearest floor.',
        '5. Use landing door key to open doors and safely extract passengers. Call Lift AMC vendor.'
      ]
    };
  }

  // 4. Electrical Shock / Arc Flash
  if (/\b(electric shock|electrocution|sparking|short circuit|transformer fire|panel fire|current shock|bijli shock|shock laga)\b/i.test(q)) {
    return {
      isEmergency: true,
      type: 'ELECTRICAL_SHOCK',
      title: '⚡ ELECTRICAL SHOCK & HAZARD PROTOCOL',
      immediateActions: [
        '1. DO NOT touch the victim with bare hands if still in contact with electrical source.',
        '2. Trip the main incomer circuit breaker (ACB/MCCB) immediately.',
        '3. Separate victim using a dry non-conductive object (dry wooden stick, PVC pipe).',
        '4. Check breathing and pulse. If unconscious, initiate CPR immediately.',
        '5. Dial 108 / Ambulance and contact Site Technical Executive immediately.'
      ]
    };
  }

  // 5. Chemical / Chlorine / STP Hazard
  if (/\b(chemical spill|acid spill|chlorine leak|chlorine gas|stp overflow|wtp burst|sludge overflow)\b/i.test(q)) {
    return {
      isEmergency: true,
      type: 'CHEMICAL_SPILL',
      title: '☣️ HAZARDOUS CHEMICAL / STP EMERGENCY PROTOCOL',
      immediateActions: [
        '1. Don full PPE (Chemical respirator, nitrile gloves, gumboots, safety goggles).',
        '2. In case of chlorine gas, move upwind and evacuate basement/enclosed spaces.',
        '3. Shut down feed dosing pumps and isolate raw sewage/chemical supply.',
        '4. Deploy spill containment kit (sand/neutralizing agent) around drains.',
        '5. Notify Water Management SME and Site Operations Manager immediately.'
      ]
    };
  }

  // 6. Medical Emergency
  if (/\b(unconscious|cardiac|heart attack|snake bite|heavy bleeding|injury|ambulance|medical emergency)\b/i.test(q)) {
    return {
      isEmergency: true,
      type: 'MEDICAL',
      title: '🚑 CRITICAL MEDICAL EMERGENCY PROTOCOL',
      immediateActions: [
        '1. Call Emergency Ambulance at 108 / local hospital emergency desk immediately.',
        '2. Alert Site Security to clear entrance boom barriers and guide ambulance to spot.',
        '3. Retrieve Site First Aid Box & AED (Automated External Defibrillator) if available.',
        '4. Keep victim calm, still, and do not administer oral liquids if semi-conscious.',
        '5. Notify Site Facility Manager and resident/employee emergency contact.'
      ]
    };
  }

  return { isEmergency: false, type: null, title: '', immediateActions: [] };
}

// ============================================================================
// MAIN PIPELINE HANDLER
// ============================================================================
export async function handleAssistChat(req: Request, res: Response) {
  const startTime = Date.now();

  try {
    // 1. Authenticate Request
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(403).json({ error: 'Unauthorized or expired token' });
    }

    const {
      conversationId,
      query,
      siteId,
      history = []
    } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Query string is required' });
    }

    const trimmedQuery = query.trim();

    // 2. Fetch User Profile & Default Site Context
    let siteName = 'All Paradigm Sites';
    let siteCity: string | null = null;
    let effectiveSiteId = siteId || null;

    try {
      const { data: userProfile } = await supabase
        .from('users')
        .select('id, name, role_id, location_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!effectiveSiteId && userProfile?.location_id) {
        effectiveSiteId = userProfile.location_id;
      }

      if (effectiveSiteId) {
        const { data: loc } = await supabase
          .from('locations')
          .select('id, name, address')
          .eq('id', effectiveSiteId)
          .maybeSingle();
        if (loc) {
          siteName = loc.name;
          if (loc.address) {
            if (/bengaluru|bangalore/i.test(loc.address)) siteCity = 'Bengaluru';
            else if (/hyderabad/i.test(loc.address)) siteCity = 'Hyderabad';
            else if (/pune/i.test(loc.address)) siteCity = 'Pune';
          }
        }
      }
    } catch (profileErr) {
      console.warn('[Assist] User/Location lookup fallback:', profileErr);
    }

    // 3. Resolve or Create Conversation
    let activeConvId = conversationId;
    if (!activeConvId) {
      const { data: newConv, error: convErr } = await supabase
        .from('assist_conversations')
        .insert({
          user_id: user.id,
          title: trimmedQuery.slice(0, 60),
          site_id: effectiveSiteId
        })
        .select('id')
        .single();
      if (!convErr && newConv) {
        activeConvId = newConv.id;
      }
    }

    // Log User Message
    let userMsgId: string | null = null;
    if (activeConvId) {
      const { data: uMsg } = await supabase
        .from('assist_messages')
        .insert({
          conversation_id: activeConvId,
          sender: 'user',
          content: trimmedQuery
        })
        .select('id')
        .single();
      if (uMsg) userMsgId = uMsg.id;
    }

    // 4. Check Deterministic Emergency Bypass
    const emergency = detectEmergency(trimmedQuery);
    if (emergency.isEmergency) {
      // Query escalation matrix contacts for site / HQ
      let escQuery = supabase
        .from('escalation_matrix')
        .select('*')
        .order('display_order', { ascending: true })
        .limit(6);

      if (effectiveSiteId) {
        escQuery = escQuery.or(`site_id.eq.${effectiveSiteId},site_id.is.null`);
      }

      const { data: escContacts } = await escQuery;

      // Query on-duty staff if site is known
      let staffMembers: any[] = [];
      if (effectiveSiteId) {
        const { data: staff } = await supabase
          .from('site_staff_members')
          .select('full_name, designation, phone, shift_type')
          .eq('site_id', effectiveSiteId)
          .eq('is_active', true)
          .limit(5);
        if (staff) staffMembers = staff;
      }

      // Format Emergency Response
      let contactList = '';
      if (escContacts && escContacts.length > 0) {
        contactList = escContacts.map(c => 
          `• **${c.role_name} (${c.level})**: ${c.contact_person} — 📞 [${c.phone}](tel:${c.phone}) (TAT: ${c.tat_minutes} mins)`
        ).join('\n');
      } else {
        contactList = '• **Head Office 24x7 Emergency Desk**: 📞 [+91 80 4114 2666](tel:+918041142666)\n• **Operations Director**: 📞 [+91 98450 12345](tel:+919845012345)';
      }

      let staffList = '';
      if (staffMembers.length > 0) {
        staffList = '\n\n**On-Site Responders:**\n' + staffMembers.map(s => 
          `• ${s.full_name} (${s.designation}): 📞 [${s.phone}](tel:${s.phone}) [Shift: ${s.shift_type}]`
        ).join('\n');
      }

      const emergencyReply = `### ${emergency.title}\n\n**Immediate Safety Actions:**\n${emergency.immediateActions.join('\n')}\n\n**Emergency Escalation Contacts:**\n${contactList}${staffList}\n\n*Notice: This is a critical life-safety protocol. Execute containment steps immediately and alert emergency services.*`;

      const latencyMs = Date.now() - startTime;

      if (activeConvId) {
        await supabase.from('assist_messages').insert({
          conversation_id: activeConvId,
          sender: 'assistant',
          content: emergencyReply,
          confidence: 1.0,
          latency_ms: latencyMs,
          sources: [{ title: 'Emergency Escalation Protocol', type: 'emergency', score: 1.0 }]
        });
      }

      return res.status(200).json({
        conversationId: activeConvId,
        message: emergencyReply,
        isEmergency: true,
        emergencyType: emergency.type,
        confidence: 1.0,
        sources: [{ title: emergency.title, type: 'emergency' }],
        latencyMs
      });
    }

    // 5. Hybrid Knowledge Retrieval
    // Use clean natural query for database search so FTS/Trigram accurately match
    const { data: searchResults, error: rpcError } = await supabase.rpc('search_knowledge_base', {
      query_text: trimmedQuery,
      query_embedding: null,
      filter_site_id: effectiveSiteId,
      filter_city: siteCity,
      match_count: 6
    });

    if (rpcError) {
      console.warn('[Assist] search_knowledge_base RPC error:', rpcError.message);
    }

    // Also fetch relevant staff directory if query asks about staff, phone, roster, shift
    let staffContext: any[] = [];
    if (/\b(staff|roster|duty|shift|phone|number|supervisor|electrician|plumber|manager|technician|who is|contact)\b/i.test(trimmedQuery)) {
      let stfQuery = supabase
        .from('site_staff_members')
        .select('full_name, designation, department, phone, shift_type, reporting_manager_name')
        .eq('is_active', true)
        .limit(8);
      if (effectiveSiteId) {
        stfQuery = stfQuery.eq('site_id', effectiveSiteId);
      }
      const { data: stf } = await stfQuery;
      if (stf) staffContext = stf;
    }

    // Also fetch escalation matrix if query asks about escalation or complaint
    let escContext: any[] = [];
    if (/\b(escalat|complaint|emergency|helpline|nodal|l1|l2|l3|tat)\b/i.test(trimmedQuery)) {
      let eq = supabase
        .from('escalation_matrix')
        .select('role_name, contact_person, phone, email, tat_minutes, level, escalation_trigger')
        .order('display_order', { ascending: true })
        .limit(6);
      if (effectiveSiteId) {
        eq = eq.or(`site_id.eq.${effectiveSiteId},site_id.is.null`);
      }
      const { data: ed } = await eq;
      if (ed) escContext = ed;
    }

    // Evaluate Confidence
    const items = (searchResults || []) as any[];
    const topItem = items[0];
    const topConfidence = topItem ? parseFloat(topItem.composite_confidence || '0') : 0.0;

    // Check Assist Settings for thresholds
    const { data: settings } = await supabase
      .from('assist_settings')
      .select('high_threshold, medium_threshold')
      .eq('id', 'singleton')
      .single();

    const minAcceptableThreshold = settings?.medium_threshold ? Number(settings.medium_threshold) : 0.20;

    // If zero or very low confidence, log to unanswered queue and reply gracefully
    const hasSufficientKnowledge = (items.length > 0 && topConfidence >= minAcceptableThreshold) || staffContext.length > 0 || escContext.length > 0;

    if (!hasSufficientKnowledge) {
      // Record in unanswered_questions table
      const { data: unanswered } = await supabase
        .from('unanswered_questions')
        .insert({
          question: trimmedQuery,
          normalized_question: trimmedQuery.toLowerCase().slice(0, 300),
          site_id: effectiveSiteId,
          source_message_id: userMsgId,
          priority: 'normal',
          status: 'pending'
        })
        .select('id')
        .single();

      if (unanswered) {
        await supabase
          .from('unanswered_question_askers')
          .insert({
            question_id: unanswered.id,
            user_id: user.id
          });
      }

      const fallbackReply = `I couldn't find a verified SOP, roster, or checklist matching your question in the Paradigm knowledge base for **${siteName}**.\n\n` +
        `📝 **Ticket Created:** I have forwarded this question to the **Operations & Training Team** for review. Once verified content is published, you will receive an in-app notification.\n\n` +
        `**Need immediate assistance?**\n` +
        `• **Central Paradigm Helpdesk**: 📞 [+91 80 4114 2666](tel:+918041142666)\n` +
        `• **Support Email**: [support@paradigmfms.com](mailto:support@paradigmfms.com)\n` +
        `• Check with your Site Facility Manager or Operations Manager.`;

      const latencyMs = Date.now() - startTime;

      if (activeConvId) {
        await supabase.from('assist_messages').insert({
          conversation_id: activeConvId,
          sender: 'assistant',
          content: fallbackReply,
          confidence: topConfidence,
          latency_ms: latencyMs,
          sources: []
        });
      }

      return res.status(200).json({
        conversationId: activeConvId,
        message: fallbackReply,
        isFallback: true,
        confidence: topConfidence,
        sources: [],
        latencyMs
      });
    }

    // 6. Build Grounded Context for LLM
    let contextText = `=== VERIFIED PARADIGM KNOWLEDGE CONTEXT ===\nSite Context: ${siteName} (${siteCity || 'India'})\n\n`;

    // Add retrieved knowledge items
    items.forEach((item, idx) => {
      contextText += `[DOCUMENT ${idx + 1}: ${item.title}]\n`;
      contextText += `Source: ${item.source_table} | Version: v${item.version || '1'}\n`;
      contextText += `Content: ${item.content}\n`;
      if (item.rich_content) {
        contextText += `Structured Data: ${item.rich_content}\n`;
      }
      contextText += '\n';
    });

    // Add Staff roster if queried
    if (staffContext.length > 0) {
      contextText += `[STAFF ROSTER FOR ${siteName.toUpperCase()}]\n`;
      staffContext.forEach(s => {
        contextText += `• ${s.full_name} | Role: ${s.designation} | Dept: ${s.department} | Phone: ${s.phone} | Shift: ${s.shift_type} | Reports to: ${s.reporting_manager_name || 'N/A'}\n`;
      });
      contextText += '\n';
    }

    // Add Escalation matrix if queried
    if (escContext.length > 0) {
      contextText += `[ESCALATION MATRIX]\n`;
      escContext.forEach(e => {
        contextText += `• ${e.level} - ${e.role_name}: ${e.contact_person} | Phone: ${e.phone} | TAT: ${e.tat_minutes} mins | Trigger: ${e.escalation_trigger}\n`;
      });
      contextText += '\n';
    }

    // 7. System Prompt with Strict Anti-Hallucination Directives
    const systemPrompt = `You are "Paradigm Assist", the official AI Knowledge Assistant for Paradigm Integrated Facility Services Pvt. Ltd. (paradigmfms.com).
Your purpose is to provide clear, accurate, and actionable operational assistance to field staff, facility managers, supervisors, and administrative personnel.

STRICT OPERATIONAL RULES:
1. GROUNDING ONLY: Answer ONLY using the facts present in the verified context provided below.
2. ZERO HALLUCINATION: If a detail, name, phone number, frequency, or TAT is not present in the context, clearly state: "This information is not specified in the verified document." NEVER invent contact details or technical parameters.
3. CITATIONS: Attribute key facts with bracketed citations matching the document titles, e.g., [SOP: WTP Daily Operation] or [Site Staff Roster: Sobha Pearl].
4. PRACTICAL FORMAT: Use concise bullet points, numbered step sequences, bold headers, and dialable phone links like [Phone](tel:...) when numbers are present.
5. MULTILINGUAL COURTESY: If the user asked in Hindi, Hinglish, Kannada, or Telugu, answer clearly in that language with technical terms (SOP, STP, WTP, DG, PPM, MCB) kept in English.

${contextText}`;

    // Prepare messages for Groq LLM
    const formattedHistory = (history || []).slice(-4).map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: String(h.content || '')
    }));

    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...formattedHistory,
      { role: 'user', content: trimmedQuery }
    ];

    // 8. Call Groq LLM API with reliable active models
    let assistantReply = '';
    let finalConfidence = Math.max(topConfidence, 0.85);

    if (GROQ_API_KEY) {
      const candidateModels = [
        'qwen/qwen3.8-27b',
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b'
      ];

      for (const model of candidateModels) {
        try {
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${GROQ_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model,
              messages: llmMessages,
              temperature: 0.1,
              max_tokens: 1024,
              top_p: 0.95
            })
          });

          if (groqRes.ok) {
            const groqData: any = await groqRes.json();
            const text = groqData.choices?.[0]?.message?.content?.trim();
            if (text) {
              assistantReply = text;
              break;
            }
          } else {
            console.warn(`[Assist Groq] Model ${model} returned ${groqRes.status}`);
          }
        } catch (llmErr: any) {
          console.warn(`[Assist Groq] Error on ${model}:`, llmErr.message);
        }
      }
    }

    // Fallback if LLM unavailable
    if (!assistantReply) {
      if (items.length > 0) {
        assistantReply = `Here is the verified information from **${items[0].title}**:\n\n${items[0].content}\n\n*Source: [${items[0].title}]*`;
      } else if (staffContext.length > 0) {
        assistantReply = `Here are the staff members on duty for **${siteName}**:\n\n` +
          staffContext.map(s => `• **${s.full_name}** (${s.designation}) — 📞 [${s.phone}](tel:${s.phone}) [Shift: ${s.shift_type}]`).join('\n');
      } else {
        assistantReply = `Verified information retrieved for ${siteName}. Please review the documents in the knowledge portal.`;
      }
    }

    const latencyMs = Date.now() - startTime;

    // Build source citations array
    const citations = items.map(it => ({
      id: it.id,
      title: it.title,
      sourceTable: it.source_table,
      score: it.composite_confidence
    }));

    if (staffContext.length > 0) {
      citations.push({
        id: 'staff-roster',
        title: `Site Staff Directory (${siteName})`,
        sourceTable: 'site_staff_members',
        score: '1.0'
      });
    }

    // Save Assistant Message
    let assistantMsgId: string | null = null;
    if (activeConvId) {
      const { data: savedMsg } = await supabase.from('assist_messages').insert({
        conversation_id: activeConvId,
        sender: 'assistant',
        content: assistantReply,
        confidence: finalConfidence,
        sources: citations,
        latency_ms: latencyMs
      }).select('id').single();

      if (savedMsg) assistantMsgId = savedMsg.id;

      // Update conversation timestamp
      await supabase
        .from('assist_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activeConvId);
    }

    return res.status(200).json({
      conversationId: activeConvId,
      messageId: assistantMsgId,
      message: assistantReply,
      confidence: finalConfidence,
      sources: citations,
      latencyMs
    });

  } catch (err: any) {
    console.error('[Assist Chat] Critical Error:', err);
    return res.status(500).json({
      error: 'Failed to process inquiry with Paradigm Assist',
      details: err.message
    });
  }
}

// ============================================================================
// FEEDBACK HANDLER (Thumbs Up / Thumbs Down)
// ============================================================================
export async function handleAssistFeedback(req: Request, res: Response) {
  try {
    const { messageId, rating } = req.body;
    if (!messageId || ![-1, 0, 1].includes(rating)) {
      return res.status(400).json({ error: 'messageId and valid rating (-1, 0, 1) required' });
    }

    const { error } = await supabase
      .from('assist_messages')
      .update({ feedback_rating: rating })
      .eq('id', messageId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, messageId, rating });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// ============================================================================
// CONVERSATIONS LIST & MESSAGES
// ============================================================================
export async function getAssistConversations(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(403).json({ error: 'Unauthorized' });

    const { data: conversations, error } = await supabase
      .from('assist_conversations')
      .select('id, title, site_id, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(30);

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ conversations: conversations || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getConversationMessages(req: Request, res: Response) {
  try {
    const convId = req.params.id || (req.query.id as string);
    if (!convId) return res.status(400).json({ error: 'Conversation id is required' });

    const { data: messages, error } = await supabase
      .from('assist_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ messages: messages || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// ============================================================================
// ADMIN RESOLUTION & ASKER NOTIFICATION
// ============================================================================
export async function resolveUnansweredQuestion(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.status(403).json({ error: 'Unauthorized' });

    const {
      questionId,
      answer,
      category = 'FAQ',
      siteId = null,
      publishAsFaq = true
    } = req.body;

    if (!questionId || !answer) {
      return res.status(400).json({ error: 'questionId and answer are required' });
    }

    // 1. Get question details
    const { data: qRecord, error: qErr } = await supabase
      .from('unanswered_questions')
      .select('id, question, normalized_question')
      .eq('id', questionId)
      .single();

    if (qErr || !qRecord) {
      return res.status(404).json({ error: 'Question not found' });
    }

    let linkedItemId: string | null = null;

    // 2. Publish as Knowledge Item if requested
    if (publishAsFaq) {
      const { data: faqMod } = await supabase
        .from('knowledge_modules')
        .select('id')
        .eq('slug', 'faqs')
        .single();

      const { data: newItem, error: itemErr } = await supabase
        .from('knowledge_items')
        .insert({
          module_id: faqMod?.id,
          source_table: 'manual_admin',
          source_id: questionId,
          title: qRecord.question.slice(0, 150),
          content: answer,
          site_id: siteId,
          tags: ['faq', 'admin-resolved', category.toLowerCase()],
          synonyms: [qRecord.question, qRecord.normalized_question],
          status: 'published',
          created_by: user.id
        })
        .select('id')
        .single();

      if (newItem) linkedItemId = newItem.id;
    }

    // 3. Mark question as resolved
    await supabase
      .from('unanswered_questions')
      .update({
        status: 'resolved',
        admin_answer: answer,
        linked_item_id: linkedItemId,
        resolved_by: user.id,
        resolved_at: new Date().toISOString()
      })
      .eq('id', questionId);

    // 4. Notify all original askers
    const { data: askers } = await supabase
      .from('unanswered_question_askers')
      .select('user_id')
      .eq('question_id', questionId);

    if (askers && askers.length > 0) {
      const notifications = askers.map(a => ({
        user_id: a.user_id,
        title: '💡 Your Question Has Been Answered!',
        message: `Admin has verified the answer to: "${qRecord.question.slice(0, 80)}..."`,
        type: 'info',
        data: {
          questionId,
          answer,
          linkedItemId,
          route: '/assist'
        },
        read: false,
        created_at: new Date().toISOString()
      }));

      await supabase.from('notifications').insert(notifications);

      // Mark askers as notified
      await supabase
        .from('unanswered_question_askers')
        .update({ notified_at: new Date().toISOString() })
        .eq('question_id', questionId);
    }

    return res.status(200).json({
      success: true,
      questionId,
      linkedItemId,
      askersNotified: askers?.length || 0
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// ============================================================================
// ADMIN STATS & ANALYTICS
// ============================================================================
export async function getAssistStats(req: Request, res: Response) {
  try {
    // 1. Total queries & messages count
    const { count: totalMessages } = await supabase
      .from('assist_messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender', 'user');

    // 2. Pending unanswered questions count
    const { count: pendingUnanswered } = await supabase
      .from('unanswered_questions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // 3. Resolved questions count
    const { count: resolvedCount } = await supabase
      .from('unanswered_questions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'resolved');

    // 4. Total knowledge items
    const { count: totalKnowledgeItems } = await supabase
      .from('knowledge_items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published');

    // 5. Avg confidence
    const { data: avgConfData } = await supabase
      .from('assist_messages')
      .select('confidence')
      .eq('sender', 'assistant')
      .not('confidence', 'is', null)
      .limit(100);

    let avgConfidence = 0.85;
    if (avgConfData && avgConfData.length > 0) {
      const sum = avgConfData.reduce((acc, curr) => acc + (Number(curr.confidence) || 0), 0);
      avgConfidence = Number((sum / avgConfData.length).toFixed(2));
    }

    // 6. Feedback satisfaction
    const { count: positiveFeedback } = await supabase
      .from('assist_messages')
      .select('*', { count: 'exact', head: true })
      .eq('feedback_rating', 1);

    const { count: negativeFeedback } = await supabase
      .from('assist_messages')
      .select('*', { count: 'exact', head: true })
      .eq('feedback_rating', -1);

    return res.status(200).json({
      totalQueries: totalMessages || 0,
      pendingUnanswered: pendingUnanswered || 0,
      resolvedCount: resolvedCount || 0,
      totalKnowledgeItems: totalKnowledgeItems || 0,
      avgConfidence,
      satisfaction: {
        positive: positiveFeedback || 0,
        negative: negativeFeedback || 0
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
