# SapLink 产品官网

基于 SapLink 仓库产品文档制作的中文官网，以 VS Code 官网的深色背景、蓝色强调和工作界面展示为视觉参考。

## 本地预览

运行 `npm run dev`，打开 http://127.0.0.1:4173 。无需安装依赖。

`dist/` 是可直接托管的静态网站目录。`npm run check` 检查交互脚本语法。

## 内容依据

- https://github.com/OneOFF-ive/saplink/blob/main/README.md
- https://github.com/OneOFF-ive/saplink/blob/main/docs/windows-installer.md
- https://github.com/OneOFF-ive/saplink/blob/main/docs/mcp-client-guide.md
- https://github.com/OneOFF-ive/saplink/blob/main/docs/security.md
- https://github.com/OneOFF-ive/saplink/blob/main/docs/architecture.md

核对日期：2026-10-17。架构文档中的“不提供桌面安装包”与专门安装指南及 README 不一致，下载说明采用后两者。演示内容是交互示意，不连接 SAP。下载按钮跳转 GitHub Releases，访客自行选择对应架构安装包。客户端名称说明 MCP 接入场景，不表示认证合作关系。

## 文件

- `dist/index.html`：页面与文案
- `dist/styles.css`：响应式样式
- `dist/app.js`：三个演示场景与移动端导航
- `dist/logo.svg`：依据仓库三环相扣品牌概念绘制的矢量标识
- `server.mjs`：本地静态预览服务

网站未收集用户数据，未添加统计、账户或后台。Sites 预览保留默认私有访问权限。
