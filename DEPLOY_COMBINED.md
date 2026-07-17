# TONA + TeamFlow 单实例部署

该仓库现在通过一个网关在同一个 Render Web Service 中运行两个独立产品：

- TONA Agent Studio：`/`
- TeamFlow：`/teamflow/`
- 组合健康检查：`/gateway/health`

## 数据目录

- TONA 保持使用 `DATA_DIR=/var/data`，兼容已有正式数据。
- TeamFlow 使用 `TEAMFLOW_DATA_DIR=/var/data/teamflow`。
- 两个产品共用同一块 Render 持久磁盘，但文件完全分开。

## 必填环境变量

```text
DATA_DIR=/var/data
TEAMFLOW_DATA_DIR=/var/data/teamflow
TEAMFLOW_INITIAL_ADMIN_PASSWORD=设置一个安全密码
REMINDER_TIMEZONE=Asia/Shanghai
REMINDER_HOUR=9
```

飞书提醒可选配置：

```text
TEAMFLOW_FEISHU_REMINDER_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/...
```

## 本地启动

```powershell
npm.cmd start
```

打开：

- TONA：`http://localhost:7357/`
- TeamFlow：`http://localhost:7357/teamflow/`

## 运行机制

`gateway.js` 对外监听平台提供的 `PORT`，内部启动并监督两个 Node 进程。如果一个子应用异常退出，网关会自动重新启动该子应用。Render 关闭或重新部署服务时，网关会把终止信号传递给两个子应用。
