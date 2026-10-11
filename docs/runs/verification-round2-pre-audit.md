# 第二轮验收验证（真实 API + 数据库）

- 时间：2026-10-10T15:00:45.877Z（下列为 **rerun2**；与 rerun1 均为 10/10）
- 目标：http://localhost:8080
- 命令：`node scripts/round2-tests.mjs`（当前进程 PATH 含 Docker CLI）
- 汇总：10/10 通过
- 原始响应：[`docs/round2-raw-responses.json`](./round2-raw-responses.json)
- 可重复归档：
  - [`docs/runs/verification-round2-rerun1.md`](./runs/verification-round2-rerun1.md) + [`round2-raw-responses-rerun1.json`](./runs/round2-raw-responses-rerun1.json)
  - [`docs/runs/verification-round2-rerun2.md`](./runs/verification-round2-rerun2.md) + [`round2-raw-responses-rerun2.json`](./runs/round2-raw-responses-rerun2.json)
- 完整 app+db 容器重建持久化：见 [`docs/verification-persistence.md`](./verification-persistence.md)

## T4 失败原因与修复（历史）

- **失败现象（修复前）**：依赖 `[SEED] 已满员样例` 上仍存在的 pending；该 pending 已被浏览器验收人工拒绝后，断言拿到 `no pending in seed`，T4 FAIL（当时汇总 9/10）。
- **修复**：T4 改为每次自建 `[TMP] T4-full-*` 项目与两笔同角色待审申请，接受其一使满员后验证：新申请 400、另一 pending 仍待审且接受 409（含「名额已满」）、随后仍可拒绝。**不修改种子历史审核结果、不清库、不放宽断言。**
- **复测**：`ROUND2_RUN_LABEL=rerun1` 与 `rerun2` 各跑一遍，均为 **10/10**，且两次使用不同 `[TMP]` 项目 ID。

## T1 PASS — 关键词+角色+技能共同生效（同角色全部包含）

```json
{
  "precondition": "seed open project with 前端(Vue,JavaScript) and 测试(Python,测试)",
  "openProjectId": 2,
  "positiveAllSkills": {
    "status": 200,
    "hitIds": [
      2
    ]
  },
  "negativeCrossRole": {
    "status": 200,
    "missCrossIds": []
  },
  "negativePartialSkills": {
    "status": 200,
    "missPartialIds": []
  },
  "conclusion": "正例全部包含命中；跨角色与部分技能反例均不命中（非任意匹配）"
}
```

## T2 PASS — 撤回后重申保留旧记录；拒绝须填写并展示原因

