# 项目组队与成员招募平台

面向学生实践组队的 Web 应用：编辑个人资料 → 发布项目与招募角色 → 筛选申请 → 发起人审核 → 成员与名额一致。

验收者**只需 Docker**即可构建、启动并完成初始化；业务数据落在 Compose 数据卷中。

## 技术栈

| 层 | 选型 |
|----|------|
| 前端 | Vue 3 + Vue Router + Vite（构建产物由后端同源静态托管） |
| 后端 | Express + TypeScript |
| 数据库 | PostgreSQL 16（Compose 服务 `db`） |
| 认证 | JWT Bearer（`Authorization: Bearer …`），密钥仅服务端 `JWT_SECRET` |

## 环境变量

复制示例后编辑（**不要**把真实密钥提交进仓库）：

```bash
cp .env.example .env
```

| 变量 | 必需 | 说明 |
|------|------|------|
| `JWT_SECRET` | 是 | JWT 签名密钥；`.env.example` 仅为占位字符串 |
| `APP_PORT` | 否 | 宿主机映射端口，默认 `8080` |
| `AUTH_ME_FORCE_ERROR` | 否 | **仅故障探针**。设为如 `500` 时强制 `/api/auth/me` 返回该状态。**普通启动必须留空/不设置** |

Compose 内数据库账号为本地演示用（`team` / `team` / `team_recruitment`），仅容器网络可达，不是外部服务密钥。

## 启动与初始化（Docker）

在**仓库根目录**执行：

```bash
cp .env.example .env
# 编辑 .env：设置 JWT_SECRET=一串本地占位随机串
docker compose up --build -d
```

- 访问地址：http://localhost:8080  
- `docker-compose.yml` **未**设置 `container_name` 或显式卷名；默认卷为「Compose 项目名 + `_pgdata`」。  
- 容器启动时自动：等待数据库就绪 → 迁移 → **幂等**种子（已有用户/同标题种子项目不覆盖、不清库）。

健康检查：`GET http://localhost:8080/api/health` → `{"ok":true}`。

停止（保留数据卷）：`docker compose stop`  
删除栈及卷（会丢数据）：`docker compose down -v`

### 隔离验收（可选）

8080 或卷已被占用时，可用独立项目名、空卷与端口：

```bash
cp .env.example .env.clean-start
# 编辑：JWT_SECRET=… 与 APP_PORT=18080
docker compose -p team-clean-start --env-file .env.clean-start up --build -d
```

访问 http://localhost:18080 ；清理该隔离栈：`docker compose -p team-clean-start --env-file .env.clean-start down -v`。

## 预置测试账号（4 个）

密码均为 `password123`（题目要求的虚构验收账号）。

| 用户名 | 代号 | 用途 |
|--------|------|------|
| alice | 发起人 A | 发布 / 暂停 / 审核；种子项目发起人 |
| bob | 申请人 B | 申请与名额竞争；满员样例中已加入成员 |
| carol | 申请人 C | 第二申请人、竞争、读权限对照 |
| dave | 无关用户 D | 暂停样例中的 pending；权限拒绝对照 |

## 种子示例项目（≥3 种状态）

仅当标题尚不存在时插入一次：

| 标题 | 状态 | 用途 |
|------|------|------|
| `[SEED] 招募中-筛选样例` | 招募中 | 关键词 / 角色 / 技能筛选 |
| `[SEED] 暂停招募样例` | 已暂停 | 禁新申请；pending 仍可审 |
| `[SEED] 已满员样例` | 招募已满 | 禁申请 / 禁接受；pending 不自动通过 |
| `[SEED] 单名额竞争样例` | 余量 1 + 两笔 pending | 并发接受竞争 |

名额：`剩余 = 角色 capacity − 该角色非发起人成员数`；发起人以 `is_owner` 展示且**不占**招募名额；待审核不占名额。

## 测试怎么跑

应用本身的验收路径是浏览器操作。自动化脚本需要 Node 运行时；**不必在宿主机安装 Node**，可用 Compose `test` profile：

```bash
# 栈已 up 后，仅 Docker：
docker compose --profile test run --rm tester
```

该命令在容器内安装 `psql` 客户端，依次执行：

- `scripts/round2-tests.mjs`（真实 HTTP + 读库）  
- `scripts/audit-probes.mjs`（校验 / 筛选 / 权限等探针）

容器内**没有 Docker CLI**，T9（重建 app 容器）会输出 **`SKIP`**，**不计为通过**。完整持久化见 [`docs/verification-persistence.md`](docs/verification-persistence.md)。仅用宿主机 Docker、不装 Node 的复现：

```bash
# 栈已运行且保留 pgdata 卷时：写入标记数据可用浏览器或 API；然后只重建 app+db 容器（不要 -v）
docker compose up -d --force-recreate --no-deps app
docker compose up -d --force-recreate --no-deps db
# 待 healthy 后再次打开原项目/申请，确认仍在
curl -s http://localhost:8080/api/health
```

