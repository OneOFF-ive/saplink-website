# GitHub 发布后自动同步安装包

产品仓库负责 Actions 下载与上传，本目录负责服务器接收和版本切换。工作流源码以产品仓库为准：

- [sync-website-downloads.yml](https://github.com/OneOFF-ive/saplink/blob/main/.github/workflows/sync-website-downloads.yml)
- [prepare-website-release.py](https://github.com/OneOFF-ive/saplink/blob/main/.github/scripts/prepare-website-release.py)

工作流在正式 Release 发布后同步两种 Windows 安装包。也支持手动运行，未指定标签时处理最新正式版。它只接受 `vMAJOR.MINOR.PATCH` 格式的正式版本，跳过预发布和已被新版替代的事件。

## 发布与重试

先上传以下两种安装包，再发布正式 Release：

```text
SapLink-<版本号>-win-x64-setup.exe
SapLink-<版本号>-win-arm64-setup.exe
```

两者都需要 GitHub 提供文件大小和 SHA-256 元数据；单个文件不得超过 256 MiB。若先发布再补传文件，工作流会等待约三分钟，超时后需要手动重试。

在 [Actions → Sync website downloads](https://github.com/OneOFF-ive/saplink/actions/workflows/sync-website-downloads.yml) 点击 **Run workflow**；`release_tag` 留空表示最新正式版，也可填写对应的 `v<版本号>`。旧版或预发布不会覆盖当前官网版本。

## 同步流程

1. Actions 等待 x64、ARM64 安装包及其官方 SHA-256 均可用。
2. 下载并核对大小与 SHA-256，通过 SSH 流式上传。
3. 服务器再次向 GitHub 核对正式发布记录，并校验全部文件。
4. 完整版本准备好后，原子替换 `downloads/latest`，再次核对当前安装包，再删除旧版安装包目录及遗留上传临时目录。服务器只保留最新版；历史版本从 GitHub Releases 下载。
5. Actions 检查公网版本清单与稳定下载地址。

重试时服务器先核对已有文件；若两种安装包均与官方 SHA-256 一致，则只传输版本清单，不重复上传安装包。不允许自动降级。上传过程中出现更新的正式版时，旧任务拒绝切换，由新版本的任务继续同步。

## 服务器

- 专用账户：`saplinksync`，无 sudo 或 Docker 权限。
- 仅接受 `check`、`sync` 与 `status` 三个 SSH 命令，禁止终端、端口转发、代理转发及密码登录。
- 接收程序：`/usr/local/lib/saplink-release-sync/receive_release.py`，由 root 管理。
- 下载目录：`/srv/saplink-website/downloads`。
- 专用密钥保存在产品仓库的 Actions Secret `SAPLINK_WEBSITE_SYNC_KEY` 中。个人登录密钥不参与同步。
- 工作流固定校验服务器 SSH 主机公钥；服务器换机或重装更换主机密钥时需要同步更新。

`receive_release.py` 是接收端源代码，`test_receive_release.py` 覆盖完整发布、幂等重试、缺包、篡改、路径穿越、过期任务与降级保护。测试需在 Linux / Python 3.11+ 运行：

```sh
python3 -m unittest discover -s automation -p test_receive_release.py -v
```

## 在未来的自动构建发布流程中调用

GitHub Actions 使用 `GITHUB_TOKEN` 创建的 Release 不会触发另一个 `release` 工作流。在构建流程中，等两种安装包全部上传并发布完成后，追加一个依赖发布任务的 job：

```yaml
sync_website:
  needs: publish
  uses: ./.github/workflows/sync-website-downloads.yml
  with:
    release_tag: ${{ github.ref_name }}
  secrets: inherit
```

其中 `publish` 必须替换为实际发布 job 的 ID。只有在工作流由版本标签触发时，`github.ref_name` 才是所需标签；其他触发方式需传入发布 job 的实际版本标签输出。

直接在 GitHub 发布正式 Release 时，由 `release: published` 触发，无需额外调用。

## 运维与失败处理

| 现象 | 处理方式 |
| --- | --- |
| 缺少某架构或官方 SHA-256 | 等待两个附件上传完成后重试 |
| 大小或 SHA-256 不匹配 | 核对官方附件；同版本已有文件发生变化时需管理员检查 |
| SSH 认证或主机密钥校验失败 | 检查专用 Secret、服务器账户和固定主机公钥 |
| 网络超时 | 重试任务；已验证的安装包会免传 |
| 版本过期或降级被拒绝 | 同步最新正式版，不以自动同步进行回退 |

下载或校验失败时不切换版本，也不清理现有安装包。若切换成功但旧包清理失败，新版仍保持可下载，任务会报告清理失败；重试即可继续清理。接收进程处理取消信号并设置 18 分钟上限，避免异常连接无限期占用同步锁；工作流总时限为 20 分钟。

清理在同步锁内执行，只删除下载目录下符合版本命名规则的真实子目录和遗留上传临时目录，不跟随目录软链接，也不删除当前版本或未知目录。

更新接收端时，由管理员将本目录的程序安装到 `/usr/local/lib/saplink-release-sync/`，保持 root 所有权，并在 Linux 上运行回归测试。单独更新接收程序不需要重启网站容器。网站目录、挂载和下载协议见[部署说明](../docs/deployment.md)。

专用同步账户不能修改自身程序。撤销同步访问时可删除仓库 Secret 并禁用服务器专用账户的公钥。轮换专用密钥时需同时更新服务器公钥与仓库 Secret；不得将私钥或 GitHub 登录令牌写入仓库。
