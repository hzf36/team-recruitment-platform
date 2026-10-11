# Compose 应用 + 数据库容器重建持久化验收

- 时间：2026-10-10  
- Compose 项目目录：`D:\team-recruitment-platform`（项目名 `team-recruitment-platform`）  
- **仅操作本项目服务**，未使用 `docker volume rm` / `compose down -v`

## Compose 服务与卷

| 项 | 值 |
|----|-----|
| 服务 | `db`（postgres:16-alpine）、`app`（本地构建） |
| 命名卷 | `pgdata` → Docker 卷名 `team-recruitment-platform_pgdata` |
| 容器内挂载 | `/var/lib/postgresql/data` |
| 宿主机挂载点 | `/var/lib/docker/volumes/team-recruitment-platform_pgdata/_data` |
| 端口 | `app` 发布 `8080:8080`；`db` 不对外映射 |

配置来源：`docker-compose.yml` 中 `volumes: pgdata:` 与 `db.volumes: - pgdata:/var/lib/postgresql/data`。

## 实际命令（按顺序）

```powershell
$env:PATH = 'C:\Program Files\Docker\Docker\resources\bin;' + $env:PATH
cd D:\team-recruitment-platform

# 1) 确认服务与卷
docker compose config --services    # db, app
docker compose config --volumes     # pgdata
docker volume inspect team-recruitment-platform_pgdata

# 2) 经正常 API 写入独立业务数据 [PERSIST]（见 docs/runs/persist-business-before.json）
#    项目 id=60，bob 申请前端并被 alice 接受

# 3) 记录重建前容器 ID 后移除容器（保留卷；无 -v）
docker compose stop app db
docker compose rm -f app db
docker volume ls --filter name=team-recruitment-platform_pgdata   # 仍在

# 4) 重建启动
docker compose up -d
# 等待 http://localhost:8080/api/health 就绪

# 5) API 对比业务数据 + 重建后新操作（carol 申请测试角色并被拒绝）
```

## 容器 ID（证明 app 与 db 均已重建）

| | 重建前 | 重建后 |
|--|--------|--------|
| **app** | `0883e802d172…4072f` | `acf5b11e8a34…0304a20` |
| **db** | `e6ac46325344…a13a73` | `244de7f73d8d…e1e425` |

- 前后 ID **均不同** → 两个服务容器都已删除并新建。  
- 卷 `team-recruitment-platform_pgdata` 重建前后仍存在，挂载仍为  
  `Source=/var/lib/docker/volumes/team-recruitment-platform_pgdata/_data` → `Destination=/var/lib/postgresql/data`。

原始记录：`docs/runs/persist-container-ids-before.txt`、`persist-container-ids-after.txt`、`persist-db-mounts-*.json`、`persist-inspect-*-*.txt`。

## 业务数据对比（非仅种子）

独立标记：`[PERSIST] db-rebuild-1791644579645`（projectId **60**，applicationId **79**）

| 字段 | 重建前 | 重建后 |
|------|--------|--------|
| 标题 | `[PERSIST] db-rebuild-1791644579645` | 相同 |
| 前端开发 | filled=1 / capacity=1 / remaining=0 | 相同 |
| 测试工程师 | filled=0 / capacity=1 / remaining=1 | 相同 |
| 成员 | alice（发起人）+ bob（前端开发） | 相同 |
| 申请 #79 | accepted，「持久化审核申请」 | 相同 |

对比文件：`docs/runs/persist-business-before.json`、`persist-business-after.json`（`comparison.allMatch: true`）。

## 重建后新业务操作

- carol 对新项目测试角色提交申请 → **201**（appId **80**）  
- alice 拒绝，原因「重建后拒绝验证」→ **200**  
- 列表可见 #79 accepted + #80 rejected  

证明重建后栈可继续读写，不只是种子仍在。

## 专项测试可重复性（同轮）

| 运行 | 命令 | 结果 | 归档 |
|------|------|------|------|
| rerun1 | `ROUND2_RUN_LABEL=rerun1 node scripts/round2-tests.mjs` | **10/10** | `docs/runs/*-rerun1.*` |
| rerun2 | `ROUND2_RUN_LABEL=rerun2 node scripts/round2-tests.mjs` | **10/10** | `docs/runs/*-rerun2.*` |

T4 两次分别使用 `[TMP] T4-full-1791644410369` 与 `[TMP] T4-full-1791644437981`，互不影响。
