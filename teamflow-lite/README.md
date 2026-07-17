<div align="center">
  <img src="public/icons/icon-192.png" width="96" alt="TeamFlow App 图标">
  <h1>TeamFlow</h1>
  <p>面向小团队的轻量成员、需求、任务与提醒管理 App</p>
</div>

TeamFlow 适合 3–10 人内部团队使用。它把成员权限、产品需求、需求分析、任务拆解、时间节点和主动提醒集中在一个简洁的工作空间里。

它既可以作为网页使用，也可以安装到 iPhone、Android、Windows 和 macOS 桌面，以独立 App 窗口运行。

## TeamFlow 能做什么

### 团队成员与权限

- 新增和编辑团队成员
- 修改姓名、岗位、邮箱和密码
- 设置负责人、管理员、成员、只读成员
- 停用、恢复或删除成员账号
- 删除成员前自动检查其负责的需求和任务
- 将原有工作转交给其他成员后再安全删除

### 产品需求与研发管理

- 提出产品需求并记录背景和目标
- 设置类型、优先级、负责人和目标日期
- 管理待评审、已排期、进行中、已完成等状态
- 为需求设置评审、验收、上线等时间节点
- 在需求详情中查看任务完成进度

### 独立需求分析

将客户反馈、会议记录或一段原始想法粘贴到“需求分析”，TeamFlow 可以生成：

- 需求标题和问题定义
- 目标与非目标
- 用户故事
- 验收标准
- 风险与依赖
- 待澄清问题
- 建议里程碑
- 建议任务和优先级

分析完成后，可以一键转为正式需求，并同时生成关联任务。未配置模型时使用本地结构化分析；配置 OpenAI 兼容模型后会自动使用模型分析。

### 团队任务

- 任务看板
- 任务负责人和截止日期
- P0–P3 优先级
- 待开始、进行中、待验收、已完成状态
- 任务与产品需求关联
- 团队成员只更新自己负责的任务

### 提醒与追踪

- 每 15 分钟扫描即将到期和已经逾期的任务、节点
- 按设定时区和时间主动推送提醒
- 支持飞书群机器人 Webhook
- 支持通用 JSON Webhook
- 同一事项每天最多成功推送一次
- 在“提醒追踪”中查看待跟进事项、发送记录和失败原因
- 团队负责人可以手动立即检查并推送

### 可安装 App

- Android、iPhone、Windows、macOS 均可安装
- 独立 App 图标和窗口
- 自动更新
- 基础离线页面
- 网络离线和恢复提示
- App 内系统通知

> 后台飞书/Webhook 提醒由服务器持续执行，即使手机没有打开 TeamFlow 也可以收到。App 系统通知目前用于打开 App 时提示待跟进事项。

## 使用方式

### 方式一：使用团队线上地址

管理员部署完成后，会提供类似下面的地址：

```text
https://your-teamflow.onrender.com
```

使用者只需要：

1. 打开团队地址。
2. 使用管理员分配的邮箱和密码登录。
3. 在电脑上直接使用，或安装到手机桌面。

### 方式二：从 GitHub 下载并在本机运行

需要安装 Node.js 18 或更高版本。

#### 下载 ZIP

1. 在 GitHub 仓库页面点击 **Code**。
2. 点击 **Download ZIP**。
3. 解压下载的文件。
4. 在解压目录中打开 PowerShell。

Windows PowerShell 执行：

```powershell
npm.cmd start
```

macOS 或 Linux 执行：

```bash
npm start
```

然后打开：

```text
http://localhost:7360
```

#### 使用 Git 克隆

```bash
git clone https://github.com/cexufu/team-flow.git
cd team-flow
npm start
```

Windows PowerShell 如果禁止运行 `npm.ps1`，请使用：

```powershell
npm.cmd start
```

也可以直接启动：

```powershell
node server.js
```

## 首次本地登录

首次运行会创建演示数据和以下账号：

| 角色 | 邮箱 | 初始密码 |
| --- | --- | --- |
| 团队负责人 | `admin@team.local` | `teamflow123` |
| 管理员 | `product@team.local` | `product123` |
| 团队成员 | `dev@team.local` | `dev12345` |

这些账号只用于本地体验。正式部署时请设置新的管理员密码，并及时修改或停用演示账号。

## 手机安装

### Android

1. 使用 Chrome 或 Edge 打开团队线上地址。
2. 点击页面中的“安装 App”。
3. 或打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。
4. 确认后，TeamFlow 图标会出现在手机桌面。

