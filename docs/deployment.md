# 部署与版本管理

## 运行方式

`dist/` 内的文件可直接交给静态网站服务器，无需构建、数据库或生产 Node.js 进程。`server.mjs` 仅用于本地预览。

当前同时提供 **http://118.89.185.57**、**http://saplink.cloud** 和 **https://saplink.cloud**，HTTP 不强制跳转到 HTTPS。`www.saplink.cloud` 也分别支持 HTTP 和 HTTPS，并保持访问者选择的协议和域名。

生产环境使用 Docker 中的 Caddy：主机 TCP 80 映射到容器 TCP 8080，主机 TCP 443 映射到容器 TCP 8443，容器名为 `saplink-website`，设置了 `unless-stopped` 自动恢复策略。`auto_https off` 禁用自动 HTTPS 跳转，HTTPS 站点显式加载证书。两个协议共用 `site_content` 配置和同一份页面、安装包目录。当前配置路径为 `/srv/saplink-website/configs/20261017-dual-protocol.Caddyfile`。

此前浏览器可能缓存过 301 永久跳转；服务器无法撤回已缓存的跳转，可清理浏览器缓存、使用无痕窗口或添加新查询参数后访问 HTTP 地址。HTTP 下架构识别受浏览器限制，无法可靠识别时保留手动选择页。

HTTPS 使用用户提供的证书，证书链和私钥保存在 `/srv/saplink-website/certs/fullchain.pem`、`privkey.pem`，启用时以只读目录挂载到容器 `/etc/caddy/certs`。目录权限为 `root:1001 750`，文件为 `root:1001 640`，不得放在网站根目录。Caddy 以 `1000:1001` 运行，手动证书不会自动续期。

当前证书到期时间为 **2027-01-14 23:59:59 UTC**（Asia/Irkutsk 为 2027-01-15 07:59:59）。到期前应重新签发证书，确认域名和私钥匹配，替换上述文件并重启容器，再验证证书链与下载入口。证书文件仅放在被 Git 忽略的 `local/` 和服务器证书目录中。

`Caddyfile` 将 `/srv` 作为站点根目录，为安装包设置附件下载响应头，并对 `/downloads/latest/` 禁用缓存。旧的 `/releases.json` 地址会映射到最新版本清单。

## 服务器目录

```text
/srv/saplink-website/
├── releases/<发布时间>/     官网页面版本
├── current -> releases/...  当前页面版本标记
├── configs/                实际使用的 Caddy 配置
├── certs/                  HTTPS 证书链和私钥，不对外提供文件服务
├── deployment-info.txt     当前容器的部署记录
└── downloads/
    ├── v<版本号>/          已验证的安装包、稳定名称链接和版本清单
    ├── latest -> v.../     最新安装包版本指针
    └── skills/
        ├── v<版本号>/      对应 Release 源码的 skill ZIP 与 skill.json
        └── latest -> v.../ 最新 skill 版本指针
```

容器只读挂载具体页面版本目录到 `/srv`，挂载下载目录到 `/srv/downloads`，并单独挂载 Caddy 配置。**只修改页面的 `current` 链接不会切换容器内容**；更新页面时必须重建容器，使其挂载新目录。

