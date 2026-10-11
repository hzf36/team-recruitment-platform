# 第 1 轮验证记录

时间：2026-10-10（本机 Docker 实测）

## 实际执行的命令

```powershell
$env:PATH = 'C:\Program Files\Docker\Docker\resources\bin;' + $env:PATH
cd D:\team-recruitment-platform
docker compose up --build -d
```

健康检查：`GET http://localhost:8080/api/health` → `{"ok":true}`

容器重建（保留数据卷）：

```powershell
docker compose up -d --force-recreate --no-deps app
```

## 接口流程结果

| 步骤 | 结果 |
|------|------|
| alice 登录 | 200 |
| bob 登录 | 200 |
| alice 发布项目（前端角色名额 1） | projectId=1, roleId=1, remaining=1, 成员仅 alice（发起人，不占名额） |
| bob 提交申请 | 201, applicationId=1, status=pending，含资料快照 |
| alice 接受申请 | 200, message=已接受, handled=false |
| 双方查看详情 | filled=1, remaining=0, recruitStatus=full；成员 alice + bob |
| bob「我的申请」 | status=accepted |
| alice 再次接受同一申请 | 200, message=已处理, handled=true；filled 仍为 1，成员数仍为 2 |
| 重建 app 容器后 | 项目/成员/申请仍在；bob 申请仍为 accepted；remaining=0 |

## 未在本轮执行

- 浏览器手工点选全套 UI（接口与页面同源已可用，本轮用 API 验证主流程）
- 并发双人抢名额、暂停招募、筛选 AND、资料快照改写防护的专项用例
- GitHub / 平台仓库绑定 / SHA 锁定
