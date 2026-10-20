# COS 发布说明

官网的安装包和技能包现已统一由腾讯云 COS 分发，不再推送到官网服务器。

## 当前自动发布

维护入口在产品仓库：

- [Sync COS downloads 工作流](https://github.com/OneOFF-ive/saplink/blob/main/.github/workflows/sync-cos-downloads.yml)
- [COS 发布脚本](https://github.com/OneOFF-ive/saplink/blob/main/.github/scripts/sync-cos-release.py)
- [运行记录与手动重试](https://github.com/OneOFF-ive/saplink/actions/workflows/sync-cos-downloads.yml)

发布正式版时，工作流校验两种 Windows 安装包，打包该 Release 对应源码的 `saplink-manager/`，上传并验证公开 COS 文件，再切换 `saplink/latest.json`。预发布和过期事件不会覆盖最新正式版。

需要重试时在 Actions 运行 `Sync COS downloads`；`release_tag` 留空处理最新正式版。使用现有仓库 Secrets `COS_SECRET_ID` 和 `COS_SECRET_KEY`，官网服务器和前端均不需要这些凭据。

官网仅通过 Caddy 转发公开版本清单，浏览器从 COS 直接下载安装包和技能包。部署路径、兼容链接和备用版本见 [部署文档](../docs/deployment.md)。

## 官网同步退役

旧官网 SSH 上传工作流、接收器及其测试已从两个项目源码移除。官网不再接收安装包或技能 ZIP；服务器历史文件和回滚备份保留，此次源码清理不删除它们。

维护发布功能时只修改产品仓库的 COS 工作流与脚本，不重新启用旧官网上传。
