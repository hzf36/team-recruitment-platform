# 第二轮验收验证（真实 API + 数据库）

- 时间：2026-10-11T10:27:59.424Z
- 目标：http://localhost:8080
- 命令：`node scripts/round2-tests.mjs`（当前进程 PATH 含 Docker CLI）
- 汇总：10/10 通过
- 原始响应：[`docs/round2-raw-responses.json`](./round2-raw-responses.json)

## T1 PASS — 关键词+角色+技能集合全部包含（trim/大小写；非子串；非跨角色）

```json
{
  "precondition": "seed open project with 前端(Vue,JavaScript) and 测试(Python,测试)",
  "matchingRule": "skill tags: trim + case-fold, exact set membership (Java ≠ JavaScript)",
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
  "negativeSubstringJava": {
    "status": 200,
    "missSubIds": []
  },
  "conclusion": "正例集合命中；跨角色/部分技能/Java⊂JavaScript 反例均不命中"
}
```

## T2 PASS — 撤回后重申保留旧记录；拒绝须填写并展示原因

```json
{
  "projectId": 87,
  "app1": {
    "method": "POST",
    "path": "/api/applications",
    "status": 201,
    "requestBody": {
      "projectId": 87,
      "roleId": 93,
      "reason": "第一次申请",
      "contribution": "页面"
    },
    "response": {
      "id": 101,
      "projectId": 87,
      "roleId": 93,
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
    "path": "/api/applications/101/withdraw",
    "status": 200,
    "requestBody": null,
    "response": {
      "id": 101,
      "status": "withdrawn"
    }
  },
  "app2": {
    "method": "POST",
    "path": "/api/applications",
    "status": 201,
    "requestBody": {
      "projectId": 87,
      "roleId": 93,
      "reason": "撤回后重新申请",
      "contribution": "页面+联调"
    },
    "response": {
      "id": 102,
      "projectId": 87,
      "roleId": 93,
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
    "path": "/api/applications/102/reject",
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
    "path": "/api/applications/102/reject",
    "status": 200,
    "requestBody": {
      "reason": "近期时间不匹配"
    },
    "response": {
      "id": 102,
      "status": "rejected",
      "rejectReason": "近期时间不匹配"
    }
  },
  "bobApplications": [
    {
      "id": 102,
      "projectId": 87,
      "projectTitle": "[TMP] T2-1791714471720",
      "roleId": 93,
      "roleName": "前端开发",
      "applicantId": 2,
      "applicantUsername": "bob",
      "status": "rejected",
      "rejectReason": "近期时间不匹配",
      "createdAt": "2026-10-11T10:27:51.779Z",
      "updatedAt": "2026-10-11T10:27:51.809Z",
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
      "id": 101,
      "projectId": 87,
      "projectTitle": "[TMP] T2-1791714471720",
      "roleId": 93,
      "roleName": "前端开发",
      "applicantId": 2,
      "applicantUsername": "bob",
      "status": "withdrawn",
      "rejectReason": null,
      "createdAt": "2026-10-11T10:27:51.748Z",
      "updatedAt": "2026-10-11T10:27:51.763Z",
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
  "dbApps": "101|withdrawn|\n102|rejected|近期时间不匹配"
}
```

## T3 PASS — 暂停禁新申请，pending 仍可审；恢复后有名额可申请

