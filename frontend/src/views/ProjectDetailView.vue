<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { api, ApiError } from "../api";
import { authState, refreshMe } from "../auth";

const props = defineProps<{ id: string }>();

type Role = {
  id: number;
  name: string;
  skillRequirements: string[];
  capacity: number;
  filled: number;
  remaining: number;
};

type Member = {
  id: number;
  userId: number;
  nickname: string;
  username: string;
  roleName: string;
  isOwner: boolean;
};

type Project = {
  id: number;
  title: string;
  goal: string;
  progress: string;
  expectedOutcome: string;
  paused: boolean;
  ownerId: number;
  owner: {
    nickname: string;
    bio: string;
    skills: string[];
    weeklyHours: number;
  };
  roles: Role[];
  members: Member[];
  recruitStatus: string;
};

type Application = {
  id: number;
  roleName: string;
  applicantUsername: string;
  status: string;
  reason: string;
  contribution: string;
  rejectReason: string | null;
  createdAt: string;
  snapshot: {
    nickname: string;
    bio: string;
    skills: string[];
    weeklyHours: number;
  };
};

const project = ref<Project | null>(null);
const applications = ref<Application[]>([]);
const roleId = ref<number | null>(null);
const reason = ref("");
const contribution = ref("");
const rejectDrafts = ref<Record<number, string>>({});
const error = ref("");
const message = ref("");
const loading = ref(false);
const busy = ref("");

const isOwner = computed(
  () => !!project.value && project.value.ownerId === authState.user?.id,
);

const openRoles = computed(
  () => project.value?.roles.filter((r) => r.remaining > 0) ?? [],
);

const statusBanner = computed(() => {
  if (!project.value) return null;
  if (project.value.paused) {
    return {
      class: "warn",
      text: "已暂停，暂不可提交新申请；待审核仍可由发起人处理。",
    };
  }
  if (project.value.recruitStatus === "full") {
    return {
      class: "danger",
      text: "全部角色已满；待审核不会自动通过，发起人仍可拒绝。",
    };
  }
  return {
    class: "ok",
    text: "招募中，可申请仍有名额的角色。",
  };
});

function statusText(s: string) {
  return (
    {
      pending: "待审核",
      accepted: "已通过",
      rejected: "已拒绝",
      withdrawn: "已撤回",
    } as Record<string, string>
  )[s] || s;
}

function statusClass(s: string) {
  return (
    {
      pending: "status-pending",
      accepted: "status-accepted",
      rejected: "status-rejected",
      withdrawn: "status-withdrawn",
    } as Record<string, string>
  )[s] || "";
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { hour12: false });
}

async function load(options?: { keepError?: string; keepMessage?: string }) {
  const preservedError = options?.keepError;
  const preservedMessage = options?.keepMessage;
  if (!preservedError) error.value = "";
  if (!preservedMessage) {
    /* keep existing success unless replaced by caller */
  }
  loading.value = true;
  try {
    // Hard refresh can race App.vue refreshMe; ensure owner check sees current user
    if (!authState.loaded) {
      await refreshMe();
    }
    project.value = await api<Project>(`/api/projects/${props.id}`);
    if (!isOwner.value) {
      const selectable = project.value.roles.filter((r) => r.remaining > 0);
      if (!selectable.some((r) => r.id === roleId.value)) {
        roleId.value = selectable[0]?.id ?? null;
      }
    }
    if (isOwner.value) {
      const data = await api<{ items: Application[] }>(
        `/api/applications/project/${props.id}`,
      );
      applications.value = data.items;
    } else {
      applications.value = [];
    }
    if (preservedError) error.value = preservedError;
    if (preservedMessage) message.value = preservedMessage;
  } catch (e) {
    error.value = preservedError
      ? preservedError
      : e instanceof ApiError
        ? e.message
        : "加载失败";
    if (!preservedError) project.value = null;
  } finally {
    loading.value = false;
  }
}

async function syncAfterConflict(feedback: string) {
  error.value = feedback;
  await load({ keepError: feedback });
}

async function apply() {
  if (busy.value) return;
  message.value = "";
  error.value = "";
  if (!reason.value.trim()) {
    error.value = "请填写申请理由";
    return;
  }
  busy.value = "apply";
  try {
    await api("/api/applications", {
      method: "POST",
      body: JSON.stringify({
        projectId: Number(props.id),
        roleId: Number(roleId.value),
        reason: reason.value.trim(),
        contribution: contribution.value,
      }),
    });
    message.value = "申请已提交，可在「我的申请」查看进度";
    reason.value = "";
    contribution.value = "";
    await load();
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "申请失败";
  } finally {
    busy.value = "";
  }
}

