(() => {
  const panel = document.getElementById('inspector');
  const opener = document.getElementById('settingsBtn');
  const backdrop = document.getElementById('drawerBackdrop');
  function setPanel(open) {
    panel.hidden = backdrop.hidden = !open;
    opener.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('panel-open', open);
    (open ? document.getElementById('closeSettings') : opener).focus();
  }
  opener.addEventListener('click', () => setPanel(panel.hidden));
  document.getElementById('closeSettings').addEventListener('click', () => setPanel(false));
  backdrop.addEventListener('click', () => setPanel(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) setPanel(false); });
  // 将原页面的参数文字关联到输入框，保留所有参数的原有行为。
  document.querySelectorAll('.control-row').forEach(row => {
    const input = row.querySelector('input');
    const label = row.querySelector('.control-label');
    if (input && label) { label.id = input.id + '-label'; input.setAttribute('aria-labelledby', label.id); }
  });
  const dialog = document.getElementById('referenceDialog');
  const video = document.getElementById('referenceVideo');
  document.getElementById('referenceBtn').addEventListener('click', () => {
    if (!panel.hidden) setPanel(false);
    if (!video.hasAttribute('src')) { video.src = video.dataset.src; video.load(); }
    dialog.showModal();
  });
  document.getElementById('closeReference').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => video.pause());
})();
