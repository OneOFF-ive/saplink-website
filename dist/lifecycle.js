(() => {
  const section = document.getElementById('ai-management');
  if (!section) return;
  const stages = [
    {
      prompt: '帮我配置 SapLink，连接我的 SAP 开发系统 DEV',
      results: ['引导填写系统地址、Client 和用户名，密码由你在本机窗口录入', '创建默认只读的连接，并测试目标系统是否可用', '核对连接结果，明确后续操作使用的 SAP 系统'],
      outcome: '从连接信息到可用的 SAP 连接，在 AI 引导下完成配置',
    },
    {
      prompt: '把 SapLink 接入我当前使用的 AI 客户端',
      results: ['在本机创建访问令牌并启动 SapLink 后台服务', '合并客户端连接配置，保留已有的其他服务设置', '验证 MCP 初始化与工具可见性，需要重载时给出提示'],
      outcome: '把配置、接入和验证串起来，让当前 AI 客户端拥有 SAP 工具',
    },
    {
      prompt: '查询 DEV 系统中的物料数据，按物料类型汇总并解释结果',
      results: ['先确认目标系统与查询范围，再读取相关数据结构', '通过 SapLink 执行只读查询，返回结果并协助分析', '需要开发变更时，按授权执行保存、检查与激活'],
      outcome: '在同一个 AI 工作环境中理解系统、查询业务数据并协助开发',
    },
    {
      prompt: '检查 SapLink 的运行状态，诊断 DEV 连接，并检查是否有新版本',
      results: ['检查服务、端口、配置与目标 SAP 连接，定位异常', '按你的授权管理服务启停、连接、令牌及缓存清理', '检查正式版更新，提供下载入口；由你手动完成升级'],
      outcome: '从日常状态检查到问题诊断和升级准备，持续协助管理 SapLink',
    },
  ];
  const tabs = [...section.querySelectorAll('[role="tab"]')];
  const panel = section.querySelector('[role="tabpanel"]');
  function select(index) {
    const stage = stages[index];
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', tabs[index].id);
    section.querySelector('[data-lifecycle-prompt]').textContent = stage.prompt;
    section.querySelectorAll('[data-lifecycle-result]').forEach((line, i) => { line.textContent = stage.results[i]; });
    section.querySelector('[data-lifecycle-outcome]').textContent = stage.outcome;
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      select(next);
      tabs[next].focus();
    });
  });
})();
