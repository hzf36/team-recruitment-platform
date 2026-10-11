# 需求与代码复核（Requirements Audit）

- 更新时间：2026-10-11（UTC+8）
- 对照来源：考核题目全文 + ZIP《题目7-组队申请与名额用例》（`recruitment-rules.md` / `test-cases.csv` 等）
- 复核对象：当前仓库代码 + 默认 Compose `http://localhost:8080`
- 原则：不以旧 PASS 代替当前版本结果；当场无证据标「待验证」

---

## 本轮（2026-10-11）收尾：遗留项与回归

### 修改摘要

| 项 | 修改 | 原因 |
|----|------|------|
| 技能筛选 | 标签集合匹配：`trim` + 大小写折叠后 **精确相等** 再做全部包含；禁止 `Java` 命中 `JavaScript` | 题目/附件要求技能「全部包含」指同一角色上的标签集合，非子串 |
| 角色技能必填 | 后端 `skillRequirements.min(1)`（trim 后非空）；前端提示与 `required` | 「每个角色明确…技能要求」 |
| 非 401 身份失败 | 保留 token；`authState.error` +「重试加载身份」；`ProfileView`/`MyApplicationsView`/`ProjectDetailView` watch 身份恢复后清错并回填 | 故障恢复无需重登 |
| 测试注入 | `AUTH_ME_FORCE_ERROR`（仅隔离栈）；恢复后清空并 `down -v` | 浏览器实机验证，非只读代码 |

技能匹配文档见 `README.md`「列表筛选规则」。

### 非 401 故障实机结果（隔离栈）

证据：`docs/runs/auth-fault-browser-20261011.md`

1. `-p team-auth-fault`，`APP_PORT=18081`，`AUTH_ME_FORCE_ERROR=500`
2. 有效 JWT 下 `/api/auth/me` → **500**；浏览器 `/profile`：错误文案 +「凭证仍保留」；`tokenLen=164`；无「退出」
3. 换 `.env.auth-fault.restored` 重建 app（无故障变量）；`/me` → **200**
4. 点击「重试加载身份」：错误消失，资料字段回填，导航显示 Alice
5. 修改简介并保存 →「资料已保存」，仍保持登录
6. `docker compose -p team-auth-fault … down -v`；默认 8080 栈 `AUTH_ME_FORCE_ERROR` 为空

### 当前版本回归（不得用旧报告顶替）

| 套件 | 结果 | 证据 |
|------|------|------|
| `audit-probes` | **9/9 PASS** | `docs/runs/audit-probes-final-20261011.json`（及当前 `docs/runs/audit-probes.json`） |
| `round2-tests` | **10/10 PASS** | `docs/runs/verification-round2-final-20261011.md`、`docs/runs/round2-raw-responses-final-20261011.json`；当前 `docs/verification-round2.md` |

旧报告保留示例：`docs/runs/verification-round2-pre-final-20261011.md`、`audit-probes-pre-final-20261011.json`、`*-regression-20261011.*` 等。

---

## 逐项验收矩阵（当前结论）

图例：**通过** / **失败** / **未验证**

### 1. 权限与正文

| 需求 | 实现 | 证据 | 结论 |
|------|------|------|------|
| 写操作/读申请正文后端校验归属 | `requireAuth` + owner/applicant 检查 | T7；L1；bob 读他人正文 403 | **通过** |
| 列表/详情/成员不泄露正文 | `loadProjectDetail` 无 reason | L1 | **通过** |

### 2. 并发与状态

| 需求 | 实现 | 证据 | 结论 |
|------|------|------|------|
| 接受原子 + 名额 | advisory + role/app `FOR UPDATE` | T5/T6 | **通过** |
| 撤回∥接受 | 同 advisory | R1 | **通过** |
| 暂停/满员规则 | pause 开关与 filled 分离 | T3/T4 | **通过** |

### 3. 发布校验

| 需求 | 实现 | 证据 | 结论 |
|------|------|------|------|
| 标题/目标/进展/成果非空（trim） | Zod + 前端 | V1/V2 | **通过** |
| 人数上限正整数 | `int().min(1)` | V3 | **通过** |
| 角色技能非空（非仅字段存在） | `skillRequirements.min(1)` | V5（空数组/空白/缺失 400；合法 201） | **通过** |
| 角色不属于项目 | role+project 联查 | V4 | **通过** |

### 4. 资料快照

| 需求 | 实现 | 证据 | 结论 |
|------|------|------|------|
| 提交时快照；改资料不覆盖 | snapshot_* 列 | T8（final 回归） | **通过** |

### 5. 筛选与名额

| 需求 | 实现 | 证据 | 结论 |
|------|------|------|------|
| 关键词∧同角色∧技能集合全部包含；trim/大小写；非子串 | Set + normalizeTag | T1、F1（含 Java⊄JavaScript） | **通过** |
| 状态与真实名额一致 | filled/remaining | SEED；详情页 | **通过** |

### 6. 身份初始化（refreshMe）

| 需求 | 实现 | 证据 | 结论 |
|------|------|------|------|
| 非 401：保留凭证 + 明确错误 + 恢复后重试成功并可保存 | auth/App/Profile watch | `auth-fault-browser-20261011.md` | **通过** |
| 401：清除登录 | `setToken(null)` | 无效 token → `/login`、token=null（隔离栈曾测） | **通过** |
| 发起人直开/刷新详情见申请与操作 | `ProjectDetailView` + refreshMe | 此前浏览器；本收尾以故障恢复+回归为主 | **通过**（接口+历史 UI；本收尾未再截 ignoreCache 硬刷新） |

### 7. Docker / 脚本 / README

| 需求 | 实现 | 证据 | 结论 |
|------|------|------|------|
| 无固定 container_name/显式卷名；脚本相对路径 | compose + `import.meta.url` | 文件核对；clean-start 文档 | **通过** |
| README 筛选/技能语义与代码一致 | README 集合匹配说明 | 与 `projects.ts` 一致 | **通过** |
| 故障注入不残留默认环境 | 默认栈 `AUTH=[]`；fault `down -v` | 本轮 teardown | **通过** |

---

## 未验证 / 已知限制

1. 本收尾轮次**未再次**用 ignoreCache 硬刷新截图存档发起人详情（功能仍在；以 final 回归与故障恢复浏览器证据为主）。
2. `AUTH_ME_FORCE_ERROR` 为测试用环境变量，正常部署勿设置（默认空）。
3. 角色名筛选仍为大小写不敏感**子串**（「前端」命中「前端开发」）；仅技能标签改为集合精确匹配。

---

## 历史修复（2026-10-10，仍有效）

空白标题、空进展/成果、README 绝对路径、TEAM-08 撤回∥接受探针等，见上一版记录；夹具合法化说明不变——**未放宽断言**，仅为匹配收紧后的合法请求体。