async function accept(appId: number) {
  if (busy.value) return;
  message.value = "";
  error.value = "";
  busy.value = `accept-${appId}`;
  try {
    const result = await api<{ message: string; handled?: boolean }>(
      `/api/applications/${appId}/accept`,
      { method: "POST" },
    );
    message.value = result.handled
      ? `申请 #${appId}：已处理（未重复占位）`
      : `申请 #${appId}：${result.message}`;
    await load({ keepMessage: message.value });
  } catch (e) {
    const feedback = e instanceof ApiError ? e.message : "接受失败";
    await syncAfterConflict(feedback);
  } finally {
    busy.value = "";
  }
}

async function reject(appId: number) {
  if (busy.value) return;
  const rejectReason = (rejectDrafts.value[appId] || "").trim();
  if (!rejectReason) {
    error.value = `拒绝申请 #${appId} 时请填写原因`;
    return;
  }
  message.value = "";
  error.value = "";
  busy.value = `reject-${appId}`;
  try {
    await api(`/api/applications/${appId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: rejectReason }),
    });
    message.value = `申请 #${appId} 已拒绝`;
    rejectDrafts.value[appId] = "";
    await load({ keepMessage: message.value });
  } catch (e) {
    const feedback = e instanceof ApiError ? e.message : "拒绝失败";
    await syncAfterConflict(feedback);
  } finally {
    busy.value = "";
  }
}

async function togglePause() {
  if (!project.value || busy.value) return;
  message.value = "";
  error.value = "";
  busy.value = "pause";
  try {
    const path = project.value.paused ? "resume" : "pause";
    project.value = await api(`/api/projects/${props.id}/${path}`, {
      method: "POST",
    });
    message.value = project.value.paused
      ? "已暂停招募：暂不可新申请"
      : "已恢复招募：有名额的角色可继续申请";
    await load({ keepMessage: message.value });
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "操作失败";
  } finally {
    busy.value = "";
  }
}

watch(
  () => props.id,
  () => {
    void load();
  },
);

// After transient /me failure + retry, re-run owner application fetch
watch(
  () => authState.user?.id,
  (id, prev) => {
    if (id && id !== prev && project.value) {
      void load();
    }
  },
);

onMounted(load);
</script>

<template>
  <div v-if="loading && !project" class="card">正在加载项目…</div>
  <div v-else-if="!project" class="card">
    <p class="error">{{ error || "项目不存在或无法加载" }}</p>
    <router-link to="/">返回列表</router-link>
  </div>
  <div v-else>
    <div class="row space-between">
      <h1 class="page-title">{{ project.title }}</h1>
      <span
        class="badge"
        :class="{
          warn: project.recruitStatus === 'paused',
          danger: project.recruitStatus === 'full',
          ok: project.recruitStatus === 'open',
        }"
      >
        {{
          project.recruitStatus === "paused"
            ? "暂停招募"
            : project.recruitStatus === "full"
              ? "招募已满"
              : "招募中"
        }}
      </span>
    </div>

    <div v-if="statusBanner" class="card">
      <p
        class="page-hint"
        :class="{
          success: statusBanner.class === 'ok',
          error: statusBanner.class === 'danger',
        }"
        :style="statusBanner.class === 'warn' ? { color: 'var(--warn)' } : undefined"
      >
        {{ statusBanner.text }}
      </p>
    </div>

    <p v-if="message" class="success">{{ message }}</p>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="card stack">
      <div><strong>目标：</strong>{{ project.goal }}</div>
      <div><strong>进展：</strong>{{ project.progress || "—" }}</div>
      <div><strong>预期成果：</strong>{{ project.expectedOutcome || "—" }}</div>
      <div>
        <strong>发起人：</strong>{{ project.owner.nickname }} ·
        技能 {{ project.owner.skills.join(", ") || "—" }} ·
        每周 {{ project.owner.weeklyHours }} 小时
      </div>
      <div class="muted">{{ project.owner.bio }}</div>
      <div v-if="isOwner">
        <button type="button" :disabled="!!busy" @click="togglePause">
          {{
            busy === "pause"
              ? "处理中…"
              : project.paused
                ? "恢复招募"
                : "暂停招募"
          }}
        </button>
      </div>
    </div>

    <div class="card">
      <h2>招募角色与剩余名额</h2>
      <div class="role-table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>角色</th>
              <th>技能要求</th>
              <th>已加入</th>
              <th>上限</th>
              <th>剩余</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in project.roles" :key="r.id">
              <td>{{ r.name }}</td>
              <td>{{ r.skillRequirements.join(", ") || "—" }}</td>
              <td>{{ r.filled }}</td>
              <td>{{ r.capacity }}</td>
              <td>{{ r.remaining }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="role-cards">
        <div v-for="r in project.roles" :key="r.id" class="role-card">
          <h3>{{ r.name }}</h3>
          <dl>
            <dt>技能要求</dt>
            <dd>{{ r.skillRequirements.join(", ") || "—" }}</dd>
            <dt>已加入</dt>
            <dd>{{ r.filled }}</dd>
            <dt>上限</dt>
            <dd>{{ r.capacity }}</dd>
            <dt>剩余</dt>
            <dd>{{ r.remaining }}</dd>
          </dl>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>成员名单</h2>
      <p v-if="project.members.length === 0" class="muted">暂无成员</p>
      <ul v-else>
        <li v-for="m in project.members" :key="m.id">
          {{ m.nickname }}（{{ m.username }}）· {{ m.roleName }}
          <span v-if="m.isOwner" class="badge">不占名额</span>
        </li>
      </ul>
    </div>

    <div v-if="!isOwner" class="card stack">
      <h2>申请加入</h2>
      <p v-if="project.paused" class="error">项目已暂停，无法提交新申请。</p>
      <p v-else-if="openRoles.length === 0" class="error">
        所有角色已满员，无法提交新申请。
      </p>
      <template v-else>
        <label>
          选择角色
          <select v-model.number="roleId">
            <option v-for="r in openRoles" :key="r.id" :value="r.id">
              {{ r.name }}（剩余 {{ r.remaining }}）
            </option>
          </select>
        </label>
        <label>
          申请理由
          <textarea v-model="reason" rows="3" />
        </label>
        <label>
          可承担内容
          <textarea v-model="contribution" rows="2" />
        </label>
        <button
          class="primary"
          type="button"
          :disabled="busy === 'apply'"
          @click="apply"
        >
          {{ busy === "apply" ? "提交中…" : "提交申请" }}
        </button>
      </template>
      <p class="muted">申请内容仅你和发起人可见。</p>
    </div>

    <div v-if="isOwner" class="card">
      <h2>本项目申请</h2>
      <p class="muted page-hint">申请正文仅发起人可见。</p>
      <p v-if="applications.length === 0" class="muted">暂无申请</p>
      <div v-for="a in applications" :key="a.id" class="card stack">
        <div class="row space-between">
          <strong>
            #{{ a.id }} {{ a.snapshot.nickname }}（{{ a.applicantUsername }}）·
            {{ a.roleName }}
          </strong>
          <span class="badge" :class="statusClass(a.status)">
            {{ statusText(a.status) }}
          </span>
        </div>
        <div class="time-meta">提交时间：{{ formatTime(a.createdAt) }}</div>
        <div>
          提交时资料快照：技能 {{ a.snapshot.skills.join(", ") || "—" }}；每周
          {{ a.snapshot.weeklyHours }} 小时
        </div>
        <div class="muted">{{ a.snapshot.bio }}</div>
        <div>理由：{{ a.reason }}</div>
        <div v-if="a.contribution">可承担：{{ a.contribution }}</div>
        <div v-if="a.rejectReason" class="error">拒绝原因：{{ a.rejectReason }}</div>
        <div v-if="a.status === 'pending'" class="stack">
          <label>
            拒绝原因（必填）
            <input v-model="rejectDrafts[a.id]" placeholder="简短说明" />
          </label>
          <div class="row">
            <button
              class="primary"
              type="button"
              :disabled="!!busy"
              @click="accept(a.id)"
            >
              {{ busy === `accept-${a.id}` ? "接受中…" : "接受" }}
            </button>
            <button
              class="danger"
              type="button"
              :disabled="!!busy"
              @click="reject(a.id)"
            >
              {{ busy === `reject-${a.id}` ? "拒绝中…" : "拒绝" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
