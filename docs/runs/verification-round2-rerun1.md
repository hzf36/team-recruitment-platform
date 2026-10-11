# 第二轮验收验证（真实 API + 数据库）

- 时间：2026-10-10T15:00:18.032Z
- 目标：http://localhost:8080
- 命令：`node scripts/round2-tests.mjs`（当前进程 PATH 含 Docker CLI）
- 汇总：10/10 通过
- 原始响应：[`docs/round2-raw-responses.json`](./round2-raw-responses.json)

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
  "projectId": 42,
  "app1": {
    "method": "POST",
    "path": "/api/applications",
    "status": 201,
    "requestBody": {
      "projectId": 42,
      "roleId": 47,
      "reason": "第一次申请",
      "contribution": "页面"
    },
    "response": {
      "id": 55,
      "projectId": 42,
      "roleId": 47,
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
    "path": "/api/applications/55/withdraw",
    "status": 200,
    "requestBody": null,
    "response": {
      "id": 55,
      "status": "withdrawn"
    }
  },
  "app2": {
    "method": "POST",
    "path": "/api/applications",
    "status": 201,
    "requestBody": {
      "projectId": 42,
      "roleId": 47,
      "reason": "撤回后重新申请",
      "contribution": "页面+联调"
    },
    "response": {
      "id": 56,
      "projectId": 42,
      "roleId": 47,
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
    "path": "/api/applications/56/reject",
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
    "path": "/api/applications/56/reject",
    "status": 200,
    "requestBody": {
      "reason": "近期时间不匹配"
    },
    "response": {
      "id": 56,
      "status": "rejected",
      "rejectReason": "近期时间不匹配"
    }
  },
  "bobApplications": [
    {
      "id": 56,
      "projectId": 42,
      "projectTitle": "[TMP] T2-1791644409570",
      "roleId": 47,
      "roleName": "前端开发",
      "applicantId": 2,
      "applicantUsername": "bob",
      "status": "rejected",
      "rejectReason": "近期时间不匹配",
      "createdAt": "2026-10-10T15:00:09.643Z",
      "updatedAt": "2026-10-10T15:00:09.673Z",
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
      "id": 55,
      "projectId": 42,
      "projectTitle": "[TMP] T2-1791644409570",
      "roleId": 47,
      "roleName": "前端开发",
      "applicantId": 2,
      "applicantUsername": "bob",
      "status": "withdrawn",
      "rejectReason": null,
      "createdAt": "2026-10-10T15:00:09.597Z",
      "updatedAt": "2026-10-10T15:00:09.628Z",
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
  "dbApps": "55|withdrawn|\n56|rejected|近期时间不匹配"
}
```

## T3 PASS — 暂停禁新申请，pending 仍可审；恢复后有名额可申请

```json
{
  "projectId": 43,
  "pending": {
    "method": "POST",
    "path": "/api/applications",
    "status": 201,
    "requestBody": {
      "projectId": 43,
      "roleId": 48,
      "reason": "暂停前申请",
      "contribution": "x"
    },
    "response": {
      "id": 57,
      "projectId": 43,
      "roleId": 48,
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
      "projectId": 43,
      "roleId": 48,
      "reason": "暂停中申请",
      "contribution": "y"
    },
    "response": {
      "error": "项目已暂停招募，暂不可新申请"
    }
  },
  "acceptWhilePaused": {
    "method": "POST",
    "path": "/api/applications/57/accept",
    "status": 200,
    "requestBody": null,
    "response": {
      "handled": false,
      "message": "已接受",
      "applicationId": 57,
      "memberId": 65,
      "status": "accepted",
      "project": {
        "id": 43,
        "title": "[TMP] T3-1791644410218",
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
            "id": 48,
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
            "id": 64,
            "userId": 1,
            "username": "alice",
            "nickname": "Alice（发起人A）",
            "roleId": null,
            "roleName": "发起人",
            "isOwner": true,
            "joinedAt": "2026-10-10T15:00:10.226Z"
          },
          {
            "id": 65,
            "userId": 2,
            "username": "bob",
            "nickname": "Bob（申请人B）",
            "roleId": 48,
            "roleName": "前端开发",
            "isOwner": false,
            "joinedAt": "2026-10-10T15:00:10.291Z"
          }
        ],
        "recruitStatus": "paused",
        "createdAt": "2026-10-10T15:00:10.226Z"
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
      "projectId": 43,
      "roleId": 48,
      "reason": "恢复后申请",
      "contribution": "y"
    },
    "response": {
      "id": 58,
      "projectId": 43,
      "roleId": 48,
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
    "id": 48,
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
  "projectId": 44,
  "appB": {
    "status": 201,
    "id": 59
  },
  "appC": {
    "status": 201,
    "id": 60
  },
  "acceptB": {
    "method": "POST",
    "path": "/api/applications/59/accept",
    "status": 200,
    "requestBody": null,
    "response": {
      "handled": false,
      "message": "已接受",
      "applicationId": 59,
      "memberId": 67,
      "status": "accepted",
      "project": {
        "id": 44,
        "title": "[TMP] T4-full-1791644410369",
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
            "id": 49,
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
            "id": 66,
            "userId": 1,
            "username": "alice",
            "nickname": "Alice（发起人A）",
            "roleId": null,
            "roleName": "发起人",
            "isOwner": true,
            "joinedAt": "2026-10-10T15:00:10.383Z"
          },
          {
            "id": 67,
            "userId": 2,
            "username": "bob",
            "nickname": "Bob（申请人B）",
            "roleId": 49,
            "roleName": "前端开发",
            "isOwner": false,
            "joinedAt": "2026-10-10T15:00:10.442Z"
          }
        ],
        "recruitStatus": "full",
        "createdAt": "2026-10-10T15:00:10.383Z"
      }
    }
  },
  "detailRolesAfterFill": [
    {
      "id": 49,
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
      "projectId": 44,
      "roleId": 49,
      "reason": "试图加入满员项目",
      "contribution": "z"
    },
    "response": {
      "error": "该角色名额已满，无法申请"
    }
  },
  "acceptPending": {
    "method": "POST",
    "path": "/api/applications/60/accept",
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
    "id": 60,
    "projectId": 44,
    "projectTitle": "[TMP] T4-full-1791644410369",
    "roleId": 49,
    "roleName": "前端开发",
    "applicantId": 3,
    "applicantUsername": "carol",
    "status": "pending",
    "rejectReason": null,
    "createdAt": "2026-10-10T15:00:10.428Z",
    "updatedAt": "2026-10-10T15:00:10.428Z",
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
    "path": "/api/applications/60/reject",
    "status": 200,
    "requestBody": {
      "reason": "角色已满，抱歉"
    },
    "response": {
      "id": 60,
      "status": "rejected",
      "rejectReason": "角色已满，抱歉"
    }
  },
  "bobFinal": {
    "id": 59,
    "status": "accepted"
  },
  "carolFinal": {
    "id": 60,
    "status": "rejected",
    "rejectReason": "角色已满，抱歉"
  },
  "db": "1|1|0|1"
}
```

## T5 PASS — 并发接受最后 1 名额，最多一人成功

```json
{
  "projectId": 45,
  "appB": {
    "status": 201,
    "id": 61
  },
  "appC": {
    "status": 201,
    "id": 62
  },
  "concurrentResponses": [
    {
      "method": "POST",
      "path": "/api/applications/61/accept",
      "status": 200,
      "requestBody": null,
      "response": {
        "handled": false,
        "message": "已接受",
        "applicationId": 61,
        "memberId": 69,
        "status": "accepted",
        "project": {
          "id": 45,
          "title": "[TMP] T5-race-1791644410850",
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
              "id": 50,
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
              "id": 68,
              "userId": 1,
              "username": "alice",
              "nickname": "Alice（发起人A）",
              "roleId": null,
              "roleName": "发起人",
              "isOwner": true,
              "joinedAt": "2026-10-10T15:00:10.856Z"
            },
            {
              "id": 69,
              "userId": 2,
              "username": "bob",
              "nickname": "Bob（申请人B）",
              "roleId": 50,
              "roleName": "前端开发",
              "isOwner": false,
              "joinedAt": "2026-10-10T15:00:10.898Z"
            }
          ],
          "recruitStatus": "full",
          "createdAt": "2026-10-10T15:00:10.856Z"
        }
      }
    },
    {
      "method": "POST",
      "path": "/api/applications/62/accept",
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
      "id": 50,
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
      "id": 62,
      "status": "pending"
    },
    {
      "id": 61,
      "status": "accepted"
    }
  ],
  "recruitMembers": [
    {
      "id": 69,
      "userId": 2,
      "username": "bob",
      "nickname": "Bob（申请人B）",
      "roleId": 50,
      "roleName": "前端开发",
      "isOwner": false,
      "joinedAt": "2026-10-10T15:00:10.898Z"
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
  "projectId": 46,
  "app": {
    "method": "POST",
    "path": "/api/applications",
    "status": 201,
    "requestBody": {
      "projectId": 46,
      "roleId": 51,
      "reason": "一次申请",
      "contribution": "x"
    },
    "response": {
      "id": 63,
      "projectId": 46,
      "roleId": 51,
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
      "projectId": 46,
      "roleId": 51,
      "reason": "重复 pending",
      "contribution": "x"
    },
    "response": {
      "error": "该项目已有待审核申请，请先等待审核或撤回后再申请"
    }
  },
  "accept1": {
    "method": "POST",
    "path": "/api/applications/63/accept",
    "status": 200,
    "requestBody": null,
    "response": {
      "handled": false,
      "message": "已接受",
      "applicationId": 63,
      "memberId": 71,
      "status": "accepted",
      "project": {
        "id": 46,
        "title": "[TMP] T6-1791644411231",
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
            "id": 51,
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
            "id": 70,
            "userId": 1,
            "username": "alice",
            "nickname": "Alice（发起人A）",
            "roleId": null,
            "roleName": "发起人",
            "isOwner": true,
            "joinedAt": "2026-10-10T15:00:11.241Z"
          },
          {
            "id": 71,
            "userId": 2,
            "username": "bob",
            "nickname": "Bob（申请人B）",
            "roleId": 51,
            "roleName": "前端开发",
            "isOwner": false,
            "joinedAt": "2026-10-10T15:00:11.302Z"
          }
        ],
        "recruitStatus": "open",
        "createdAt": "2026-10-10T15:00:11.241Z"
      }
    }
  },
  "accept2": {
    "method": "POST",
    "path": "/api/applications/63/accept",
    "status": 200,
    "requestBody": null,
    "response": {
      "handled": true,
      "message": "已处理",
      "applicationId": 63,
      "memberId": 71,
      "status": "accepted"
    }
  },
  "applyAfterJoin": {
    "method": "POST",
    "path": "/api/applications",
    "status": 400,
    "requestBody": {
      "projectId": 46,
      "roleId": 51,
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
      "id": 70,
      "userId": 1,
      "username": "alice",
      "nickname": "Alice（发起人A）",
      "roleId": null,
      "roleName": "发起人",
      "isOwner": true,
      "joinedAt": "2026-10-10T15:00:11.241Z"
    },
    {
      "id": 71,
      "userId": 2,
      "username": "bob",
      "nickname": "Bob（申请人B）",
      "roleId": 51,
      "roleName": "前端开发",
      "isOwner": false,
      "joinedAt": "2026-10-10T15:00:11.302Z"
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
    "path": "/api/applications/64/accept",
    "status": 403,
    "requestBody": null,
    "response": {
      "error": "仅发起人可审核该申请"
    }
  },
  "bobPause": {
    "method": "POST",
    "path": "/api/projects/47/pause",
    "status": 403,
    "requestBody": null,
    "response": {
      "error": "仅发起人可暂停招募"
    }
  },
  "bobResume": {
    "method": "POST",
    "path": "/api/projects/47/resume",
    "status": 403,
    "requestBody": null,
    "response": {
      "error": "仅发起人可恢复招募"
    }
  },
  "daveRead": {
    "method": "GET",
    "path": "/api/applications/64",
    "status": 403,
    "requestBody": null,
    "response": {
      "error": "无权查看该申请正文"
    }
  },
  "aliceManageOwnStatus": 200,
  "aliceManageOthers": {
    "method": "GET",
    "path": "/api/applications/project/48",
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
  "projectId": 49,
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
    "nickname": "Bob已改名-1791644411726",
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
  "projectId": 50,
  "appId": 66,
  "accept": {
    "method": "POST",
    "path": "/api/applications/66/accept",
    "status": 200,
    "requestBody": null,
    "response": {
      "handled": false,
      "message": "已接受",
      "applicationId": 66,
      "memberId": 76,
      "status": "accepted",
      "project": {
        "id": 50,
        "title": "[TMP] T9-persist-1791644411781",
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
            "id": 55,
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
            "id": 75,
            "userId": 1,
            "username": "alice",
            "nickname": "Alice（发起人A）",
            "roleId": null,
            "roleName": "发起人",
            "isOwner": true,
            "joinedAt": "2026-10-10T15:00:11.793Z"
          },
          {
            "id": 76,
            "userId": 3,
            "username": "carol",
            "nickname": "Carol（申请人C）",
            "roleId": 55,
            "roleName": "前端开发",
            "isOwner": false,
            "joinedAt": "2026-10-10T15:00:11.823Z"
          }
        ],
        "recruitStatus": "full",
        "createdAt": "2026-10-10T15:00:11.793Z"
      }
    }
  },
  "healthy": true,
  "detailTitle": "[TMP] T9-persist-1791644411781",
  "filled": 1,
  "carolAppStatus": "accepted",
  "db": "[TMP] T9-persist-1791644411781|2|accepted"
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

