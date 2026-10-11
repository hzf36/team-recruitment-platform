# 从零部署隔离验收（Clean Start）

- 时间：2026-10-10  
- 目的：在**独立 Compose 项目名、新空卷、未占用端口**下按 README 完成 Docker 构建/启动/迁移/种子，并做浏览器发布→申请→接受  
- **未改动**默认栈 `team-recruitment-platform`（8080 / `team-recruitment-platform_pgdata`）中的业务数据  

## 配置安全检查（误连防护）

| 检查项 | 结果 |
|--------|------|
| `container_name` | **未设置**（容器名随项目名变化） |
| 显式卷名（如 `name: xxx`） | **未设置**；卷为项目前缀 + `_pgdata` |
| 默认栈 | `team-recruitment-platform-*`，端口 **8080**，卷 `team-recruitment-platform_pgdata` |
| 隔离栈 | `team-clean-start-*`，端口 **18080**，卷 `team-clean-start_pgdata` |

为支持隔离验收，本轮对配置/文档做了最小补充（否则无法在 8080 已被占用时按 README 从零起栈而不冲突）：

1. `docker-compose.yml`：`ports` 改为 `"${APP_PORT:-8080}:8080"`（默认仍为 8080）  
2. `README.md`：增加「隔离验收」步骤（`-p team-clean-start`、`--env-file .env.clean-start`、`APP_PORT`）  
3. `.gitignore`：忽略 `.env.clean-start`  
4. `.env.example`：仍为占位 `JWT_SECRET=replace-with-a-long-random-string`（**无真实密钥**）  
5. 浏览器验收中发现：详情页硬刷新时若 `auth` 未就绪，发起人申请列表为空 → 在 `ProjectDetailView` 的 `load` 中于 `authState.loaded` 前先 `refreshMe()`（无新功能）

## 实际命令

```powershell
$env:PATH = 'C:\Program Files\Docker\Docker\resources\bin;' + $env:PATH
cd D:\team-recruitment-platform

Copy-Item .env.example .env.clean-start
# .env.clean-start 内容：
#   JWT_SECRET=clean-start-local-placeholder-not-a-production-secret
#   APP_PORT=18080

docker compose -p team-clean-start --env-file .env.clean-start up --build -d
# 访问 http://localhost:18080
```

中间产物：`docs/runs/clean-start-up.log`、`clean-start-app-logs.txt`、`clean-start-ps.txt`、`clean-start-volume-inspect.json`。

## 初始化日志要点

`team-clean-start-app-1` 日志（空卷首次启动）：

- `Applied migration 001_init.sql`  
- `Seeded user: alice / bob / carol / dave`  
- `Seeded project: [SEED] 招募中-筛选样例`  
- `Seeded project: [SEED] 暂停招募样例`  
- `Seeded project: [SEED] 已满员样例`  
- `Seeded project: [SEED] 单名额竞争样例`  
- `App listening on :8080`（容器内端口；宿主机映射 **18080**）  

健康检查：`GET http://localhost:18080/api/health` → `{"ok":true}`  
同时默认栈 `GET http://localhost:8080/api/health` 仍为 ok。

## 示例数据核对（空卷种子）

`docker compose -p team-clean-start --env-file .env.clean-start exec -T db psql …`

| 核对项 | 结果 |
|--------|------|
| 账号 ≥4 | `alice,bob,carol,dave`（登录均 200） |
| 招募中 | `[SEED] 招募中-筛选样例` → open；前端余 2/2、测试余 1/1；成员仅发起人 1 |
| 暂停 | `[SEED] 暂停招募样例` → paused |
| 满员 | `[SEED] 已满员样例` → full；后端 capacity=1、filled=1、pending=1（carol） |
| 竞争场景 | `[SEED] 单名额竞争样例`：capacity=1、filled=0、**pending=2（bob,carol）** |
| 人数一致 | 满员样例 members=2（1 owner + 1 recruit）；竞争样例 members=1（仅 owner，招募成员 0） |

原始输出：`docs/runs/clean-start-seed-*.txt`、`clean-start-api-seed-check.json`。

## 浏览器流程（隔离环境 18080）

1. `alice` 登录 → 发布 `[CLEAN] 从零发布验收`（项目 id=5）→ 发起人在成员名单且不占名额；前端/测试剩余均为 1  
2. `bob` 登录 → 申请「前端开发」→ 提示申请已提交（DB：`applications.id=5` pending）  
3. `alice` 打开项目 → **接受** →  
   - 前端：已加入 **1** / 上限 1 / 剩余 **0**  
   - 成员：alice（发起人）+ bob（前端开发）  
   - 申请 #5：**已通过**  

截图：

- `docs/screenshots/clean-01-alice-published.png`（及 `D:\screenshots\`）  
- `docs/screenshots/clean-02-after-accept-members.png`  

## 隔离结论

| 项 | 默认环境（保留） | 隔离验收环境 |
|----|------------------|--------------|
| Compose 项目 | `team-recruitment-platform` | `team-clean-start` |
| 端口 | 8080 | 18080 |
| 数据卷 | `team-recruitment-platform_pgdata` | `team-clean-start_pgdata`（新建空卷） |
| 验收后状态 | 仍在运行，数据未清空 | 仍在运行；可用 README 中的 `down -v` **仅**清理该项目 |

停止隔离栈（保留其卷）：

```powershell
docker compose -p team-clean-start --env-file .env.clean-start stop
```
