(() => {
  'use strict';
  // 前端只使用本站接口；人物资料和模型调用保留在后台。
  const CONFIG = Object.freeze({ endpoint: '/api/chat', maxChars: 100, timeout: 90000, historyLimit: 10 });
  const section = document.getElementById('digital-agent');
  if (!section) return;
  const form = document.getElementById('agent-form');
  const input = document.getElementById('agent-input');
  const send = document.getElementById('agent-send');
  const empty = document.getElementById('agent-empty');
  const log = document.getElementById('agent-messages');
  const count = document.getElementById('agent-count');
  const status = document.getElementById('agent-input-status');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const turns = [];
  let busy = false;
  let composing = false;
  // 图标全部为本站静态矢量，模型返回的文字不会插入HTML。
  const ICONS = {
    copy: '<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M15 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
    regenerate: '<path d="M20 7v5h-5M19.4 12a7.4 7.4 0 1 0-1.6 4.6"/>',
    share: '<path d="m14 4 7 7-7 7v-4c-5 0-8 2-11 6 0-7 4-11 11-11Z"/>',
    done: '<path d="m5 12 4 4L19 6"/>'
  };
  const iconMarkup = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

  function updateInput() {
    const length = Array.from(input.value).length;
    const tooLong = length > CONFIG.maxChars;
    count.textContent = `${length} / ${CONFIG.maxChars}`;
    count.classList.toggle('is-over-limit', tooLong);
    status.classList.toggle('is-over-limit', tooLong);
    status.classList.toggle('agent-sr-only', !tooLong);
    form.classList.toggle('is-invalid', tooLong);
    input.setAttribute('aria-invalid', String(tooLong));
    status.textContent = tooLong ? `超出 ${length - CONFIG.maxChars} 字，请删减后发送` : busy ? '正在回复…' : '';
    send.disabled = busy || tooLong || !input.value.trim();
    send.setAttribute('aria-label', busy ? '正在回复' : '发送消息');
    input.style.height = 'auto';
    input.style.height = `${Math.min(168, Math.max(70, input.scrollHeight))}px`;
  }

  function setBusy(value) {
    busy = value;
    input.readOnly = value;
    form.setAttribute('aria-busy', String(value));
    for (const turn of turns) {
      for (const [action, button] of Object.entries(turn.view.buttons)) {
        button.disabled = value || (action !== 'regenerate' && !turn.reply);
      }
    }
    updateInput();
  }

  // 只生成安全的文本、粗体与http(s)链接，不执行模型输出的HTML。
  function renderReply(element, text) {
    element.replaceChildren();
    const pattern = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|(https?:\/\/[^\s<>]+)/g;
    let offset = 0;
    for (const match of text.matchAll(pattern)) {
      element.append(document.createTextNode(text.slice(offset, match.index)));
      if (match[3]) {
        const strong = document.createElement('strong');
        strong.textContent = match[3];
        element.append(strong);
      } else {
        const label = match[1];
        const raw = match[2] || match[4];
        const url = raw.replace(/[。，、！？；：）]+$/u, '');
        const link = document.createElement('a');
        link.href = url;
        link.textContent = label || url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        element.append(link, document.createTextNode(raw.slice(url.length)));
      }
      offset = match.index + match[0].length;
    }
    element.append(document.createTextNode(text.slice(offset)));
  }

  function showWaiting(body) {
    const dots = document.createElement('span');
    dots.className = 'agent-thinking';
    dots.setAttribute('aria-hidden', 'true');
    for (let n = 0; n < 3; n++) dots.append(document.createElement('i'));
    const sr = document.createElement('span');
    sr.className = 'agent-sr-only';
    sr.textContent = '正在回复';
    body.replaceChildren(dots, sr);
  }

  function addMessage(role, text, waiting = false) {
    empty.hidden = true;
    log.hidden = false;
    const row = document.createElement('div');
    row.className = `agent-message is-${role}`;
    const body = document.createElement('p');
    body.className = 'agent-message-body';
    if (waiting) showWaiting(body);
    else body.textContent = text;
    const content = document.createElement('div');
    if (role === 'assistant') {
      const avatar = empty.querySelector('img').cloneNode(false);
      avatar.className = 'agent-avatar-icon';
      avatar.width = avatar.height = 28;
      avatar.setAttribute('aria-hidden', 'true');
      content.className = 'agent-answer-content';
      content.append(body);
      row.append(avatar, content);
    } else row.append(body);
    const messageFrame = document.createElement('div');
    messageFrame.className = 'agent-message-row';
    messageFrame.append(row);
    log.append(messageFrame);
    log.scrollTop = log.scrollHeight;
    return { row, body, content };
  }

  function actionNotice(turn, text, error = false) {
    turn.view.notice.textContent = text;
    turn.view.notice.classList.toggle('agent-sr-only', !error);
  }

  async function copyText(turn, button, text, notice) {
    try {
      await navigator.clipboard.writeText(text);
      const original = button.dataset.action;
      button.innerHTML = iconMarkup('done');
      button.title = notice;
      actionNotice(turn, notice);
      setTimeout(() => {
        button.innerHTML = iconMarkup(original);
        button.title = button.getAttribute('aria-label');
      }, 1600);
    } catch { actionNotice(turn, '复制失败，请选择正文复制。', true); }
  }

  function addActions(turn) {
    const actions = document.createElement('div');
    actions.className = 'agent-actions';
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', '回答操作');
    actions.hidden = true;
    const buttons = {};
    const labels = { copy: '复制回答', regenerate: '重新回答', share: '分享回答' };
    for (const [action, label] of Object.entries(labels)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'agent-action';
      button.dataset.action = action;
      button.setAttribute('aria-label', label);
      button.title = label;
      button.innerHTML = iconMarkup(action);
      button.addEventListener('click', async () => {
        if (busy) return;
        if (action === 'copy') await copyText(turn, button, turn.reply, '已复制');
        else if (action === 'regenerate') await requestReply(turn);
        else if (action === 'share') {
          const text = `${turn.user}\n\n${turn.reply}`;
          if (navigator.share && (!navigator.canShare || navigator.canShare({ text }))) {
            try { await navigator.share({ title: '庞博约 · 对话', text }); }
            catch (error) { if (error.name !== 'AbortError') actionNotice(turn, '分享未完成，请复制回答后分享。', true); }
          } else await copyText(turn, button, text, '对话已复制，可粘贴分享');
        }
      });
      buttons[action] = button;
      actions.append(button);
    }
    const notice = document.createElement('p');
    notice.className = 'agent-action-status agent-sr-only';
    notice.setAttribute('role', 'status');
    turn.view.content.append(actions, notice);
    Object.assign(turn.view, {actions, buttons, notice});
  }

  function requestMessages(turn) {
    const preceding = turns.slice(0, turns.indexOf(turn)).filter(t => t.reply).slice(-CONFIG.historyLimit / 2);
    const messages = [...preceding.flatMap(t => [{role: 'user', content: t.user}, {role: 'assistant', content: t.reply.slice(0, 2000)}]), {role: 'user', content: turn.user}];
    while (messages.length > 1 && messages.reduce((sum, m) => sum + m.content.length, 0) > 8000) messages.splice(0, 2);
    return messages;
  }

  async function requestReply(turn) {
    if (busy) return;
    const pending = turn.view;
    const messages = requestMessages(turn);
    const followLatest = turns.at(-1) === turn;
    setBusy(true);
    pending.row.classList.remove('is-error');
    pending.actions.hidden = true;
    actionNotice(turn, '');
    showWaiting(pending.body);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.timeout);
    try {
      const response = await fetch(CONFIG.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify({ messages }), signal: controller.signal
      });
      const type = response.headers.get('Content-Type') || '';
      if (!type.includes('application/json')) throw new Error('对话暂时无法连接，请稍后再试。');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '暂时无法回复，请稍后再试。');
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('没有收到完整回复，请重试。');
      const reply = data.reply.trim();
      turn.reply = reply;
      renderReply(pending.body, reply);
    } catch (error) {
      const message = error.name === 'AbortError' ? '回复等待超时，请稍后再试。' : error instanceof TypeError ? '连接暂时中断，请稍后再试。' : error.message;
      if (turn.reply) {
        renderReply(pending.body, turn.reply);
        actionNotice(turn, `重新回答失败，已保留上次回答。${message}`, true);
      } else {
        pending.row.classList.add('is-error');
        pending.body.textContent = message;
      }
    } finally {
      clearTimeout(timer);
      pending.actions.hidden = false;
      setBusy(false);
      if (followLatest) log.scrollTop = log.scrollHeight;
      else pending.row.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const text = input.value.trim();
    if (busy || !text) return;
    if (Array.from(input.value).length > CONFIG.maxChars) { updateInput(); return; }
    input.value = '';
    addMessage('user', text);
    const turn = {user: text, reply: '', view: addMessage('assistant', '', true)};
    addActions(turn);
    turns.push(turn);
    await requestReply(turn);
  });

  input.addEventListener('input', updateInput);
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; updateInput(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !composing && event.keyCode !== 229) {
      event.preventDefault(); form.requestSubmit();
    }
  });
  document.querySelectorAll('.agent-entry').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    section.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }));
  updateInput();
})();
