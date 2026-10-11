/**
 * Focused audit probes (validation, leak, withdraw/accept race).
 * Does not overwrite round2 evidence files.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.APP_BASE || "http://localhost:8080";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "runs", "audit-probes.json");
const RUN_LABEL = process.env.AUDIT_RUN_LABEL?.trim();

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
  return { status: res.status, json };
}

async function login(username) {
  const r = await req("POST", "/api/auth/login", {
    body: { username, password: "password123" },
  });
  if (r.status !== 200) throw new Error(`login ${username} failed`);
  return r.json.token;
}

const evidence = { base: BASE, at: new Date().toISOString(), cases: [] };

function note(id, pass, detail) {
  evidence.cases.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id}`);
}

async function main() {
  const alice = await login("alice");
  const bob = await login("bob");
  const carol = await login("carol");
  const dave = await login("dave");

  // V1 blank title
  {
    const r = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: "   ",
        goal: "目标",
        progress: "进展",
        expectedOutcome: "成果",
        roles: [{ name: "前端", skillRequirements: ["Web"], capacity: 1 }],
      },
    });
    note("V1-blank-title", r.status === 400, r);
  }

  // V2 empty progress / outcome
  {
    const r = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: "标题",
        goal: "目标",
        progress: "",
        expectedOutcome: "",
        roles: [{ name: "前端", skillRequirements: ["Web"], capacity: 1 }],
      },
    });
    note("V2-empty-progress-outcome", r.status === 400, r);
  }

  // V3 capacity 0 / NaN-like
  {
    const z = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: "标题",
        goal: "目标",
        progress: "进展",
        expectedOutcome: "成果",
        roles: [{ name: "前端", skillRequirements: ["Web"], capacity: 0 }],
      },
    });
    const bad = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: "标题",
        goal: "目标",
        progress: "进展",
        expectedOutcome: "成果",
        roles: [{ name: "前端", skillRequirements: ["Web"], capacity: 1.5 }],
      },
    });
    note("V3-capacity", z.status === 400 && bad.status === 400, { z, bad });
  }

  // V4 blank role name / foreign roleId / blank reason
  {
    const created = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: `[AUDIT] valid-${Date.now()}`,
        goal: "目标",
        progress: "进展",
        expectedOutcome: "成果",
        roles: [{ name: "前端开发", skillRequirements: ["Web"], capacity: 2 }],
      },
    });
    const blankRole = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: "标题",
        goal: "目标",
        progress: "进展",
        expectedOutcome: "成果",
        roles: [{ name: "   ", skillRequirements: ["Web"], capacity: 1 }],
      },
    });
    const badRole = await req("POST", "/api/applications", {
      token: bob,
      body: {
        projectId: created.json.id,
        roleId: 999999,
        reason: "理由",
        contribution: "x",
      },
    });
    const blankReason = await req("POST", "/api/applications", {
      token: bob,
      body: {
        projectId: created.json.id,
        roleId: created.json.roles[0].id,
        reason: "   ",
        contribution: "x",
      },
    });
    note(
      "V4-role-reason",
      created.status === 201 &&
        blankRole.status === 400 &&
        badRole.status === 400 &&
        blankReason.status === 400,
      { created: created.status, blankRole, badRole, blankReason },
    );
  }

  // V5 role skillRequirements required (empty / blank / missing)
  {
    const emptyArr = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: "标题",
        goal: "目标",
        progress: "进展",
        expectedOutcome: "成果",
        roles: [{ name: "前端", skillRequirements: [], capacity: 1 }],
      },
    });
    const blankTags = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: "标题",
        goal: "目标",
        progress: "进展",
        expectedOutcome: "成果",
        roles: [{ name: "前端", skillRequirements: ["  ", "\t"], capacity: 1 }],
      },
    });
    const missing = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: "标题",
        goal: "目标",
        progress: "进展",
        expectedOutcome: "成果",
        roles: [{ name: "前端", capacity: 1 }],
      },
    });
    const ok = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: `[AUDIT] skills-ok-${Date.now()}`,
        goal: "目标",
        progress: "进展",
        expectedOutcome: "成果",
        roles: [
          { name: "前端", skillRequirements: [" JavaScript "], capacity: 1 },
        ],
      },
    });
    note(
      "V5-role-skills-required",
      emptyArr.status === 400 &&
        blankTags.status === 400 &&
        missing.status === 400 &&
        ok.status === 201 &&
        ok.json.roles?.[0]?.skillRequirements?.[0] === "JavaScript",
      { emptyArr, blankTags, missing, ok: { status: ok.status, roles: ok.json?.roles } },
    );
  }

  // F1 skill set match (not substring)
  {
    const listAll = await req("GET", "/api/projects", { token: bob });
    const open = (listAll.json.items || []).find((p) =>
      String(p.title).includes("[SEED] 招募中-筛选样例"),
    );
    const hit = await req(
      "GET",
      `/api/projects?keyword=${encodeURIComponent("筛选样例")}&role=${encodeURIComponent("前端")}&skills=${encodeURIComponent(" vue , JAVASCRIPT ")}`,
      { token: bob },
    );
    const missSub = await req(
      "GET",
      `/api/projects?keyword=${encodeURIComponent("筛选样例")}&role=${encodeURIComponent("前端")}&skills=${encodeURIComponent("Java")}`,
      { token: bob },
    );
    const missCross = await req(
      "GET",
      `/api/projects?keyword=${encodeURIComponent("筛选样例")}&role=${encodeURIComponent("前端")}&skills=${encodeURIComponent("Python")}`,
      { token: bob },
    );
    const missPartial = await req(
      "GET",
      `/api/projects?keyword=${encodeURIComponent("筛选样例")}&role=${encodeURIComponent("前端")}&skills=${encodeURIComponent("Vue,TypeScript")}`,
      { token: bob },
    );
    const hitIds = (hit.json.items || []).map((p) => p.id);
    const subIds = (missSub.json.items || []).map((p) => p.id);
    const crossIds = (missCross.json.items || []).map((p) => p.id);
    const partIds = (missPartial.json.items || []).map((p) => p.id);
    note(
      "F1-skill-set-match",
      !!open &&
        hitIds.includes(open.id) &&
        !subIds.includes(open.id) &&
        !crossIds.includes(open.id) &&
        !partIds.includes(open.id),
      {
        openId: open?.id,
        hitIds,
        missSubstringJava: subIds,
        missCrossRole: crossIds,
        missPartial: partIds,
      },
    );
  }

  // L1 no body leak in list/detail/members
  {
    const created = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: `[AUDIT] leak-${Date.now()}`,
        goal: "目标",
        progress: "进展",
        expectedOutcome: "成果",
        roles: [{ name: "前端开发", skillRequirements: ["Web"], capacity: 2 }],
      },
    });
    const app = await req("POST", "/api/applications", {
      token: carol,
      body: {
        projectId: created.json.id,
        roleId: created.json.roles[0].id,
        reason: "SECRET_REASON_TEXT",
        contribution: "SECRET_CONTRIB",
      },
    });
    const list = await req("GET", "/api/projects", { token: dave });
    const detail = await req("GET", `/api/projects/${created.json.id}`, {
      token: dave,
    });
    const dump = JSON.stringify({ list: list.json, detail: detail.json });
    const daveRead = await req("GET", `/api/applications/${app.json.id}`, {
      token: dave,
    });
    note(
      "L1-no-body-leak",
      !dump.includes("SECRET_REASON") &&
        !dump.includes("SECRET_CONTRIB") &&
        daveRead.status === 403,
      {
        listStatus: list.status,
        detailStatus: detail.status,
        daveRead,
        members: detail.json?.members,
      },
    );
  }

  // R1 withdraw vs accept concurrent (TEAM-08)
  {
    const created = await req("POST", "/api/projects", {
      token: alice,
      body: {
        title: `[AUDIT] race-wd-${Date.now()}`,
        goal: "目标",
        progress: "进展",
        expectedOutcome: "成果",
        roles: [{ name: "前端开发", skillRequirements: ["Web"], capacity: 1 }],
      },
    });
    const app = await req("POST", "/api/applications", {
      token: bob,
      body: {
        projectId: created.json.id,
        roleId: created.json.roles[0].id,
        reason: "竞争撤回接受",
        contribution: "x",
      },
    });
    const [w, a] = await Promise.all([
      req("POST", `/api/applications/${app.json.id}/withdraw`, { token: bob }),
      req("POST", `/api/applications/${app.json.id}/accept`, { token: alice }),
    ]);
    const detail = await req("GET", `/api/projects/${created.json.id}`, {
      token: alice,
    });
    const apps = await req("GET", `/api/applications/project/${created.json.id}`, {
      token: alice,
    });
    const status = apps.json.items?.[0]?.status;
    const filled = detail.json.roles[0].filled;
    const recruitMembers = detail.json.members.filter((m) => !m.isOwner).length;
    const okPair =
      (status === "withdrawn" &&
        filled === 0 &&
        recruitMembers === 0 &&
        w.status === 200 &&
        a.status === 400) ||
      (status === "accepted" &&
        filled === 1 &&
        recruitMembers === 1 &&
        a.status === 200 &&
        w.status === 400);
    note("R1-withdraw-accept-race", okPair, {
      withdraw: w,
      accept: a,
      status,
      filled,
      recruitMembers,
    });
  }

  // A1 unauthenticated protected APIs
  {
    const me = await req("GET", "/api/auth/me");
    const mine = await req("GET", "/api/applications/mine");
    const projects = await req("GET", "/api/projects");
    note(
      "A1-unauth",
      me.status === 401 && mine.status === 401 && projects.status === 401,
      { me, mine, projects },
    );
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2), "utf8");
  if (RUN_LABEL) {
    const labeled = path.join(
      ROOT,
      "docs",
      "runs",
      `audit-probes-${RUN_LABEL}.json`,
    );
    fs.copyFileSync(OUT, labeled);
    console.log(`Archived ${labeled}`);
  }
  const failed = evidence.cases.filter((c) => !c.pass);
  console.log(`\nWrote ${OUT}`);
  console.log(`Summary: ${evidence.cases.length - failed.length}/${evidence.cases.length}`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
