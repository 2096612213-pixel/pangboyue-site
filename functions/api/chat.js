// Pages后台转发到独立Worker。前端不保存个人资料、系统提示或模型密钥。
const UPSTREAM = 'https://boyue-agent.2096612213.workers.dev/chat';
const MAX_BYTES = 32000;

// 纯身份问题直接给出最小答复，避免上游模型主动扩展人物资料。
function identityReply(text) {
  const question = text.trim().toLowerCase().replace(/[\s，,。.!！?？：:；;、]+/gu, '').replace(/^(你好|您好|嗨|hello)/u, '');
  return /^(你|您)(是谁|是哪位|是哪个|叫什么|叫什么名字|的名字是什么|的身份是什么|是什么身份|是什么|是什么助手|是庞博约吗)(呀|啊|呢|吗|哦)?$/u.test(question) ||
    /^(介绍(一下|下)?(你|您)?自己|自我介绍(一下|下)?|whoareyou|whatisyourname|what'syourname|nishishei|nishishui)$/u.test(question)
    ? '我是 Ψ（Psi），庞博约的数字助手。' : null;
}

export async function onRequest({ request }) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  const json = (value, status = 200) => Response.json(value, { status, headers });
  if (request.method !== 'POST') return json({ error: '请发送对话消息。' }, 405);
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return json({ error: '消息格式不正确。' }, 415);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: '消息不能为空。' }, 400);
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); return json({ error: '消息过长，请缩短后再试。' }, 413); }
      chunks.push(value);
    }
  } catch { return json({ error: '没有收到完整消息，请重试。' }, 400); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let data;
  try { data = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { return json({ error: '消息格式不正确。' }, 400); }
  const messages = data?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 12 ||
      messages.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || (m.role === 'assistant' && m.content.length > 2000)) ||
      messages.at(-1).role !== 'user') return json({ error: '消息格式不正确。' }, 400);
  if (messages.some(m => m.role === 'user' && Array.from(m.content).length > 100)) return json({ error: '每次输入不能超过 100 字。' }, 400);
  if (messages.reduce((sum, m) => sum + m.content.length, 0) > 8000) return json({ error: '当前对话太长，请开启新对话。' }, 400);
  const identity = identityReply(messages.at(-1).content);
  if (identity) return json({ reply: identity });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 85000);
  try {
    const response = await fetch(UPSTREAM, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages.map(m => ({ role: m.role, content: m.content })) }),
      redirect: 'error', signal: controller.signal
    });
    if (!response.headers.get('Content-Type')?.includes('application/json')) return json({ error: '暂时无法连接数字分身，请稍后再试。' }, 502);
    const result = await response.json();
    if (!response.ok) {
      const quota = /quota|neurons|limit exceeded|daily|额度/i.test(String(result.error || ''));
      return json({ error: quota ? '今天的对话额度已用完，请稍后再来。' : '数字分身暂时无法回复，请稍后再试。' }, quota ? 429 : 502);
    }
    if (typeof result.reply !== 'string' || !result.reply.trim()) return json({ error: '没有收到完整回复，请重试。' }, 502);
    return json({ reply: result.reply.trim() });
  } catch { return json({ error: '对话连接暂时中断，请稍后再试。' }, 502); }
  finally { clearTimeout(timer); }
}