```json
{
  "projectId": 51,
  "app1": {
    "method": "POST",
    "path": "/api/applications",
    "status": 201,
    "requestBody": {
      "projectId": 51,
      "roleId": 56,
      "reason": "第一次申请",
      "contribution": "页面"
    },
    "response": {
      "id": 67,
      "projectId": 51,
      "roleId": 56,
      "status": "pending",
      "reason": "第一次申请",
      "contribution": "页面",
      "snapshot": {
        "nickname": "Bob（申请人B）",
        "bio": "前端学习者",
        "skills": [
          "HTML",
          "CSS",
          "JavaScript"
        ],
        "weeklyHours": 10
      }
    }
  },
  "withdraw": {
    "method": "POST",
    "path": "/api/applications/67/withdraw",
    "status": 200,
    "requestBody": null,
    "response": {
      "id": 67,
      "status": "withdrawn"
    }
  },
  "app2": {
    "method": "POST",
    "path": "/api/applications",
    "status": 201,
    "requestBody": {
      "projectId": 51,
      "roleId": 56,
      "reason": "撤回后重新申请",
      "contribution": "页面+联调"
    },
    "response": {
      "id": 68,
      "projectId": 51,
      "roleId": 56,
      "status": "pending",
      "reason": "撤回后重新申请",
      "contribution": "页面+联调",
      "snapshot": {
        "nickname": "Bob（申请人B）",
        "bio": "前端学习者",
        "skills": [
          "HTML",
          "CSS",
          "JavaScript"
        ],
        "weeklyHours": 10
      }
    }
  },
  "rejectNoReason": {
    "method": "POST",
    "path": "/api/applications/68/reject",
    "status": 400,
    "requestBody": {
      "reason": ""
    },
    "response": {
      "error": "拒绝时请填写简短原因"
    }
  },
  "reject": {
    "method": "POST",
    "path": "/api/applications/68/reject",
    "status": 200,
    "requestBody": {
      "reason": "近期时间不匹配"
    },
    "response": {
      "id": 68,
      "status": "rejected",
      "rejectReason": "近期时间不匹配"
    }
  },
  "bobApplications": [
    {
      "id": 68,
      "projectId": 51,
      "projectTitle": "[TMP] T2-1791644437258",
      "roleId": 56,
      "roleName": "前端开发",
      "applicantId": 2,
      "applicantUsername": "bob",
      "status": "rejected",
      "rejectReason": "近期时间不匹配",
      "createdAt": "2026-10-10T15:00:37.331Z",
      "updatedAt": "2026-10-10T15:00:37.351Z",
      "snapshot": {
        "nickname": "Bob（申请人B）",
        "bio": "前端学习者",
        "skills": [
          "HTML",
          "CSS",
          "JavaScript"
        ],
        "weeklyHours": 10
      },
      "reason": "撤回后重新申请",
      "contribution": "页面+联调"
    },
    {
      "id": 67,
      "projectId": 51,
      "projectTitle": "[TMP] T2-1791644437258",
      "roleId": 56,
      "roleName": "前端开发",
      "applicantId": 2,
      "applicantUsername": "bob",
      "status": "withdrawn",
      "rejectReason": null,
      "createdAt": "2026-10-10T15:00:37.301Z",
      "updatedAt": "2026-10-10T15:00:37.315Z",
      "snapshot": {
        "nickname": "Bob（申请人B）",
        "bio": "前端学习者",
        "skills": [
          "HTML",
          "CSS",
          "JavaScript"
        ],
        "weeklyHours": 10
      },
      "reason": "第一次申请",
      "contribution": "页面"
    }
  ],
  "dbApps": "67|withdrawn|\n68|rejected|近期时间不匹配"
}
```

## T3 PASS — 暂停禁新申请，pending 仍可审；恢复后有名额可申请

```json
{
  "projectId": 52,
  "pending": {
    "method": "POST",
    "path": "/api/applications",
    "status": 201,
    "requestBody": {
      "projectId": 52,
      "roleId": 57,
      "reason": "暂停前申请",
      "contribution": "x"
    },
    "response": {
      "id": 69,
      "projectId": 52,
      "roleId": 57,
      "status": "pending",
      "reason": "暂停前申请",
      "contribution": "x",
      "snapshot": {
        "nickname": "Bob（申请人B）",
        "bio": "前端学习者",
        "skills": [
          "HTML",
          "CSS",
          "JavaScript"
        ],
        "weeklyHours": 10
      }
    }
  },
  "paused": {
    "status": 200,
    "paused": true
  },
  "newAppWhilePaused": {
    "method": "POST",
    "path": "/api/applications",
    "status": 400,
    "requestBody": {
      "projectId": 52,
      "roleId": 57,
      "reason": "暂停中申请",
      "contribution": "y"
    },
    "response": {
      "error": "项目已暂停招募，暂不可新申请"
    }
  },
  "acceptWhilePaused": {
    "method": "POST",
    "path": "/api/applications/69/accept",
    "status": 200,
    "requestBody": null,
    "response": {
      "handled": false,
      "message": "已接受",
      "applicationId": 69,
      "memberId": 79,
      "status": "accepted",
      "project": {
        "id": 52,
        "title": "[TMP] T3-1791644437807",
        "goal": "暂停恢复",
        "progress": "",
        "expectedOutcome": "",
        "paused": true,
        "ownerId": 1,
        "owner": {
          "id": 1,
          "username": "alice",
          "nickname": "Alice（发起人A）",
          "bio": "喜欢带队做实践项目（浏览器验收已更新）",
          "skills": [
            "Vue",
            "项目管理"
          ],
          "weeklyHours": 12
        },
        "roles": [
          {
            "id": 57,
            "name": "前端开发",
            "skillRequirements": [
              "Web"
            ],
            "capacity": 2,
            "filled": 1,
            "remaining": 1
          }
        ],
        "members": [
          {
            "id": 78,
            "userId": 1,
            "username": "alice",
            "nickname": "Alice（发起人A）",
            "roleId": null,
            "roleName": "发起人",
            "isOwner": true,
            "joinedAt": "2026-10-10T15:00:37.814Z"
          },
          {
            "id": 79,
            "userId": 2,
            "username": "bob",
            "nickname": "Bob（申请人B）",
            "roleId": 57,
            "roleName": "前端开发",
            "isOwner": false,
            "joinedAt": "2026-10-10T15:00:37.902Z"
          }
        ],
        "recruitStatus": "paused",
        "createdAt": "2026-10-10T15:00:37.814Z"
      }
    }
  },
  "resumed": {
    "status": 200,
    "paused": false
  },
  "newAppAfterResume": {
    "method": "POST",
    "path": "/api/applications",
    "status": 201,
    "requestBody": {
      "projectId": 52,
      "roleId": 57,
      "reason": "恢复后申请",
      "contribution": "y"
    },
    "response": {
      "id": 70,
      "projectId": 52,
      "roleId": 57,
      "status": "pending",
      "reason": "恢复后申请",
      "contribution": "y",
      "snapshot": {
        "nickname": "Carol（申请人C）",
        "bio": "测试与后端",
        "skills": [
          "Python",
          "测试"
        ],
        "weeklyHours": 8
      }
    }
  },
  "role": {
    "id": 57,
    "name": "前端开发",
    "skillRequirements": [
      "Web"
    ],
    "capacity": 2,
    "filled": 1,
    "remaining": 1
  }
}
```

