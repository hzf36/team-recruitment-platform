/**
 * Round-2 acceptance tests against a LIVE Docker stack.
 *
 * Host (needs Node + Docker CLI):
 *   node scripts/round2-tests.mjs
 *
 * Docker-only (no host Node; compose profile `test`):
 *   docker compose --profile test run --rm tester
 *
 * When PGHOST is set, SQL uses local `psql` (container tester).
 * Otherwise SQL uses `docker compose exec db psql` on the host.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.APP_BASE || "http://localhost:8080";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_MD = path.join(ROOT, "docs", "verification-round2.md");
const OUT_JSON = path.join(ROOT, "docs", "round2-raw-responses.json");
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

const results = [];
const rawLog = [];

function redactSecrets(value) {
  return JSON.parse(JSON.stringify(value).replace(JWT_RE, "[REDACTED_JWT]"));
}

function sh(cmd, args) {
  return execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

function sql(query) {
  if (process.env.PGHOST) {
    const out = execFileSync(
      "psql",
      ["-At", "-F", "|", "-v", "ON_ERROR_STOP=1", "-c", query],
      {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        env: process.env,
      },
    );
    return out.trim();
  }
  const out = sh("docker", [
    "compose",
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    "team",
    "-d",
    "team_recruitment",
    "-At",
    "-F",
    "|",
    "-c",
    query,
  ]);
  return out.trim();
}

async function req(method, urlPath, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  const entry = redactSecrets({
    method,
    path: urlPath,
    status: res.status,
    requestBody: body ?? null,
    response: json,
  });
  rawLog.push(entry);
  return { method, path: urlPath, status: res.status, requestBody: body ?? null, response: json };
}

function record(id, title, pass, evidence) {
  const skipped = evidence?.skipped === true;
  results.push({ id, title, pass: skipped ? null : pass, skipped, evidence });
  const label = skipped ? "SKIP" : pass ? "PASS" : "FAIL";
  console.log(`${label} ${id} ${title}`);
  if (!pass && !skipped) console.log(JSON.stringify(evidence, null, 2));
}

async function login(username) {
  const r = await req("POST", "/api/auth/login", {
    body: { username, password: "password123" },
  });
  if (r.status !== 200) throw new Error(`login failed for ${username}`);
  return r.response.token;
}

async function main() {
  const health = await req("GET", "/api/health");
  if (health.status !== 200 || !health.response?.ok) {
    throw new Error("App is not healthy; start with docker compose up --build -d");
  }

  const alice = await login("alice");
  const bob = await login("bob");
  const carol = await login("carol");
  const dave = await login("dave");

  // ---------- T1 filter ----------
  {
    const id = "T1";
    const title =
      "关键词+角色+技能集合全部包含（trim/大小写；非子串；非跨角色）";
    const listAll = await req("GET", "/api/projects", { token: bob });
    const open = listAll.response.items.find((p) =>
      p.title.includes("[SEED] 招募中-筛选样例"),
    );
    // 正例：同一角色集合包含 Vue 与 JavaScript（带空格与大小写变体）
    const hitAll = await req(
      "GET",
      `/api/projects?keyword=${encodeURIComponent("筛选样例")}&role=${encodeURIComponent("前端")}&skills=${encodeURIComponent(" vue , JAVASCRIPT ")}`,
      { token: bob },
    );
    // 反例1：跨角色拼凑（前端角色没有 Python）
    const missCross = await req(
      "GET",
      `/api/projects?keyword=${encodeURIComponent("筛选样例")}&role=${encodeURIComponent("前端")}&skills=${encodeURIComponent("Python")}`,
      { token: bob },
    );
    // 反例2：部分技能（有 Vue 无 TypeScript）
    const missPartial = await req(
      "GET",
      `/api/projects?keyword=${encodeURIComponent("筛选样例")}&role=${encodeURIComponent("前端")}&skills=${encodeURIComponent("Vue,TypeScript")}`,
      { token: bob },
    );
    // 反例3：子串误匹配——角色有 JavaScript，筛选 Java 不得命中
    const missSubstring = await req(
      "GET",
      `/api/projects?keyword=${encodeURIComponent("筛选样例")}&role=${encodeURIComponent("前端")}&skills=${encodeURIComponent("Java")}`,
      { token: bob },
    );
    const hitIds = (hitAll.response.items || []).map((p) => p.id);
    const missCrossIds = (missCross.response.items || []).map((p) => p.id);
    const missPartialIds = (missPartial.response.items || []).map((p) => p.id);
    const missSubIds = (missSubstring.response.items || []).map((p) => p.id);
    const pass =
      !!open &&
      hitAll.status === 200 &&
      hitIds.includes(open.id) &&
      missCross.status === 200 &&
      !missCrossIds.includes(open.id) &&
      missPartial.status === 200 &&
      !missPartialIds.includes(open.id) &&
      missSubstring.status === 200 &&
      !missSubIds.includes(open.id);
    record(id, title, pass, {
      precondition: "seed open project with 前端(Vue,JavaScript) and 测试(Python,测试)",
      matchingRule:
        "skill tags: trim + case-fold, exact set membership (Java ≠ JavaScript)",
      openProjectId: open?.id,
      positiveAllSkills: { status: hitAll.status, hitIds },
      negativeCrossRole: { status: missCross.status, missCrossIds },
      negativePartialSkills: { status: missPartial.status, missPartialIds },
      negativeSubstringJava: { status: missSubstring.status, missSubIds },
      conclusion: pass
        ? "正例集合命中；跨角色/部分技能/Java⊂JavaScript 反例均不命中"
        : "筛选结果不符合标签集合全部包含语义",
    });
  }

  // ---------- T2 withdraw/reapply + reject reason ----------
  {
    const id = "T2";
    const title = "撤回后重申保留旧记录；拒绝须填写并展示原因";
    const created = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: `[TMP] T2-${Date.now()}`,
        goal: "撤回重申与拒绝原因",
        progress: "审计占位进展",
        expectedOutcome: "审计占位成果",
        roles: [
          {
            name: "前端开发",
            skillRequirements: ["Web"],
            capacity: 2,
          },
        ],
      },
    });
    const projectId = created.response.id;
    const roleId = created.response.roles[0].id;
    const app1 = await req("POST", "/api/applications", {
      token: bob,
      body: {
        projectId,
        roleId,
        reason: "第一次申请",
        contribution: "页面",
      },
    });
    const withdraw = await req("POST", `/api/applications/${app1.response.id}/withdraw`, {
      token: bob,
    });
    const app2 = await req("POST", "/api/applications", {
      token: bob,
      body: {
        projectId,
        roleId,
        reason: "撤回后重新申请",
        contribution: "页面+联调",
      },
    });
    const rejectNoReason = await req("POST", `/api/applications/${app2.response.id}/reject`, {
      token: alice,
      body: { reason: "" },
    });
    const reject = await req("POST", `/api/applications/${app2.response.id}/reject`, {
      token: alice,
      body: { reason: "近期时间不匹配" },
    });
    const mine = await req("GET", "/api/applications/mine", { token: bob });
    const related = (mine.response.items || []).filter((a) => a.projectId === projectId);
    const withdrawn = related.find((a) => a.id === app1.response.id);
    const rejected = related.find((a) => a.id === app2.response.id);
    const dbApps = sql(
      `SELECT id,status,reject_reason FROM applications WHERE project_id=${projectId} ORDER BY id`,
    );
    const pass =
      withdraw.status === 200 &&
      app2.status === 201 &&
      rejectNoReason.status === 400 &&
      reject.status === 200 &&
      withdrawn?.status === "withdrawn" &&
      rejected?.status === "rejected" &&
      rejected?.rejectReason === "近期时间不匹配" &&
      related.length >= 2;
    record(id, title, pass, {
      projectId,
      app1,
      withdraw,
      app2,
      rejectNoReason,
      reject,
      bobApplications: related,
      dbApps,
    });
  }

  // ---------- T3 pause ----------
  {
    const id = "T3";
    const title = "暂停禁新申请，pending 仍可审；恢复后有名额可申请";
    const created = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: `[TMP] T3-${Date.now()}`,
        goal: "暂停恢复",
        progress: "审计占位进展",
        expectedOutcome: "审计占位成果",
        roles: [{ name: "前端开发", skillRequirements: ["Web"], capacity: 2 }],
      },
    });
    const projectId = created.response.id;
    const roleId = created.response.roles[0].id;
    const pending = await req("POST", "/api/applications", {
      token: bob,
      body: { projectId, roleId, reason: "暂停前申请", contribution: "x" },
    });
    const paused = await req("POST", `/api/projects/${projectId}/pause`, {
      token: alice,
    });
    const newAppWhilePaused = await req("POST", "/api/applications", {
      token: carol,
      body: { projectId, roleId, reason: "暂停中申请", contribution: "y" },
    });
    const acceptWhilePaused = await req(
      "POST",
      `/api/applications/${pending.response.id}/accept`,
      { token: alice },
    );
    const resumed = await req("POST", `/api/projects/${projectId}/resume`, {
      token: alice,
    });
    const newAppAfterResume = await req("POST", "/api/applications", {
      token: carol,
      body: { projectId, roleId, reason: "恢复后申请", contribution: "y" },
    });
    const detail = await req("GET", `/api/projects/${projectId}`, { token: alice });
    const pass =
      paused.response.paused === true &&
      newAppWhilePaused.status === 400 &&
      acceptWhilePaused.status === 200 &&
      resumed.response.paused === false &&
      newAppAfterResume.status === 201 &&
      detail.response.roles[0].filled === 1;
    record(id, title, pass, {
      projectId,
      pending,
      paused: { status: paused.status, paused: paused.response.paused },
      newAppWhilePaused,
      acceptWhilePaused,
      resumed: { status: resumed.status, paused: resumed.response.paused },
      newAppAfterResume,
      role: detail.response.roles[0],
    });
  }

  // ---------- T4 full keeps pending (independent fixture; no seed mutation) ----------
  {
    const id = "T4";
    const title =
      "满员不可新申请；另一 pending 保持待审、接受失败且原因明确、仍可拒绝";
    // 独立项目：同角色两笔待审 → 接受其一使满员 → 验另一笔与新申请
    const created = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: `[TMP] T4-full-${Date.now()}`,
        goal: "满员后待审申请独立性",
        progress: "审计占位进展",
        expectedOutcome: "审计占位成果",
        roles: [
          { name: "前端开发", skillRequirements: ["Web"], capacity: 1 },
        ],
      },
    });
    const projectId = created.response.id;
    const roleId = created.response.roles[0].id;
    const appB = await req("POST", "/api/applications", {
      token: bob,
      body: { projectId, roleId, reason: "T4-bob 先申请", contribution: "b" },
    });
    const appC = await req("POST", "/api/applications", {
      token: carol,
      body: { projectId, roleId, reason: "T4-carol 同角色待审", contribution: "c" },
    });
    const acceptB = await req("POST", `/api/applications/${appB.response.id}/accept`, {
      token: alice,
    });
    const detailAfterFill = await req("GET", `/api/projects/${projectId}`, {
      token: alice,
    });
    const newApp = await req("POST", "/api/applications", {
      token: dave,
      body: {
        projectId,
        roleId,
        reason: "试图加入满员项目",
        contribution: "z",
      },
    });
    const acceptPending = await req(
      "POST",
      `/api/applications/${appC.response.id}/accept`,
      { token: alice },
    );
    const appsAfterAcceptFail = await req(
      "GET",
      `/api/applications/project/${projectId}`,
      { token: alice },
    );
    const pendingAfter = (appsAfterAcceptFail.response.items || []).find(
      (a) => a.id === appC.response.id,
    );
    const rejectPending = await req(
      "POST",
      `/api/applications/${appC.response.id}/reject`,
      { token: alice, body: { reason: "角色已满，抱歉" } },
    );
    const appsFinal = await req("GET", `/api/applications/project/${projectId}`, {
      token: alice,
    });
    const carolFinal = (appsFinal.response.items || []).find(
      (a) => a.id === appC.response.id,
    );
    const bobFinal = (appsFinal.response.items || []).find(
      (a) => a.id === appB.response.id,
    );
    const db = sql(
      `SELECT r.capacity,
        (SELECT COUNT(*) FROM members m WHERE m.role_id=r.id AND m.is_owner=FALSE) AS filled,
        (SELECT COUNT(*) FROM applications a WHERE a.project_id=r.project_id AND a.status='pending') AS pending_cnt,
        (SELECT COUNT(*) FROM applications a WHERE a.project_id=r.project_id AND a.status='rejected') AS rejected_cnt
       FROM project_roles r WHERE r.project_id=${projectId}`,
    );
    const pass =
      created.status === 201 &&
      appB.status === 201 &&
      appC.status === 201 &&
      acceptB.status === 200 &&
      detailAfterFill.response.roles[0].remaining === 0 &&
      detailAfterFill.response.roles[0].filled === 1 &&
      newApp.status === 400 &&
      String(newApp.response?.error || "").includes("名额已满") &&
      acceptPending.status === 409 &&
      String(acceptPending.response?.error || "").includes("名额已满") &&
      pendingAfter?.status === "pending" &&
      rejectPending.status === 200 &&
      bobFinal?.status === "accepted" &&
      carolFinal?.status === "rejected" &&
      carolFinal?.rejectReason === "角色已满，抱歉";
    record(id, title, pass, {
      note: "自建 [TMP] 项目与申请，不依赖 [SEED] 已满员样例的可变 pending",
      projectId,
      appB: { status: appB.status, id: appB.response?.id },
      appC: { status: appC.status, id: appC.response?.id },
      acceptB,
      detailRolesAfterFill: detailAfterFill.response?.roles,
      newApp,
      acceptPending,
      pendingAfter,
      rejectPending,
      bobFinal: bobFinal && { id: bobFinal.id, status: bobFinal.status },
      carolFinal: carolFinal && {
        id: carolFinal.id,
        status: carolFinal.status,
        rejectReason: carolFinal.rejectReason,
      },
      db,
    });
  }

  // ---------- T5 concurrent last seat ----------
  {
    const id = "T5";
    const title = "并发接受最后 1 名额，最多一人成功";
    const created = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: `[TMP] T5-race-${Date.now()}`,
        goal: "并发竞争",
        progress: "审计占位进展",
        expectedOutcome: "审计占位成果",
        roles: [
          { name: "前端开发", skillRequirements: ["Web"], capacity: 1 },
        ],
      },
    });
    const projectId = created.response.id;
    const roleId = created.response.roles[0].id;
    const appB = await req("POST", "/api/applications", {
      token: bob,
      body: { projectId, roleId, reason: "B抢席", contribution: "b" },
    });
    const appC = await req("POST", "/api/applications", {
      token: carol,
      body: { projectId, roleId, reason: "C抢席", contribution: "c" },
    });
    const [r1, r2] = await Promise.all([
      req("POST", `/api/applications/${appB.response.id}/accept`, {
        token: alice,
      }),
      req("POST", `/api/applications/${appC.response.id}/accept`, {
        token: alice,
      }),
    ]);
    const detail = await req("GET", `/api/projects/${projectId}`, { token: alice });
    const apps = await req("GET", `/api/applications/project/${projectId}`, {
      token: alice,
    });
    const db = sql(
      `SELECT
         (SELECT COUNT(*) FROM members WHERE project_id=${projectId} AND is_owner=FALSE) AS joined_non_owner,
         (SELECT COUNT(*) FROM members WHERE project_id=${projectId}) AS members_total,
         (SELECT COUNT(*) FROM applications WHERE project_id=${projectId} AND status='accepted') AS accepted_cnt,
         (SELECT COUNT(*) FROM applications WHERE project_id=${projectId} AND status='pending') AS pending_cnt`,
    );
    const freshlyAccepted = [r1, r2].filter(
      (r) => r.status === 200 && r.response?.message === "已接受" && r.response?.handled === false,
    );
    const quotaFullFails = [r1, r2].filter(
      (r) => r.status === 409 && String(r.response?.error || "").includes("名额已满"),
    );
    const acceptedApps = (apps.response.items || []).filter((a) => a.status === "accepted");
    const pendingApps = (apps.response.items || []).filter((a) => a.status === "pending");
    const recruitMembers = detail.response.members.filter((m) => !m.isOwner);
    const joined = Number(detail.response.roles[0].filled);
    // 必须恰好一成一败：禁止双失败或双成功
    const pass =
      appB.status === 201 &&
      appC.status === 201 &&
      freshlyAccepted.length === 1 &&
      quotaFullFails.length === 1 &&
      joined === 1 &&
      detail.response.roles[0].remaining === 0 &&
      acceptedApps.length === 1 &&
      pendingApps.length === 1 &&
      recruitMembers.length === 1;
    record(id, title, pass, {
      projectId,
      appB: { status: appB.status, id: appB.response?.id },
      appC: { status: appC.status, id: appC.response?.id },
      concurrentResponses: [r1, r2],
      freshlyAcceptedCount: freshlyAccepted.length,
      quotaFullFailCount: quotaFullFails.length,
      detailRoles: detail.response.roles,
      applicationStatuses: (apps.response.items || []).map((a) => ({
        id: a.id,
        status: a.status,
      })),
      recruitMembers,
      membersTotal: detail.response.members.length,
      db,
      rule: "exactly one 200/已接受 and one 409/名额已满; loser stays pending; one recruit member",
    });
  }

  // ---------- T6 duplicate accept / submit / apply after joined ----------
  {
    const id = "T6";
    const title = "重复接受、重复提交、已加入后再申请均不冲突占位";
    const created = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: `[TMP] T6-${Date.now()}`,
        goal: "幂等与冲突",
        progress: "审计占位进展",
        expectedOutcome: "审计占位成果",
        roles: [{ name: "前端开发", skillRequirements: ["Web"], capacity: 2 }],
      },
    });
    const projectId = created.response.id;
    const roleId = created.response.roles[0].id;
    const app = await req("POST", "/api/applications", {
      token: bob,
      body: { projectId, roleId, reason: "一次申请", contribution: "x" },
    });
    const dupPending = await req("POST", "/api/applications", {
      token: bob,
      body: { projectId, roleId, reason: "重复 pending", contribution: "x" },
    });
    const accept1 = await req("POST", `/api/applications/${app.response.id}/accept`, {
      token: alice,
    });
    const accept2 = await req("POST", `/api/applications/${app.response.id}/accept`, {
      token: alice,
    });
    const applyAfterJoin = await req("POST", "/api/applications", {
      token: bob,
      body: {
        projectId,
        roleId,
        reason: "已成为成员后再申请",
        contribution: "x",
      },
    });
    const detail = await req("GET", `/api/projects/${projectId}`, { token: alice });
    const db = sql(
      `SELECT
         (SELECT COUNT(*) FROM members WHERE project_id=${projectId} AND user_id=(SELECT id FROM users WHERE username='bob')) AS bob_members,
         (SELECT COUNT(*) FROM applications WHERE project_id=${projectId} AND applicant_id=(SELECT id FROM users WHERE username='bob') AND status='pending') AS bob_pending`,
    );
    const pass =
      dupPending.status === 400 &&
      accept1.status === 200 &&
      accept2.status === 200 &&
      accept2.response.handled === true &&
      applyAfterJoin.status === 400 &&
      detail.response.roles[0].filled === 1 &&
      detail.response.members.filter((m) => m.username === "bob").length === 1;
    record(id, title, pass, {
      projectId,
      app,
      dupPending,
      accept1,
      accept2,
      applyAfterJoin,
      filled: detail.response.roles[0].filled,
      members: detail.response.members,
      db,
    });
  }

  // ---------- T7 permissions ----------
  {
    const id = "T7";
    const title = "普通用户审核/暂停/读他人正文 403；发起人只能管自己的项目";
    const aliceProject = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: `[TMP] T7a-${Date.now()}`,
        goal: "权限A",
        progress: "审计占位进展",
        expectedOutcome: "审计占位成果",
        roles: [{ name: "前端开发", skillRequirements: ["Web"], capacity: 1 }],
      },
    });
    const bobProject = await req("POST", "/api/projects", {
      token: bob,
      body: {
        title: `[TMP] T7b-${Date.now()}`,
        goal: "权限B自己的项目",
        progress: "审计占位进展",
        expectedOutcome: "审计占位成果",
        roles: [{ name: "前端开发", skillRequirements: ["Web"], capacity: 1 }],
      },
    });
    const app = await req("POST", "/api/applications", {
      token: carol,
      body: {
        projectId: aliceProject.response.id,
        roleId: aliceProject.response.roles[0].id,
        reason: "敏感正文请勿泄露",
        contribution: "私密贡献说明",
      },
    });
    const bobAccept = await req(
      "POST",
      `/api/applications/${app.response.id}/accept`,
      { token: bob },
    );
    const bobPause = await req(
      "POST",
      `/api/projects/${aliceProject.response.id}/pause`,
      { token: bob },
    );
    const bobResume = await req(
      "POST",
      `/api/projects/${aliceProject.response.id}/resume`,
      { token: bob },
    );
    const daveRead = await req("GET", `/api/applications/${app.response.id}`, {
      token: dave,
    });
    const aliceManageOwn = await req(
      "GET",
      `/api/applications/project/${aliceProject.response.id}`,
      { token: alice },
    );
    const aliceManageOthers = await req(
      "GET",
      `/api/applications/project/${bobProject.response.id}`,
      { token: alice },
    );
    const pass =
      bobAccept.status === 403 &&
      bobPause.status === 403 &&
      bobResume.status === 403 &&
      daveRead.status === 403 &&
      aliceManageOwn.status === 200 &&
      aliceManageOthers.status === 403;
    record(id, title, pass, {
      bobAccept,
      bobPause,
      bobResume,
      daveRead,
      aliceManageOwnStatus: aliceManageOwn.status,
      aliceManageOthers,
    });
  }

  // ---------- T8 snapshot ----------
  {
    const id = "T8";
    const title = "申请后改资料，发起人仍见提交时快照";
    const created = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: `[TMP] T8-${Date.now()}`,
        goal: "快照",
        progress: "审计占位进展",
        expectedOutcome: "审计占位成果",
        roles: [{ name: "前端开发", skillRequirements: ["Web"], capacity: 1 }],
      },
    });
    const projectId = created.response.id;
    const roleId = created.response.roles[0].id;
    const beforeProfile = await req("GET", "/api/auth/me", { token: bob });
    const app = await req("POST", "/api/applications", {
      token: bob,
      body: {
        projectId,
        roleId,
        reason: "快照测试",
        contribution: "x",
      },
    });
    const snapshotNick = app.response.snapshot.nickname;
    const snapshotSkills = [...app.response.snapshot.skills].sort().join(",");
    await req("PUT", "/api/profile/me", {
      token: bob,
      body: {
        nickname: `Bob已改名-${Date.now()}`,
        bio: "改过的简介不应出现在旧申请",
        skills: ["ChangedSkill"],
        weeklyHours: 99,
      },
    });
    const ownerView = await req("GET", `/api/applications/${app.response.id}`, {
      token: alice,
    });
    const meAfter = await req("GET", "/api/auth/me", { token: bob });
    // restore bob profile for later tests
    await req("PUT", "/api/profile/me", {
      token: bob,
      body: {
        nickname: beforeProfile.response.nickname,
        bio: beforeProfile.response.bio,
        skills: beforeProfile.response.skills,
        weeklyHours: beforeProfile.response.weeklyHours,
      },
    });
    const pass =
      ownerView.status === 200 &&
      ownerView.response.snapshot.nickname === snapshotNick &&
      [...ownerView.response.snapshot.skills].sort().join(",") === snapshotSkills &&
      meAfter.response.nickname !== snapshotNick;
    record(id, title, pass, {
      projectId,
      appSnapshot: app.response.snapshot,
      ownerViewSnapshot: ownerView.response.snapshot,
      bobProfileAfterChange: {
        nickname: meAfter.response.nickname,
        skills: meAfter.response.skills,
        weeklyHours: meAfter.response.weeklyHours,
      },
    });
  }

  // ---------- T9 persistence recreate ----------
  {
    const id = "T9";
    const title = "重建 app 容器（保留数据卷）后数据仍可读";
    // Compose `tester` has no Docker CLI; skip recreate there (see verification-persistence.md).
    const skipRecreate =
      process.env.ROUND2_SKIP_T9 === "1" || process.env.PGHOST === "db";
    if (skipRecreate) {
      // Must NOT count as PASS — host Docker recreate is a separate check.
      record(id, title, null, {
        skipped: true,
        reason:
          "No Docker CLI in compose tester (or ROUND2_SKIP_T9=1). Persistence: docs/verification-persistence.md; host-only recreate steps in README.",
      });
    } else {
      const markerTitle = `[TMP] T9-persist-${Date.now()}`;
      const created = await req("POST", "/api/projects", {
        token: alice,
        body: {
          title: markerTitle,
          goal: "持久化",
          progress: "v1",
          expectedOutcome: "仍在",
          roles: [{ name: "前端开发", skillRequirements: ["Web"], capacity: 1 }],
        },
      });
      const projectId = created.response.id;
      const roleId = created.response.roles[0].id;
      const app = await req("POST", "/api/applications", {
        token: carol,
        body: { projectId, roleId, reason: "持久化申请", contribution: "p" },
      });
      const accept = await req("POST", `/api/applications/${app.response.id}/accept`, {
        token: alice,
      });
      sh("docker", ["compose", "up", "-d", "--force-recreate", "--no-deps", "app"]);
      let healthy = false;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const h = await fetch(`${BASE}/api/health`);
          if (h.ok) {
            healthy = true;
            break;
          }
        } catch {
          /* retry */
        }
      }
      const alice2 = await login("alice");
      const carol2 = await login("carol");
      const detail = await req("GET", `/api/projects/${projectId}`, { token: alice2 });
      const mine = await req("GET", "/api/applications/mine", { token: carol2 });
      const myApp = (mine.response.items || []).find((a) => a.id === app.response.id);
      const db = sql(
        `SELECT p.title,
          (SELECT COUNT(*) FROM members m WHERE m.project_id=p.id) AS members,
          (SELECT status FROM applications WHERE id=${app.response.id}) AS app_status
         FROM projects p WHERE p.id=${projectId}`,
      );
      const pass =
        healthy &&
        accept.status === 200 &&
        detail.status === 200 &&
        detail.response.title === markerTitle &&
        detail.response.roles[0].filled === 1 &&
        myApp?.status === "accepted";
      record(id, title, pass, {
        projectId,
        appId: app.response.id,
        accept,
        healthy,
        detailTitle: detail.response?.title,
        filled: detail.response?.roles?.[0]?.filled,
        carolAppStatus: myApp?.status,
        db,
      });
    }
  }

  // ---------- seed integrity check ----------
  {
    const id = "SEED";
    const title = "种子：4账号+3状态项目+竞争场景；发起人不占名额";
    const users = sql("SELECT username FROM users ORDER BY username");
    const projects = sql(
      "SELECT title,paused FROM projects WHERE title LIKE '[SEED]%' ORDER BY title",
    );
    const race = sql(
      `SELECT p.title,
        r.capacity,
        (SELECT COUNT(*) FROM members m WHERE m.role_id=r.id AND NOT m.is_owner) AS filled,
        (SELECT COUNT(*) FROM applications a WHERE a.project_id=p.id AND a.status='pending') AS pending
       FROM projects p
       JOIN project_roles r ON r.project_id=p.id
       WHERE p.title='[SEED] 单名额竞争样例'`,
    );
    const ownerNotCounted = sql(
      `SELECT p.title,
        (SELECT COUNT(*) FROM members m WHERE m.project_id=p.id AND m.is_owner) AS owners,
        (SELECT COUNT(*) FROM members m WHERE m.project_id=p.id AND NOT m.is_owner) AS recruits
       FROM projects p WHERE p.title LIKE '[SEED]%' ORDER BY p.title`,
    );
    const userList = users.split("\n").filter(Boolean);
    const pass =
      ["alice", "bob", "carol", "dave"].every((u) => userList.includes(u)) &&
      projects.includes("[SEED] 招募中-筛选样例") &&
      projects.includes("[SEED] 暂停招募样例") &&
      projects.includes("[SEED] 已满员样例") &&
      projects.includes("[SEED] 单名额竞争样例");
    record(id, title, pass, { users: userList, projects, race, ownerNotCounted });
  }

  // Write evidence
  fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(rawLog, null, 2), "utf8");

  const passed = results.filter((r) => r.pass === true && !r.skipped);
  const failed = results.filter((r) => r.pass === false && !r.skipped);
  const skipped = results.filter((r) => r.skipped);
  let md = `# 第二轮验收验证（真实 API + 数据库）\n\n`;
  md += `- 时间：${new Date().toISOString()}\n`;
  md += `- 目标：${BASE}\n`;
  md += `- 命令：\`node scripts/round2-tests.mjs\` / compose profile \`test\`\n`;
  md += `- 汇总：${passed.length} 通过 / ${failed.length} 失败 / ${skipped.length} 跳过（共 ${results.length}）\n`;
  md += `- 原始响应：[\`docs/round2-raw-responses.json\`](./round2-raw-responses.json)\n\n`;

  for (const r of results) {
    const tag = r.skipped ? "SKIP" : r.pass ? "PASS" : "FAIL";
    md += `## ${r.id} ${tag} — ${r.title}\n\n`;
    md += "```json\n" + JSON.stringify(r.evidence, null, 2) + "\n```\n\n";
  }

  md += `## 未通过列表\n\n`;
  if (failed.length) {
    for (const f of failed) md += `- ${f.id}: ${f.title}\n`;
    md += "\n";
  } else {
    md += `无\n\n`;
  }
  md += `## 跳过列表\n\n`;
  if (skipped.length) {
    for (const s of skipped) md += `- ${s.id}: ${s.title}\n`;
    md += "\n";
  } else {
    md += `无\n\n`;
  }

  fs.writeFileSync(OUT_MD, md, "utf8");
  console.log(`\nWrote ${OUT_MD}`);
  console.log(`Wrote ${OUT_JSON}`);
  console.log(
    `Summary: ${passed.length} PASS / ${failed.length} FAIL / ${skipped.length} SKIP (of ${results.length})`,
  );

  const runLabel = process.env.ROUND2_RUN_LABEL?.trim();
  if (runLabel) {
    const runDir = path.join(ROOT, "docs", "runs");
    fs.mkdirSync(runDir, { recursive: true });
    const mdCopy = path.join(runDir, `verification-round2-${runLabel}.md`);
    const jsonCopy = path.join(runDir, `round2-raw-responses-${runLabel}.json`);
    fs.copyFileSync(OUT_MD, mdCopy);
    fs.copyFileSync(OUT_JSON, jsonCopy);
    console.log(`Archived ${mdCopy}`);
    console.log(`Archived ${jsonCopy}`);
  }

  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