```json
{
  "projectId": 88,
  "pending": {
    "method": "POST",
    "path": "/api/applications",
    "status": 201,
    "requestBody": {
      "projectId": 88,
      "roleId": 94,
      "reason": "暂停前申请",
      "contribution": "x"
    },
    "response": {
      "id": 103,
      "projectId": 88,
      "roleId": 94,
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
      "projectId": 88,
      "roleId": 94,
      "reason": "暂停中申请",
      "contribution": "y"
    },
    "response": {
      "error": "项目已暂停招募，暂不可新申请"
    }
  },
  "acceptWhilePaused": {
    "method": "POST",
    "path": "/api/applications/103/accept",
    "status": 200,
    "requestBody": null,
    "response": {
      "handled": false,
      "message": "已接受",
      "applicationId": 103,
      "memberId": 126,
      "status": "accepted",
      "project": {
        "id": 88,
        "title": "[TMP] T3-1791714472014",
        "goal": "暂停恢复",
        "progress": "审计占位进展",
        "expectedOutcome": "审计占位成果",
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
            "id": 94,
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
            "id": 125,
            "userId": 1,
            "username": "alice",
            "nickname": "Alice（发起人A）",
            "roleId": null,
            "roleName": "发起人",
            "isOwner": true,
            "joinedAt": "2026-10-11T10:27:52.017Z"
          },
          {
            "id": 126,
            "userId": 2,
            "username": "bob",
            "nickname": "Bob（申请人B）",
            "roleId": 94,
            "roleName": "前端开发",
            "isOwner": false,
            "joinedAt": "2026-10-11T10:27:52.085Z"
          }
        ],
        "recruitStatus": "paused",
        "createdAt": "2026-10-11T10:27:52.017Z"
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
      "projectId": 88,
      "roleId": 94,
      "reason": "恢复后申请",
      "contribution": "y"
    },
    "response": {
      "id": 104,
      "projectId": 88,
      "roleId": 94,
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
    "id": 94,
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
  "projectId": 89,
  "appB": {
    "status": 201,
    "id": 105
  },
  "appC": {
    "status": 201,
    "id": 106
  },
  "acceptB": {
    "method": "POST",
    "path": "/api/applications/105/accept",
    "status": 200,
    "requestBody": null,
    "response": {
      "handled": false,
      "message": "已接受",
      "applicationId": 105,
      "memberId": 128,
      "status": "accepted",
      "project": {
        "id": 89,
        "title": "[TMP] T4-full-1791714472134",
        "goal": "满员后待审申请独立性",
        "progress": "审计占位进展",
        "expectedOutcome": "审计占位成果",
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
            "id": 95,
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
            "id": 127,
            "userId": 1,
            "username": "alice",
            "nickname": "Alice（发起人A）",
            "roleId": null,
            "roleName": "发起人",
            "isOwner": true,
            "joinedAt": "2026-10-11T10:27:52.148Z"
          },
          {
            "id": 128,
            "userId": 2,
            "username": "bob",
            "nickname": "Bob（申请人B）",
            "roleId": 95,
            "roleName": "前端开发",
            "isOwner": false,
            "joinedAt": "2026-10-11T10:27:52.194Z"
          }
        ],
        "recruitStatus": "full",
        "createdAt": "2026-10-11T10:27:52.148Z"
      }
    }
  },
  "detailRolesAfterFill": [
    {
      "id": 95,
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
      "projectId": 89,
      "roleId": 95,
      "reason": "试图加入满员项目",
      "contribution": "z"
    },
    "response": {
      "error": "该角色名额已满，无法申请"
    }
  },
  "acceptPending": {
    "method": "POST",
    "path": "/api/applications/106/accept",
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
    "id": 106,
    "projectId": 89,
    "projectTitle": "[TMP] T4-full-1791714472134",
    "roleId": 95,
    "roleName": "前端开发",
    "applicantId": 3,
    "applicantUsername": "carol",
    "status": "pending",
    "rejectReason": null,
    "createdAt": "2026-10-11T10:27:52.179Z",
    "updatedAt": "2026-10-11T10:27:52.179Z",
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
    "path": "/api/applications/106/reject",
    "status": 200,
    "requestBody": {
      "reason": "角色已满，抱歉"
    },
    "response": {
      "id": 106,
      "status": "rejected",
      "rejectReason": "角色已满，抱歉"
    }
  },
  "bobFinal": {
    "id": 105,
    "status": "accepted"
  },
  "carolFinal": {
    "id": 106,
    "status": "rejected",
    "rejectReason": "角色已满，抱歉"
  },
  "db": "1|1|0|1"
}
```

## T5 PASS — 并发接受最后 1 名额，最多一人成功

