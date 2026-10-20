# 部署与版本管理

## 访问与运行

官网同时支持 `http://118.89.185.57`、`http://saplink.cloud` 和 `https://saplink.cloud`。HTTP 不强制跳转，www 域名也保持访问者选择的协议。浏览器此前缓存的 301 或 HTTPS 优先设置可能仍会升级协议。

生产环境为 Docker 中的 Caddy，容器 `saplink-website`，主机 TCP `80:8080`、`443:8443`，使用 `unless-stopped`、只读文件系统、非 root 用户 `1000:1001`、临时 `/data` 和日志轮转。站点根目录只挂载网页文件，**不再挂载安装包或技能包目录**。

## COS 下载

安装包和技能包统一从以下存储桶的 HTTPS 地址直接下载：

```text
https://saplink-1302377695.cos.ap-shanghai.myqcloud.com
└── saplink/
    ├── latest.json
    └── v<版本号>/
        ├── SapLink-<版本号>-win-x64-setup.exe
        ├── SapLink-<版本号>-win-arm64-setup.exe
        ├── SapLink-<版本号>-skill.zip
        └── 对应的 .sha256 校验文件
```

官网 `/releases.json` 仅反向代理 COS 的 `saplink/latest.json`，响应禁用缓存；它不保存或转发二进制文件。这样无须给桶添加浏览器跨域读取权限。`/downloads/latest/releases.json` 为同一清单的兼容入口，返回 COS 的 `schema_version: 1` 格式。

`dist/download-source.js` 校验清单版本、两种架构、SHA-256 格式和技能包大小，并限定文件 URL 必须属于上述桶及对应版本目录。安装包只读取 `/releases.json`；技能包独立读取 `/skill-releases.json`（代理 COS 的 `saplink/skill-latest.json`），两个请求分别缓存，技能元数据异常不阻断安装包下载。下载页按用户选择的架构直接向 COS 发起下载；不通过跨域 HEAD 检查文件，避免缺少 CORS 时阻断正常下载。

页面只能确认已向浏览器发起请求，不保证下载已开始或完成；文件大小和内容 SHA-256 校验由产品的 COS 发布工作流执行，网页不会声称自己已校验整个安装包。

正常访问自动跟随 COS 最新版本。安装包元数据读取失败时，明确提示稍后重试或前往 GitHub 官方发布页，不自动降级下载旧版。技能包的 HTML 链接保留已核验的 COS `v1.0.4`，页面读取清单后自动替换为最新技能包。未启用 JavaScript 的安装包链接也可使用已核验的 COS `v1.0.4`，后续可更新固定入口。

旧的稳定安装包地址与技能包地址以临时 302 跳转到官网对应选择区域，再通过最新 COS 清单获取文件；其他旧 `/downloads/` 路径返回 410。

## 自动发布与旧服务退役

产品仓库的 [Sync COS downloads](https://github.com/OneOFF-ive/saplink/actions/workflows/sync-cos-downloads.yml) 在正式版发布后校验并上传两种安装包及对应 Release 源码生成的技能 ZIP，确认公开下载正确后才切换 `latest.json`。以后发布版本无需把文件推到官网服务器。

旧的 `Sync website downloads` 工作流已停用，服务器 `saplinksync` 的专用授权公钥已移至受保护的备份目录，禁止继续上传。旧上传工作流和接收器源码已删除，`automation/` 仅保留 COS 发布说明；服务器旧文件与旧容器保留用于回滚，但新站点不会读取它们。不要重新启用旧流程或执行接收器安装脚本。

## 页面部署

```text
/srv/saplink-website/
├── releases/<发布标识>/     网页文件，不含安装包或技能 ZIP
├── current -> releases/...  当前网页版本标记
├── configs/                Caddy 运行配置
├── certs/                  HTTPS 证书与私钥
├── deployment-info.txt     实际容器部署记录
└── downloads/              旧下载文件归档，不再挂载和更新
```

1. 检查脚本语法并运行下载测试。
2. 将 `dist/` 复制到新的发布目录，不上传 EXE、技能 ZIP 或凭据。
3. 以新网页目录、新 Caddyfile 和只读证书目录启动候选容器；不挂载旧 `downloads/`。
4. 验证版本清单、首页、技能包 COS 链接、x64／ARM64 自动下载及旧链接跳转。
5. 保留旧容器后切换正式容器，更新 `current` 和部署记录；失败时恢复旧容器。

只修改 `current` 链接不会改变运行中容器的挂载，完整页面切换需要重建容器。

## 证书

证书链为 `/srv/saplink-website/certs/fullchain.pem`，私钥为同目录 `privkey.pem`，只读挂载到 `/etc/caddy/certs`。目录为 `root:1001 750`，文件为 `root:1001 640`，不得放在站点根目录或 Git 中。

当前证书到期：**2027-01-14 23:59:59 UTC**，即 Asia/Irkutsk 的 **2027-01-15 07:59:59**。手动证书不会自动续期，需在到期前重新签发、核对域名与私钥、替换文件并重启容器。

## 本地预览

使用 `npm run dev`，预览服务同样从 COS 获取清单，下载文件直接指向 COS；不再读取 `local/downloads/`。离线时可以查看页面，技能包保留已核验的 COS 链接，安装包提示稍后重试或访问 GitHub 官方发布页。

为兼容已发布旧客户端，COS latest.json 只保留 schema_version、version、published_at、downloads；技能元数据独立放在 skill-latest.json。修复线上旧清单时，在产品仓库 Sync COS downloads 手动运行中勾选 repair_metadata，先备份再迁移，不修改二进制。