## T4 PASS — 满员不可新申请；另一 pending 保持待审、接受失败且原因明确、仍可拒绝

```json
{
  "note": "自建 [TMP] 项目与申请，不依赖 [SEED] 已满员样例的可变 pending",
  "projectId": 53,
  "appB": {
    "status": 201,
    "id": 71
  },
  "appC": {
    "status": 201,
    "id": 72
  },
  "acceptB": {
    "method": "POST",
    "path": "/api/applications/71/accept",
    "status": 200,
    "requestBody": null,
    "response": {
      "handled": false,
      "message": "已接受",
      "applicationId": 71,
      "memberId": 81,
      "status": "accepted",
      "project": {
        "id": 53,
        "title": "[TMP] T4-full-1791644437981",
        "goal": "满员后待审申请独立性",
        "progress": "",
        "expectedOutcome": "",
        "paused": false,
        "ownerId": 1,
        "owner": {
          "id": 1,
          "username": "alice",
          "nickname": "Alice（发起人A）",
          "bio": "喜欢带队做实践项目（浏览器验收已更新）",
          "skills": [
            "Vue",
            "项目管理"
          ],
          "weeklyHours": 12
        },
        "roles": [
          {
            "id": 58,
            "name": "前端开发",
            "skillRequirements": [
              "Web"
            ],
            "capacity": 1,
            "filled": 1,
            "remaining": 0
          }
        ],
        "members": [
          {
            "id": 80,
            "userId": 1,
            "username": "alice",
            "nickname": "Alice（发起人A）",
            "roleId": null,
            "roleName": "发起人",
            "isOwner": true,
            "joinedAt": "2026-10-10T15:00:37.995Z"
          },
          {
            "id": 81,
            "userId": 2,
            "username": "bob",
            "nickname": "Bob（申请人B）",
            "roleId": 58,
            "roleName": "前端开发",
            "isOwner": false,
            "joinedAt": "2026-10-10T15:00:38.041Z"
          }
        ],
        "recruitStatus": "full",
        "createdAt": "2026-10-10T15:00:37.995Z"
      }
    }
  },
  "detailRolesAfterFill": [
    {
      "id": 58,
      "name": "前端开发",
      "skillRequirements": [
        "Web"
      ],
      "capacity": 1,
      "filled": 1,
      "remaining": 0
    }
  ],
  "newApp": {
    "method": "POST",
    "path": "/api/applications",
    "status": 400,
    "requestBody": {
      "projectId": 53,
      "roleId": 58,
      "reason": "试图加入满员项目",
      "contribution": "z"
    },
    "response": {
      "error": "该角色名额已满，无法申请"
    }
  },
  "acceptPending": {
    "method": "POST",
    "path": "/api/applications/72/accept",
    "status": 409,
    "requestBody": null,
    "response": {
      "error": "该角色名额已满",
      "remaining": 0,
      "filled": 1,
      "capacity": 1
    }
  },
  "pendingAfter": {
    "id": 72,
    "projectId": 53,
    "projectTitle": "[TMP] T4-full-1791644437981",
    "roleId": 58,
    "roleName": "前端开发",
    "applicantId": 3,
    "applicantUsername": "carol",
    "status": "pending",
    "rejectReason": null,
    "createdAt": "2026-10-10T15:00:38.026Z",
    "updatedAt": "2026-10-10T15:00:38.026Z",
    "snapshot": {
      "nickname": "Carol（申请人C）",
      "bio": "测试与后端",
      "skills": [
        "Python",
        "测试"
      ],
      "weeklyHours": 8
    },
    "reason": "T4-carol 同角色待审",
    "contribution": "c"
  },
  "rejectPending": {
    "method": "POST",
    "path": "/api/applications/72/reject",
    "status": 200,
    "requestBody": {
      "reason": "角色已满，抱歉"
    },
    "response": {
      "id": 72,
      "status": "rejected",
      "rejectReason": "角色已满，抱歉"
    }
  },
  "bobFinal": {
    "id": 71,
    "status": "accepted"
  },
  "carolFinal": {
    "id": 72,
    "status": "rejected",
    "rejectReason": "角色已满，抱歉"
  },
  "db": "1|1|0|1"
}
```

