const demos = {
  read: {
    file: 'z_material_report.abap', object: 'Z_MATERIAL_REPORT',
    code: ["REPORT z_material_report.", "", '" 物料主数据查询', "PARAMETERS p_mtart TYPE mara-mtart.", "", "SELECT matnr, mtart, meins", "  FROM mara", "  WHERE mtart = @p_mtart", "  INTO TABLE @DATA(lt_materials).", "", "cl_demo_output=>display( lt_materials )."],
    prompt: '帮我分析这个物料报表，解释它的核心逻辑。',
    answer: '我会先确认目标系统，然后读取程序源码。', tool: 'read_source',
    result: '<b>这是一个物料主数据查询报表。</b><br>按物料类型筛选 MARA 表，返回物料编码、类型和基本计量单位，并展示结果。',
    terminal: '已读取活动源码 · revision 已记录'
  },
  develop: {
    file: 'z_material_summary.abap', object: 'Z_MATERIAL_SUMMARY',
    code: ['REPORT z_material_summary.', '', '" 示例：按物料类型汇总', 'SELECT mtart, COUNT(*) AS total', '  FROM mara', '  GROUP BY mtart', '  INTO TABLE @DATA(lt_summary).', '', 'cl_demo_output=>display( lt_summary ).', '', '" 保存 → 语法检查 → 显式激活'],
    prompt: '在测试包中创建一个报表，按物料类型汇总数量。',
    answer: '确认开发与激活授权后，先创建程序，再按步骤保存和检查。', tool: 'syntax_check',
    result: '<b>示例开发流程</b><br>创建对象 → 读取版本 → 保存源码 → 检查语法。显式激活后，再读回活动源码核实结果。',
    terminal: '流程示意 · 语法检查与激活分别进行'
  },
  query: {
    file: 'material_analysis.sql', object: 'MARA · READ-ONLY',
    code: ['SELECT', '  mtart,', '  COUNT(*) AS total', 'FROM mara', 'GROUP BY mtart', '', '" 只读 ABAP SQL 查询', '" 结果示意，不代表真实业务数据', '', '" MTART       TOTAL', '" FERT          128', '" HALB           64'],
    prompt: '查询物料主数据，按物料类型汇总数量。',
    answer: '使用只读 ABAP SQL 聚合查询，先确认目标连接与后端能力。', tool: 'query_sql',
    result: '<b>聚合查询结果示意</b><br>FERT · 128　HALB · 64<br>查询仍受 SAP 权限与后端能力约束；返回截断标记时，不能视为完整结果。',
    terminal: '只读 SELECT · 返回值保留字符串精度'
  }
};
const escape = (text) => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function syntax(line) {
  if (line.trim().startsWith('"')) return `<span class="code-comment">${escape(line)}</span>`;
  return escape(line).replace(/\b(REPORT|PARAMETERS|TYPE|SELECT|FROM|WHERE|INTO|TABLE|DATA|GROUP|BY|AS|COUNT)\b/g, '<span class="purple">$1</span>').replace(/\b(mara|mtart|matnr|meins|total)\b/g, '<span class="blue">$1</span>');
}
const tabs = Array.from(document.querySelectorAll('[data-demo]'));
function showDemo(name, announce = true) {
  const demo = demos[name];
  for (const tab of tabs) {
    const selected = tab.dataset.demo === name;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  document.getElementById('demo-code').innerHTML = demo.code.map((line,i) => `<div class="code-line"><span class="line-number">${i+1}</span><span>${syntax(line)}</span></div>`).join('');
  for (const [id, value] of Object.entries({'file-name':demo.file,'breadcrumb-name':demo.object,'demo-prompt':demo.prompt,'demo-answer':demo.answer,'demo-tool':demo.tool,'terminal-message':demo.terminal})) document.getElementById(id).textContent = value;
  document.getElementById('demo-result').innerHTML = demo.result;
  if (announce) document.getElementById('demo-announcement').textContent = '已切换到' + tabs.find(t => t.dataset.demo === name).textContent.trim() + '演示。' + demo.prompt;
}
tabs.forEach((tab,index) => {
  tab.addEventListener('click', () => showDemo(tab.dataset.demo));
  tab.addEventListener('keydown', event => {
    let next;
    if(event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if(event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if(event.key === 'Home') next = 0;
    if(event.key === 'End') next = tabs.length - 1;
    if(next === undefined) return;
    event.preventDefault(); tabs[next].focus(); showDemo(tabs[next].dataset.demo);
  });
});
const toggle = document.querySelector('.menu-toggle');
const navigation = document.getElementById('navigation');
function closeMenu(){ navigation.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); toggle.setAttribute('aria-label','展开导航'); }
toggle.addEventListener('click', () => {
  const open = navigation.classList.toggle('open');
  toggle.setAttribute('aria-expanded',String(open)); toggle.setAttribute('aria-label',open ? '收起导航' : '展开导航');
});
navigation.querySelectorAll('a').forEach(a => a.addEventListener('click',closeMenu));
document.addEventListener('keydown', e => {if(e.key === 'Escape' && navigation.classList.contains('open')){closeMenu();toggle.focus();}});
showDemo('read', false);
