# 验收证据索引

本题验收项 → **当前有效**证据（仓库内相对路径）。历史报告单独列出，**不能**当作当前版本结果。

截图均在 [`docs/screenshots/`](./screenshots/)，不依赖仓库外目录。

---

## 题目验收条件对照

| 验收项 | 通过条件（摘要） | 当前有效证据 |
|--------|------------------|--------------|
| 项目发布与查找 | 发布角色/名额；关键词+角色+技能筛选；详情含目标/技能/进展/余量 | API：[`runs/verification-round2-final-20261011.md`](./runs/verification-round2-final-20261011.md) **T1**；探针：[`runs/audit-probes-final-20261011.json`](./runs/audit-probes-final-20261011.json) **F1**；UI 截图：[`screenshots/01-project-list-ui.png`](./screenshots/01-project-list-ui.png)、[`screenshots/r4-02-list-desktop-open-full-roles.png`](./screenshots/r4-02-list-desktop-open-full-roles.png)、[`screenshots/r4-06-create-form.png`](./screenshots/r4-06-create-form.png) |
| 申请规则 | 提交/撤回；禁自申请/重复 pending/满员或暂停；拒绝后重申保留旧记录 | **T2/T3/T4/T6**（同上 final round2）；UI：[`browser-verification.md`](./browser-verification.md) 节 A + [`screenshots/04-my-applications-reject-history.png`](./screenshots/04-my-applications-reject-history.png)、[`screenshots/r4-05-my-apps-status-time.png`](./screenshots/r4-05-my-apps-status-time.png) |
| 审核生效 | 接受后成员与名额同步；拒绝可见原因；未通过不进成员 | **T2/T4/T6**；UI：[`screenshots/03-owner-review-ui3.png`](./screenshots/03-owner-review-ui3.png)、[`screenshots/08-bob-history-reject-reason.png`](./screenshots/08-bob-history-reject-reason.png) |
| 名额一致性 | 最后 1 席并发接受最多 1 人；重复接受不双占；失败有原因 | **T5/T6**；过期页反馈：[`screenshots/05-stale-tab-capacity-full.png`](./screenshots/05-stale-tab-capacity-full.png)、[`screenshots/r4-01-conflict-sync-error-kept.png`](./screenshots/r4-01-conflict-sync-error-kept.png)（并发正确性以 T5 为准） |
| 招募状态 | 暂停禁新申请、恢复可继续；满员与真实余量一致 | **T3/T4**；[`screenshots/07-paused-with-members.png`](./screenshots/07-paused-with-members.png)、[`screenshots/09-full-seed-after-refresh.png`](./screenshots/09-full-seed-after-refresh.png) |
| 权限与数据保存 | 非发起人不能审核；他人正文不可读；重建容器（保留卷）数据仍在 | **T7**；探针 **L1/A1**；持久化：[`verification-persistence.md`](./verification-persistence.md)；从零隔离：[`verification-clean-start.md`](./verification-clean-start.md) + [`screenshots/clean-01-alice-published.png`](./screenshots/clean-01-alice-published.png)、[`screenshots/clean-02-after-accept-members.png`](./screenshots/clean-02-after-accept-members.png) |
| Docker 与体验 | README 可启动；发布→申请→审核可操作 | README；clean-start 文档；浏览器记录 [`browser-verification.md`](./browser-verification.md) |

补充：需求矩阵 [`requirements-audit.md`](./requirements-audit.md)；身份非 401 故障恢复 [`runs/auth-fault-browser-20261011.md`](./runs/auth-fault-browser-20261011.md)；撤回∥接受 **R1** 见 audit-probes final。

---

## 当前有效报告（以本文件日期为准）

| 文件 | 说明 |
|------|------|
| [`verification-round2.md`](./verification-round2.md) | 当前工作区最新 round2 摘要（与 final 归档同步生成） |
| [`round2-raw-responses.json`](./round2-raw-responses.json) | 对应原始 HTTP 记录（JWT 已脱敏为 `[REDACTED_JWT]`） |
| [`runs/verification-round2-final-20261011.md`](./runs/verification-round2-final-20261011.md) | **标注的当前有效** round2 归档（10/10） |
| [`runs/round2-raw-responses-final-20261011.json`](./runs/round2-raw-responses-final-20261011.json) | 同上原始输出 |
| [`runs/audit-probes-final-20261011.json`](./runs/audit-probes-final-20261011.json) | **标注的当前有效** 探针（9/9） |
| [`runs/audit-probes.json`](./runs/audit-probes.json) | 最近一次探针输出 |
| [`verification-persistence.md`](./verification-persistence.md) | app+db 重建保留卷（compose `tester` 内 round2 会跳过 T9，以此文档与宿主机完整 round2 为准） |
| [`verification-clean-start.md`](./verification-clean-start.md) | 独立项目名/空卷/端口 |
| [`browser-verification.md`](./browser-verification.md) | 浏览器纯 UI 流程与截图表 |
| [`requirements-audit.md`](./requirements-audit.md) | 题目/ZIP 对照矩阵 |

原始响应中的 `token` 字段均为 `[REDACTED_JWT]`；登录请用 README 预置账号。

---

## 历史报告（勿当作当前结论）

| 文件 | 备注 |
|------|------|
| [`runs/verification-round2-rerun1.md`](./runs/verification-round2-rerun1.md) / [`rerun2`](./runs/verification-round2-rerun2.md) | 早期回归 |
| [`runs/verification-round2-regression-20261011.md`](./runs/verification-round2-regression-20261011.md) | 技能集合匹配修复后中间回归 |
| [`runs/verification-round2-pre-audit.md`](./runs/verification-round2-pre-audit.md) 等 `pre-*` / `pre-final-*` | 归档快照 |
| [`runs/audit-probes-regression-20261011.json`](./runs/audit-probes-regression-20261011.json) 等 | 探针历史 |
| [`round1-verification.md`](./round1-verification.md) | 第 1 轮接口烟测 |

对应 `round2-raw-responses-*.json` 同属历史。

---

## 截图目录（仓库内）

路径前缀：`docs/screenshots/`。

| 文件 | 用途 |
|------|------|
| `01-project-list-ui.png` | 列表 |
| `02-project-detail-ui2.png` | UI2 详情 |
| `03-owner-review-ui3.png` | 发起人审核 |
| `04-my-applications-reject-history.png` | 拒绝原因与历史 |
| `05-stale-tab-capacity-full.png` | 过期页名额已满 |
| `r4-01-conflict-sync-error-kept.png` | 冲突后保留错误 |
| `r4-02`～`r4-07-*.png` | 列表/窄屏/申请/发布/资料 |
| `clean-01-alice-published.png` / `clean-02-after-accept-members.png` | 从零隔离浏览器流程 |
| `01-alice-project-list.png` 等 `0x-*.png`、`ui2-*.png` | 补充 UI 证据 |

---

## 关键场景（≥3）速查

1. **并发最后一席**：final round2 **T5**  
2. **暂停与恢复**：**T3** + 截图 `07-paused-with-members.png`  
3. **权限与正文不可见**：**T7** + audit **L1**  
4. （补充）**撤回后重申 / 拒绝原因**：**T2** + 浏览器节 A  