## T5 PASS — 并发接受最后 1 名额，最多一人成功

```json
{
  "projectId": 54,
  "appB": {
    "status": 201,
    "id": 73
  },
  "appC": {
    "status": 201,
    "id": 74
  },
  "concurrentResponses": [
    {
      "method": "POST",
      "path": "/api/applications/73/accept",
      "status": 200,
      "requestBody": null,
      "response": {
        "handled": false,
        "message": "已接受",
        "applicationId": 73,
        "memberId": 83,
        "status": "accepted",
        "project": {
          "id": 54,
          "title": "[TMP] T5-race-1791644438557",
          "goal": "并发竞争",
          "progress": "",
          "expectedOutcome": "",
          "paused": false,
          "ownerId": 1,
          "owner": {
            "id": 1,
            "username": "alice",
            "nickname": "Alice（发起人A）",
            "bio": "喜欢带队做实践项目（浏览器验收已更新）",
            "skills": [
              "Vue",
              "项目管理"
            ],
            "weeklyHours": 12
          },
          "roles": [
            {
              "id": 59,
              "name": "前端开发",
              "skillRequirements": [
                "Web"
              ],
              "capacity": 1,
              "filled": 1,
              "remaining": 0
            }
          ],
          "members": [
            {
              "id": 82,
              "userId": 1,
              "username": "alice",
              "nickname": "Alice（发起人A）",
              "roleId": null,
              "roleName": "发起人",
              "isOwner": true,
              "joinedAt": "2026-10-10T15:00:38.564Z"
            },
            {
              "id": 83,
              "userId": 2,
              "username": "bob",
              "nickname": "Bob（申请人B）",
              "roleId": 59,
              "roleName": "前端开发",
              "isOwner": false,
              "joinedAt": "2026-10-10T15:00:38.610Z"
            }
          ],
          "recruitStatus": "full",
          "createdAt": "2026-10-10T15:00:38.564Z"
        }
      }
    },
    {
      "method": "POST",
      "path": "/api/applications/74/accept",
      "status": 409,
      "requestBody": null,
      "response": {
        "error": "该角色名额已满",
        "remaining": 0,
        "filled": 1,
        "capacity": 1
      }
    }
  ],
  "freshlyAcceptedCount": 1,
  "quotaFullFailCount": 1,
  "detailRoles": [
    {
      "id": 59,
      "name": "前端开发",
      "skillRequirements": [
        "Web"
      ],
      "capacity": 1,
      "filled": 1,
      "remaining": 0
    }
  ],
  "applicationStatuses": [
    {
      "id": 74,
      "status": "pending"
    },
    {
      "id": 73,
      "status": "accepted"
    }
  ],
  "recruitMembers": [
    {
      "id": 83,
      "userId": 2,
      "username": "bob",
      "nickname": "Bob（申请人B）",
      "roleId": 59,
      "roleName": "前端开发",
      "isOwner": false,
      "joinedAt": "2026-10-10T15:00:38.610Z"
    }
  ],
  "membersTotal": 2,
  "db": "1|2|1|1",
  "rule": "exactly one 200/已接受 and one 409/名额已满; loser stays pending; one recruit member"
}
```

## T6 PASS — 重复接受、重复提交、已加入后再申请均不冲突占位

