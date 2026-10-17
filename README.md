<p align="center">
  <img src="dist/app-icon.png" width="180" alt="SapLink 图标：连接 SAP 与 AI 的三环无限符号">
</p>

<h1 align="center">SapLink 产品官网</h1>

<p align="center">
  <strong>连接 SAP 与 AI，探索无限可能 ✨</strong>
</p>

<p align="center">
  产品介绍 · 工作流演示 · 文档导航 · 安装包下载
</p>

<p align="center">
  <a href="http://118.89.185.57">🌐 访问官网</a> ·
  <a href="http://118.89.185.57/download.html?arch=auto">⬇️ 下载 SapLink</a> ·
  <a href="https://github.com/OneOFF-ive/saplink">🔗 产品仓库</a> ·
  <a href="docs/deployment.md">📦 部署说明</a> ·
  <a href="automation/README.md">🔄 自动同步</a>
</p>

---

## 🌐 从了解 SapLink，到开始使用

这里是 [SapLink](https://github.com/OneOFF-ive/saplink) 的中文产品官网源码，提供产品能力介绍、交互式工作流演示、文档入口和站内安装包下载。

页面采用原生 **HTML、CSS 和 JavaScript**，无需前端框架、构建步骤或生产数据库。生产环境由 **Caddy + Docker** 提供静态服务，同时支持 **[HTTPS 域名](https://saplink.cloud)**、**[HTTP 域名](http://saplink.cloud)** 和 **[HTTP IP](http://118.89.185.57)** 访问。

## 🧩 官网提供什么

| 功能 | 说明 |
| --- | --- |
| 🔍 产品与工作流演示 | 展示业务数据分析、业务问题排查、系统理解与开发协作，帮助访问者了解 SapLink |
| 🤖 AI 全生命周期管理 | 用四步交互展示连接配置、客户端接入、SAP 工作与服务维护的指令、流程和效果 |
| 🌓 自动明暗主题 | 跟随浏览器主题即时切换，浅色采用蓝白配色，暗色保留深色界面 |
| 🧭 架构自动识别 | 首屏与导航栏识别 Windows x64／ARM64，无法可靠识别时进入选择页 |
| ⬇️ 站内自动下载 | 进入下载页后获取最新版本、检查文件并发起下载，同时保留手动重试入口 |
| 🔄 GitHub 版本同步 | 校验正式版安装包的大小与 SHA-256，完整验证后切换最新版本 |
| 📚 文档导航 | 连接产品安装、客户端接入、开发构建和运维手册 |

底部始终保留 **Windows x64** 和 **Windows ARM64** 两个手动下载入口，显式选择优先于自动识别。安装包目前仅支持 Windows；Apple 芯片 Mac 上的 Windows 虚拟机建议使用 ARM64，Intel 芯片 Mac 使用 x64。

> 工作区画面是交互示意，不连接真实 SAP。自动识别取决于浏览器提供的架构信息；信息不足或访问者使用其他系统时，由用户选择安装包。

## 🚀 本地快速开始

需要 **Node.js**，无需安装第三方依赖。在项目根目录运行：

```sh
npm run dev
```

打开 **[http://127.0.0.1:4173](http://127.0.0.1:4173)** 即可预览。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动本地预览服务 |
| `npm run check` | 检查服务端与页面脚本语法 |
| `npm test` | 验证架构识别、自动下载和错误恢复流程 |

本地安装包和版本清单可放入 `local/downloads/`，预览服务会将其映射到 `/downloads/`。没有这些文件时仍可浏览页面，下载页会显示手动重试提示。

## 🗂️ 项目结构

| 路径 | 用途 |
| --- | --- |
| `dist/` | 可直接部署的页面、样式、交互脚本和品牌标识 |
| `dist/theme.css` | 跟随浏览器主题的浅色配色 |
| `dist/architecture.js` | Windows 架构识别与下载入口适配 |
| `server.mjs` | 本地预览服务 |
| `Caddyfile` | HTTP／HTTPS 并行服务、静态文件与下载响应头 |
| `automation/` | 安装包同步接收程序、测试与维护说明 |
| `tests/` | 架构识别与下载流程回归测试 |
| `docs/` | 部署、证书与版本管理说明 |
| `local/` | 不提交到 Git 的临时脚本、截图、证书及本地安装包 |

`dist/` 同时是网站源码与部署目录，没有额外构建步骤。安装包、版本清单和凭据单独管理，不提交到此仓库。

## 🔄 从 GitHub 发布到官网下载安装包

```text
产品仓库发布正式版 → 同步并校验 x64／ARM64 安装包 → 切换最新版本 → 官网提供下载
```

产品仓库负责构建、发布安装包及运行同步工作流；本仓库维护官网和服务器接收端。**网页发布与安装包同步是两个独立操作**，安装包更新无需重新发布页面。

服务器只保留最新正式版安装包，完整校验并切换成功后自动清理旧版。历史版本和变更说明可在 [GitHub Releases](https://github.com/OneOFF-ive/saplink/releases) 查看。

## 🛡️ HTTPS 与部署

官网同时提供 HTTP 和 HTTPS，保持访问者选择的协议，HTTP 不强制跳转到 HTTPS，也保留 IP 的 HTTP 入口。证书、私钥和安装包目录与网页文件分开管理。

当前使用手动证书，需要在到期前重新签发并更新；证书位置、有效期、容器挂载、页面切换和回滚步骤见 [部署与版本管理](docs/deployment.md)。

## 📚 文档导航

| 你想了解 | 阅读入口 |
| --- | --- |
| 发布官网、配置 HTTPS 与管理证书 | [部署与版本管理](docs/deployment.md) |
| GitHub 自动同步、手动重试与故障处理 | [安装包自动同步](automation/README.md) |
| 了解 SapLink 产品与功能 | [产品仓库](https://github.com/OneOFF-ive/saplink) |
| 安装与使用 SapLink | [Windows 安装指南](https://github.com/OneOFF-ive/saplink/blob/main/docs/windows-installer.md) |
| 配置连接与接入 AI 客户端 | [部署与运维手册](https://github.com/OneOFF-ive/saplink/blob/main/docs/operations.md) |
| 查阅全部产品文档 | [产品文档导航](https://github.com/OneOFF-ive/saplink/blob/main/docs/README.md) |
| 下载安装包与查看历史版本 | [GitHub Releases](https://github.com/OneOFF-ive/saplink/releases) |

---

<p align="center">
  <a href="http://118.89.185.57">SapLink 官网</a> ·
  <a href="https://github.com/OneOFF-ive/saplink">SapLink 产品仓库</a>
</p>