下载目录挂载的是整个目录，因此切换 `downloads/latest` 会立即生效，无需重建容器。新版本完整校验并切换成功后，自动删除旧安装包，服务器只保留最新版。历史版本通过 [GitHub Releases](https://github.com/OneOFF-ive/saplink/releases) 下载。

## 更新官网页面

1. 在本地运行 `npm run check` 和 `npm test`。
2. 将 `dist/` 内的全部文件复制到新的页面版本目录，创建空的 `downloads/` 挂载点。
3. 保留现有 Docker 配置：只读挂载、非 root 用户、临时 `/data`、日志轮转、自动恢复策略及端口映射。
4. 用新页面目录和所需 Caddy 配置启动临时容器，验证首页、下载页及安装包入口。
5. 保留旧容器配置，切换正式容器，再更新 `current` 标记与部署记录。失败时恢复旧容器。

可在服务器查看实际挂载路径、状态和日志：

```sh
sudo docker inspect saplink-website --format '{{json .Mounts}}'
sudo docker ps --filter name=saplink-website
sudo docker logs --tail 100 saplink-website
sudo docker restart saplink-website
```

此过程只发布网页文件，不覆盖下载目录或同步账户配置。

## 安装包与版本清单

每个安装包版本目录包含：

```text
v<版本号>/
├── SapLink-<版本号>-win-x64-setup.exe
├── SapLink-<版本号>-win-arm64-setup.exe
├── SapLink-win-x64-setup.exe   -> 同目录的版本化安装包
├── SapLink-win-arm64-setup.exe -> 同目录的版本化安装包
└── releases.json
```

清单字段如下，大小以字节计，SHA-256 使用 64 位十六进制字符串：

| 字段 | 含义 |
| --- | --- |
| `version` | 不含 `v` 前缀的版本号 |
| `release_id` | GitHub 官方 Release ID |
| `platforms.x64` / `platforms.arm64` | 两种架构的安装包信息 |
| `platforms.*.name` | 平台显示名称 |
| `platforms.*.filename` | 实际安装包文件名 |
| `platforms.*.url` | `downloads/v<版本号>/<实际文件名>` |
| `platforms.*.size` | 官方文件大小 |
| `platforms.*.sha256` | 官方 SHA-256 |

这些内容由[自动同步接收端](../automation/README.md)生成。两种安装包都核对通过后，才原子切换 `latest`；不需要修改页面中的版本号。

## 下载行为与验证

`download.html?arch=x64` 和 `download.html?arch=arm64` 从 `/downloads/latest/releases.json` 获取版本，检查对应文件可用性后自动发起一次下载。正常下载使用版本化地址；错误恢复和未启用 JavaScript 时使用稳定名称地址。页面只能确认已发起请求，不能保证浏览器已开始或完成下载。

发布后检查以下内容：

- 首页和两种架构的下载页正常显示。
- 最新清单和稳定安装包地址返回正常响应，且包含 `Cache-Control: no-store`。
- 安装包大小与清单一致，手动重试及架构切换可用。
- 仅保留当前安装包版本目录。旧页面对应的版本化地址在清理后可能失效，重新打开下载页即可获取最新版；需要旧版时前往 GitHub Releases。

## skill 下载同步

正式 Release 发布后，产品仓库工作流自动将对应标签的 saplink-manager skill 打包并同步到 `/downloads/skills/`，固定下载地址为 `/downloads/skills/latest/saplink-manager.zip`，版本及校验信息见同目录的 `skill.json`。它使用独立版本指针，安装包及 COS 同步保持不变。接收器源码、测试及升级步骤见 [自动同步说明](../automation/README.md#skill-zip-与接收器部署)。

## Skill 优先的产品入口与工作台演示

首页主入口和下载页优先推荐完整 saplink-manager 技能包，安装包保留为次级手动入口。直接访问 download.html 不自动下载 EXE；只有明确指定 arch=x64、arch=arm64 或 arch=auto 时才进入原安装包下载流程。技能导入仍由客户端负责，网页不会执行安装；开始指令可复制，剪贴板不可用时会选中文字供手动复制。

AI 生命周期示意包含确认后安装、SAP 连接配置、当前客户端 MCP 接入、SAP 工作和维护更新。安装意愿及路径需要确认，升级先征得同意，卸载仅响应明确要求；SAP 工作前检查并按需启动 MCP。正式演示不访问 SAP、不执行真实安装或卸载。

首页主视觉使用原 SAP 工作台交互演示，保留理解代码、辅助开发、查询数据三个场景切换。生命周期概念图已从首页移除；Skill 优先获取入口和 AI 全生命周期管理介绍继续保留。

本次官网配套技能包使用已审阅的产品项目技能快照，包含首次下载安装与 SAP 访问前检查 MCP 的规则。版本化 ZIP 位于 dist/assets/saplink-manager-<内容哈希>.zip，assets/saplink-manager.json 记录来源基准提交、未提交修改标记、ZIP 和逐文件 SHA-256；不冒充 GitHub 已发布 Release。页面主按钮指向配套包，避免旧 Release 技能包与新页面功能介绍不一致。产品仓库中 skills/saplink-manager/ 更新后，重新导出并发布官网配套包；原 downloads/skills/latest/ Release 同步路径保持原用途。

快速开始区域恢复为手动配置四步：安装 SapLink、添加 SAP 连接、接入 AI 客户端、开始工作，并链接完整安装指南。