```json
{
  "projectId": 90,
  "appB": {
    "status": 201,
    "id": 107
  },
  "appC": {
    "status": 201,
    "id": 108
  },
  "concurrentResponses": [
    {
      "method": "POST",
      "path": "/api/applications/107/accept",
      "status": 200,
      "requestBody": null,
      "response": {
        "handled": false,
        "message": "已接受",
        "applicationId": 107,
        "memberId": 130,
        "status": "accepted",
        "project": {
          "id": 90,
          "title": "[TMP] T5-race-1791714472480",
          "goal": "并发竞争",
          "progress": "审计占位进展",
          "expectedOutcome": "审计占位成果",
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
              "id": 96,
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
              "id": 129,
              "userId": 1,
              "username": "alice",
              "nickname": "Alice（发起人A）",
              "roleId": null,
              "roleName": "发起人",
              "isOwner": true,
              "joinedAt": "2026-10-11T10:27:52.488Z"
            },
            {
              "id": 130,
              "userId": 2,
              "username": "bob",
              "nickname": "Bob（申请人B）",
              "roleId": 96,
              "roleName": "前端开发",
              "isOwner": false,
              "joinedAt": "2026-10-11T10:27:52.527Z"
            }
          ],
          "recruitStatus": "full",
          "createdAt": "2026-10-11T10:27:52.488Z"
        }
      }
    },
    {
      "method": "POST",
      "path": "/api/applications/108/accept",
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
      "id": 96,
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
      "id": 108,
      "status": "pending"
    },
    {
      "id": 107,
      "status": "accepted"
    }
  ],
  "recruitMembers": [
    {
      "id": 130,
      "userId": 2,
      "username": "bob",
      "nickname": "Bob（申请人B）",
      "roleId": 96,
      "roleName": "前端开发",
      "isOwner": false,
      "joinedAt": "2026-10-11T10:27:52.527Z"
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
  "projectId": 91,
  "app": {
    "method": "POST",
    "path": "/api/applications",
    "status": 201,
    "requestBody": {
      "projectId": 91,
      "roleId": 97,
      "reason": "一次申请",
      "contribution": "x"
    },
    "response": {
      "id": 109,
      "projectId": 91,
      "roleId": 97,
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
      "projectId": 91,
      "roleId": 97,
      "reason": "重复 pending",
      "contribution": "x"
    },
    "response": {
      "error": "该项目已有待审核申请，请先等待审核或撤回后再申请"
    }
  },
  "accept1": {
    "method": "POST",
    "path": "/api/applications/109/accept",
    "status": 200,
    "requestBody": null,
    "response": {
      "handled": false,
      "message": "已接受",
      "applicationId": 109,
      "memberId": 132,
      "status": "accepted",
      "project": {
        "id": 91,
        "title": "[TMP] T6-1791714472775",
        "goal": "幂等与冲突",
        "progress": "审计占位进展",
        "expectedOutcome": "审计占位成果",
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
            "id": 97,
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
            "id": 131,
            "userId": 1,
            "username": "alice",
            "nickname": "Alice（发起人A）",
            "roleId": null,
            "roleName": "发起人",
            "isOwner": true,
            "joinedAt": "2026-10-11T10:27:52.781Z"
          },
          {
            "id": 132,
            "userId": 2,
            "username": "bob",
            "nickname": "Bob（申请人B）",
            "roleId": 97,
            "roleName": "前端开发",
            "isOwner": false,
            "joinedAt": "2026-10-11T10:27:52.826Z"
          }
        ],
        "recruitStatus": "open",
        "createdAt": "2026-10-11T10:27:52.781Z"
      }
    }
  },
  "accept2": {
    "method": "POST",
    "path": "/api/applications/109/accept",
    "status": 200,
    "requestBody": null,
    "response": {
      "handled": true,
      "message": "已处理",
      "applicationId": 109,
      "memberId": 132,
      "status": "accepted"
    }
  },
  "applyAfterJoin": {
    "method": "POST",
    "path": "/api/applications",
    "status": 400,
    "requestBody": {
      "projectId": 91,
      "roleId": 97,
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
      "id": 131,
      "userId": 1,
      "username": "alice",
      "nickname": "Alice（发起人A）",
      "roleId": null,
      "roleName": "发起人",
      "isOwner": true,
      "joinedAt": "2026-10-11T10:27:52.781Z"
    },
    {
      "id": 132,
      "userId": 2,
      "username": "bob",
      "nickname": "Bob（申请人B）",
      "roleId": 97,
      "roleName": "前端开发",
      "isOwner": false,
      "joinedAt": "2026-10-11T10:27:52.826Z"
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
    "path": "/api/applications/110/accept",
    "status": 403,
    "requestBody": null,
    "response": {
      "error": "仅发起人可审核该申请"
    }
  },
  "bobPause": {
    "method": "POST",
    "path": "/api/projects/92/pause",
    "status": 403,
    "requestBody": null,
    "response": {
      "error": "仅发起人可暂停招募"
    }
  },
  "bobResume": {
    "method": "POST",
    "path": "/api/projects/92/resume",
    "status": 403,
    "requestBody": null,
    "response": {
      "error": "仅发起人可恢复招募"
    }
  },
  "daveRead": {
    "method": "GET",
    "path": "/api/applications/110",
    "status": 403,
    "requestBody": null,
    "response": {
      "error": "无权查看该申请正文"
    }
  },
  "aliceManageOwnStatus": 200,
  "aliceManageOthers": {
    "method": "GET",
    "path": "/api/applications/project/93",
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
  "projectId": 94,
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
    "nickname": "Bob已改名-1791714473231",
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
  "projectId": 95,
  "appId": 112,
  "accept": {
    "method": "POST",
    "path": "/api/applications/112/accept",
    "status": 200,
    "requestBody": null,
    "response": {
      "handled": false,
      "message": "已接受",
      "applicationId": 112,
      "memberId": 137,
      "status": "accepted",
      "project": {
        "id": 95,
        "title": "[TMP] T9-persist-1791714473289",
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
            "id": 101,
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
            "id": 136,
            "userId": 1,
            "username": "alice",
            "nickname": "Alice（发起人A）",
            "roleId": null,
            "roleName": "发起人",
            "isOwner": true,
            "joinedAt": "2026-10-11T10:27:53.300Z"
          },
          {
            "id": 137,
            "userId": 3,
            "username": "carol",
            "nickname": "Carol（申请人C）",
            "roleId": 101,
            "roleName": "前端开发",
            "isOwner": false,
            "joinedAt": "2026-10-11T10:27:53.330Z"
          }
        ],
        "recruitStatus": "full",
        "createdAt": "2026-10-11T10:27:53.300Z"
      }
    }
  },
  "healthy": true,
  "detailTitle": "[TMP] T9-persist-1791714473289",
  "filled": 1,
  "carolAppStatus": "accepted",
  "db": "[TMP] T9-persist-1791714473289|2|accepted"
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