```json
{
  "projectId": 55,
  "app": {
    "method": "POST",
    "path": "/api/applications",
    "status": 201,
    "requestBody": {
      "projectId": 55,
      "roleId": 60,
      "reason": "一次申请",
      "contribution": "x"
    },
    "response": {
      "id": 75,
      "projectId": 55,
      "roleId": 60,
      "status": "pending",
      "reason": "一次申请",
      "contribution": "x",
      "snapshot": {
        "nickname": "Bob（申请人B）",
        "bio": "前端学习者",
        "skills": [
          "HTML",
          "CSS",
          "JavaScript"
        ],
        "weeklyHours": 10
      }
    }
  },
  "dupPending": {
    "method": "POST",
    "path": "/api/applications",
    "status": 400,
    "requestBody": {
      "projectId": 55,
      "roleId": 60,
      "reason": "重复 pending",
      "contribution": "x"
    },
    "response": {
      "error": "该项目已有待审核申请，请先等待审核或撤回后再申请"
    }
  },
  "accept1": {
    "method": "POST",
    "path": "/api/applications/75/accept",
    "status": 200,
    "requestBody": null,
    "response": {
      "handled": false,
      "message": "已接受",
      "applicationId": 75,
      "memberId": 85,
      "status": "accepted",
      "project": {
        "id": 55,
        "title": "[TMP] T6-1791644439003",
        "goal": "幂等与冲突",
        "progress": "",
        "expectedOutcome": "",
        "paused": false,
        "ownerId": 1,
        "owner": {
          "id": 1,
          "username": "alice",
          "nickname": "Alice（发起人A）",
          "bio": "喜欢带队做实践项目（浏览器验收已更新）",
          "skills": [
            "Vue",
            "项目管理"
          ],
          "weeklyHours": 12
        },
        "roles": [
          {
            "id": 60,
            "name": "前端开发",
            "skillRequirements": [
              "Web"
            ],
            "capacity": 2,
            "filled": 1,
            "remaining": 1
          }
        ],
        "members": [
          {
            "id": 84,
            "userId": 1,
            "username": "alice",
            "nickname": "Alice（发起人A）",
            "roleId": null,
            "roleName": "发起人",
            "isOwner": true,
            "joinedAt": "2026-10-10T15:00:39.011Z"
          },
          {
            "id": 85,
            "userId": 2,
            "username": "bob",
            "nickname": "Bob（申请人B）",
            "roleId": 60,
            "roleName": "前端开发",
            "isOwner": false,
            "joinedAt": "2026-10-10T15:00:39.055Z"
          }
        ],
        "recruitStatus": "open",
        "createdAt": "2026-10-10T15:00:39.011Z"
      }
    }
  },
  "accept2": {
    "method": "POST",
    "path": "/api/applications/75/accept",
    "status": 200,
    "requestBody": null,
    "response": {
      "handled": true,
      "message": "已处理",
      "applicationId": 75,
      "memberId": 85,
      "status": "accepted"
    }
  },
  "applyAfterJoin": {
    "method": "POST",
    "path": "/api/applications",
    "status": 400,
    "requestBody": {
      "projectId": 55,
      "roleId": 60,
      "reason": "已成为成员后再申请",
      "contribution": "x"
    },
    "response": {
      "error": "你已是该项目成员，不能再提交待审核申请"
    }
  },
  "filled": 1,
  "members": [
    {
      "id": 84,
      "userId": 1,
      "username": "alice",
      "nickname": "Alice（发起人A）",
      "roleId": null,
      "roleName": "发起人",
      "isOwner": true,
      "joinedAt": "2026-10-10T15:00:39.011Z"
    },
    {
      "id": 85,
      "userId": 2,
      "username": "bob",
      "nickname": "Bob（申请人B）",
      "roleId": 60,
      "roleName": "前端开发",
      "isOwner": false,
      "joinedAt": "2026-10-10T15:00:39.055Z"
    }
  ],
  "db": "1|0"
}
```

## T7 PASS — 普通用户审核/暂停/读他人正文 403；发起人只能管自己的项目

