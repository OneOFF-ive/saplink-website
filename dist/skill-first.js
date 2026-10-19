(() => {
  const button = document.getElementById('copy-skill-prompt');
  if (!button) return;
  button.addEventListener('click', async () => {
    const prompt = document.getElementById('skill-prompt');
    const status = document.getElementById('skill-copy-status');
    try {
      await navigator.clipboard.writeText(prompt.value);
      status.textContent = '已复制，请发送给已导入 saplink-manager 的 Agent。';
    } catch {
      prompt.focus(); prompt.select();
      status.textContent = '已选中开始指令，请复制后发送给 Agent。';
    }
  });
})();
