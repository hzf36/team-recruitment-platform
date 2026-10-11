# Auth fault + recover + save (browser) — 2026-10-11

> 故障注入仅用于本隔离探针。交付默认：`AUTH_ME_FORCE_ERROR` 未设置；普通 `docker compose up` 不会启用。探针结束后已 `down -v`，勿把 `.env.auth-fault` 用于日常启动。

## Setup
- `docker compose -p team-auth-fault --env-file .env.auth-fault up --build -d`
- `APP_PORT=18081`, `AUTH_ME_FORCE_ERROR=500`
- Valid JWT: `GET /api/auth/me` → **500** `身份服务暂时不可用（测试注入）`（响应中的 token 不入库；见脱敏后的 `auth-fault-probe-meta.json`）

## Fault phase (browser `/profile`)
- `tokenPresent=true`, `tokenLen=164`
- UI: error banner +「登录凭证仍保留」+「重试加载身份」
- Nav user /「退出」absent (`noLogout=true`)

## Restore (no fault config retained)
- Recreate app with `.env.auth-fault.restored` (no `AUTH_ME_FORCE_ERROR`)
- Container `AUTH_ME_FORCE_ERROR=''`; `/api/auth/me` → **200**

## Retry + save (same session, no re-login)
- Click「重试加载身份」
- Result: `hasErr=false`, nav shows Alice +「退出」, fields filled
  (`Alice（发起人A）` / `Vue, 项目管理` / `12`)
- Edit bio → Save → `资料已保存`; still logged in; not redirected to login

## Teardown
- `docker compose -p team-auth-fault --env-file .env.auth-fault.restored down -v`
- Default stack on :8080 untouched for round2/audit-probes