```json
{
  "bobAccept": {
    "method": "POST",
    "path": "/api/applications/76/accept",
    "status": 403,
    "requestBody": null,
    "response": {
      "error": "仅发起人可审核该申请"
    }
  },
  "bobPause": {
    "method": "POST",
    "path": "/api/projects/56/pause",
    "status": 403,
    "requestBody": null,
    "response": {
      "error": "仅发起人可暂停招募"
    }
  },
  "bobResume": {
    "method": "POST",
    "path": "/api/projects/56/resume",
    "status": 403,
    "requestBody": null,
    "response": {
      "error": "仅发起人可恢复招募"
    }
  },
  "daveRead": {
    "method": "GET",
    "path": "/api/applications/76",
    "status": 403,
    "requestBody": null,
    "response": {
      "error": "无权查看该申请正文"
    }
  },
  "aliceManageOwnStatus": 200,
  "aliceManageOthers": {
    "method": "GET",
    "path": "/api/applications/project/57",
    "status": 403,
    "requestBody": null,
    "response": {
      "error": "仅发起人可查看本项目全部申请"
    }
  }
}
```

## T8 PASS — 申请后改资料，发起人仍见提交时快照

```json
{
  "projectId": 58,
  "appSnapshot": {
    "nickname": "Bob（申请人B）",
    "bio": "前端学习者",
    "skills": [
      "HTML",
      "CSS",
      "JavaScript"
    ],
    "weeklyHours": 10
  },
  "ownerViewSnapshot": {
    "nickname": "Bob（申请人B）",
    "bio": "前端学习者",
    "skills": [
      "HTML",
      "CSS",
      "JavaScript"
    ],
    "weeklyHours": 10
  },
  "bobProfileAfterChange": {
    "nickname": "Bob已改名-1791644439509",
    "skills": [
      "ChangedSkill"
    ],
    "weeklyHours": 99
  }
}
```

## T9 PASS — 重建 app 容器（保留数据卷）后数据仍可读

```json
{
  "projectId": 59,
  "appId": 78,
  "accept": {
    "method": "POST",
    "path": "/api/applications/78/accept",
    "status": 200,
    "requestBody": null,
    "response": {
      "handled": false,
      "message": "已接受",
      "applicationId": 78,
      "memberId": 90,
      "status": "accepted",
      "project": {
        "id": 59,
        "title": "[TMP] T9-persist-1791644439567",
        "goal": "持久化",
        "progress": "v1",
        "expectedOutcome": "仍在",
        "paused": false,
        "ownerId": 1,
        "owner": {
          "id": 1,
          "username": "alice",
          "nickname": "Alice（发起人A）",
          "bio": "喜欢带队做实践项目（浏览器验收已更新）",
          "skills": [
            "Vue",
            "项目管理"
          ],
          "weeklyHours": 12
        },
        "roles": [
          {
            "id": 64,
            "name": "前端开发",
            "skillRequirements": [
              "Web"
            ],
            "capacity": 1,
            "filled": 1,
            "remaining": 0
          }
        ],
        "members": [
          {
            "id": 89,
            "userId": 1,
            "username": "alice",
            "nickname": "Alice（发起人A）",
            "roleId": null,
            "roleName": "发起人",
            "isOwner": true,
            "joinedAt": "2026-10-10T15:00:39.580Z"
          },
          {
            "id": 90,
            "userId": 3,
            "username": "carol",
            "nickname": "Carol（申请人C）",
            "roleId": 64,
            "roleName": "前端开发",
            "isOwner": false,
            "joinedAt": "2026-10-10T15:00:39.610Z"
          }
        ],
        "recruitStatus": "full",
        "createdAt": "2026-10-10T15:00:39.580Z"
      }
    }
  },
  "healthy": true,
  "detailTitle": "[TMP] T9-persist-1791644439567",
  "filled": 1,
  "carolAppStatus": "accepted",
  "db": "[TMP] T9-persist-1791644439567|2|accepted"
}
```

## SEED PASS — 种子：4账号+3状态项目+竞争场景；发起人不占名额

```json
{
  "users": [
    "alice",
    "bob",
    "carol",
    "dave"
  ],
  "projects": "[SEED] 单名额竞争样例|f\n[SEED] 已满员样例|f\n[SEED] 招募中-筛选样例|f\n[SEED] 暂停招募样例|t",
  "race": "[SEED] 单名额竞争样例|1|0|2",
  "ownerNotCounted": "[SEED] 单名额竞争样例|1|0\n[SEED] 已满员样例|1|1\n[SEED] 招募中-筛选样例|1|0\n[SEED] 暂停招募样例|1|0"
}
```

## 未通过列表

无（本轮全部通过）