（更完整的前后对比步骤与结果已写在 `docs/verification-persistence.md`；勿向 tester 挂载 Docker socket。）

若本机另有 Node + Docker CLI，可跑含真实 T9 的完整脚本：

```bash
node scripts/round2-tests.mjs
node scripts/audit-probes.mjs
```

可选环境变量：`APP_BASE`（默认 `http://localhost:8080`）、`ROUND2_RUN_LABEL` / `AUDIT_RUN_LABEL`、`ROUND2_SKIP_T9=1`。

证据索引见 [`docs/acceptance-index.md`](docs/acceptance-index.md)。  
设计说明（状态 / 名额 / 锁 / 权限 / 取舍 / 限制）见上文各节与该索引中的报告链接。

## 申请状态转换

状态：`pending`（待审核）→ `accepted` / `rejected` / `withdrawn`。拒绝或撤回后可**新建**申请，旧记录保留。

| 当前 | 操作 | 条件 | 结果 |
|------|------|------|------|
| 无有效申请 | 申请 | 非发起人、未加入、未暂停、角色有余量、无 pending | → pending |
| pending | 撤回 | 申请人本人 | → withdrawn |
| pending | 拒绝 | 发起人 + 原因 | → rejected |
| pending | 接受 | 发起人、仍有余量、未加入 | → accepted，并插入成员 |
| accepted | 再接受 | 同申请 | 返回「已处理」，不重复占席 |
| rejected/withdrawn | 再申请 | 满足新申请条件 | 新 pending，旧行保留 |

非法/过期操作返回 4xx，并提示状态已变化或名额已满；不自动把他人 pending 改为通过。

## 名额计算

- `filled` = `COUNT(members WHERE role_id = ? AND is_owner = FALSE)`  
- `remaining = max(0, capacity - filled)`  
- 项目 `recruitStatus`：`paused`（开关）优先，否则全部角色 `remaining===0` 则为 `full`，否则 `open`  
- 暂停与满员是不同概念：恢复招募**不能**绕过满员

## 事务与锁策略

写路径（申请 / 接受 / 拒绝 / 撤回）使用数据库事务。固定顺序：

1. `pg_advisory_xact_lock(projectId, userId)` — 同一项目同一用户串行  
2. 相关 `project_roles` / `applications` 行 `FOR UPDATE`  
3. 校验状态、名额、成员唯一约束后更新  

并发接受同一角色最后一席时，靠角色行锁保证最多一人成功，另一请求 409「名额已满」，失败者保持 pending。

## 后端权限（不靠藏按钮）

| 能力 | 规则 |
|------|------|
| 列表 / 详情 / 成员 | 需登录；响应**不含**他人申请正文 |
| 项目全部申请 | 仅发起人 |
| 单条申请正文 | 仅发起人或该申请人 |
| 接受 / 拒绝 / 暂停 / 恢复 | 仅发起人 |
| 撤回 | 仅申请人本人 |

## 架构取舍

- 前后端同镜像同源部署，降低验收环境复杂度  
- 筛选在应用层对列表做 AND / 集合匹配（数据量种子级可接受）  
- 名额以成员表实时计数为准，不用单独「已占用」缓存字段  
- 发布后不提供改名额 / 踢人 / 聊天等题外流程  
- `AUTH_ME_FORCE_ERROR` 仅用于隔离故障探针，默认关闭

## 开源组件与自行实现范围

**依赖（开源）**：Vue 3、Vue Router、Vite、Express、`pg`、`jsonwebtoken`、`bcryptjs`、`zod`、`cors`、PostgreSQL 官方镜像、Node 官方镜像。

**自行实现**：领域模型与迁移、种子数据、申请状态机与并发占席、权限校验、列表筛选语义、Vue 页面与交互、Docker 编排与验收脚本/文档。未使用 UI 组件库；样式为项目内 CSS。

## 已知限制

- 无注册 / 找回密码 / 第三方登录；仅预置账号  
- 发布后不支持调整角色名额或成员退出  
- 角色**名称**筛选为子串；**技能标签**为 trim + 大小写折叠后的集合精确匹配  
- 自动化测试写入 `docs/` 的登录响应对 JWT 做脱敏；请使用预置密码自行登录，勿依赖证据里的 token  
- 浏览器截图反映历史验收时刻的 UI；以当前代码 + `docs/acceptance-index.md` 中标明的「当前有效」报告为准  

## 本地开发（可选，非验收必需）

需本机 Node 与可连的 Postgres，并设置 `DATABASE_URL`、`JWT_SECRET` 后分别启动 `backend` / `frontend` 开发脚本。验收不以该路径为准。