### iPhone / iPad

1. 使用 Safari 打开团队线上地址。
2. 点击底部“分享”按钮。
3. 选择“添加到主屏幕”。
4. 点击右上角“添加”。

### Windows / macOS

使用 Chrome 或 Edge 打开 TeamFlow，点击页面中的“安装 App”或地址栏右侧的安装图标。

更详细的安装说明和 PWA/原生 App 对比请查看 [PWA 安装指南](PWA_INSTALL.md)。

> 手机安装需要 HTTPS 线上地址。电脑上的 `localhost` 地址不能直接提供给其他成员手机使用。

## 建议的团队使用流程

1. 负责人创建团队成员并分配角色。
2. 成员在“需求分析”中整理原始需求。
3. 将分析结果转为正式产品需求。
4. 管理员确认负责人、优先级和目标日期。
5. 拆解任务并设置里程碑。
6. 成员在任务看板更新进度。
7. 团队通过提醒追踪和飞书通知处理到期事项。
8. 完成验收后，将需求状态更新为“已完成”。

## 角色权限

| 能力 | 负责人 | 管理员 | 成员 | 只读成员 |
| --- | :---: | :---: | :---: | :---: |
| 管理团队设置 | ✓ |  |  |  |
| 新增、编辑和删除成员 | ✓ | ✓ |  |  |
| 管理全部需求和任务 | ✓ | ✓ |  |  |
| 提出和分析需求 | ✓ | ✓ | ✓ |  |
| 更新本人负责的任务 | ✓ | ✓ | ✓ |  |
| 查看团队内容 | ✓ | ✓ | ✓ | ✓ |
| 手动执行提醒推送 | ✓ |  |  |  |

团队负责人不能被删除，当前登录账号不能删除自己。有关联工作的成员必须先选择接手人。

## 管理员部署到 Render

仓库根目录的 `render.yaml` 已包含：

- Node Web Service
- `/api/health` 健康检查
- 1GB 持久磁盘
- `/var/data` 数据目录
- 提醒时区和发送时间
- 飞书提醒环境变量

在 Render 中使用 Blueprint 连接下面的仓库：

```text
https://github.com/cexufu/team-flow
```

需要配置：

```text
DATA_DIR=/var/data
INITIAL_ADMIN_PASSWORD=设置一个安全密码
FEISHU_REMINDER_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/...
APP_PUBLIC_URL=https://你的-TeamFlow-地址.onrender.com
REMINDER_TIMEZONE=Asia/Shanghai
REMINDER_HOUR=9
```

如果不使用飞书，可以设置通用 Webhook：

```text
REMINDER_WEBHOOK_URL=https://你的服务地址/notify
```

为了保证数据保存和定时提醒，请使用持续运行并支持持久磁盘的实例。会休眠且没有持久磁盘的免费实例不适合正式团队数据。

## 可选：启用模型需求分析

TeamFlow 默认不依赖外部模型。要启用 OpenAI 兼容模型，设置：

```text
ANALYSIS_API_KEY=你的 API Key
ANALYSIS_BASE_URL=https://api.openai.com/v1
ANALYSIS_MODEL=gpt-4.1-mini
```

如果模型不可用、超时或返回格式错误，系统会自动回退到本地结构化分析。

## 数据存储与备份

- 默认数据文件：`data/teamflow.json`
- 可通过 `DATA_DIR` 修改数据目录
- 每次保存使用临时文件原子替换
- 上一个数据版本保存在 `teamflow.json.bak`
- 正式部署必须使用持久磁盘
- `.gitignore` 会阻止本地团队数据被提交到 GitHub

## 检查与测试

```powershell
npm.cmd run check
npm.cmd test
```

测试覆盖：

- 登录与角色权限
- 成员新增、编辑、删除和工作转移
- 需求分析和需求转换
- 任务与工作台
- Webhook 主动提醒和每日去重
- 提醒追踪与数据库备份
- 4 个账号、40 次并行写入
- PWA 清单、图标、离线页面和 Service Worker

## 技术要求

- Node.js 18 或更高版本
- 无外部运行时依赖
- 现代 Chrome、Edge 或 Safari
- 正式环境需要 HTTPS

## 仓库

- GitHub：[cexufu/team-flow](https://github.com/cexufu/team-flow)
- 安装指南：[PWA_INSTALL.md](PWA_INSTALL.md)
- 部署配置：[render.yaml](render.yaml)
