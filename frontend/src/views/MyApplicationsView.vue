<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { api, ApiError } from "../api";
import { authState, refreshMe } from "../auth";

type AppItem = {
  id: number;
  projectId: number;
  projectTitle: string;
  roleName: string;
  status: string;
  reason: string;
  contribution: string;
  rejectReason: string | null;
  createdAt: string;
};

const items = ref<AppItem[]>([]);
const error = ref("");
const message = ref("");
const loading = ref(false);
const busyId = ref<number | null>(null);

async function load() {
  error.value = "";
  loading.value = true;
  try {
    if (!authState.loaded) {
      await refreshMe();
    }
    if (!authState.user) {
      error.value = authState.error || "未登录或身份初始化失败";
      items.value = [];
      return;
    }
    const data = await api<{ items: AppItem[] }>("/api/applications/mine");
    items.value = data.items;
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "加载失败";
    items.value = [];
  } finally {
    loading.value = false;
  }
}

async function withdraw(id: number) {
  if (busyId.value) return;
  message.value = "";
  error.value = "";
  busyId.value = id;
  try {
    await api(`/api/applications/${id}/withdraw`, { method: "POST" });
    message.value = `申请 #${id} 已撤回，可重新申请同一项目`;
    await load();
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "撤回失败";
  } finally {
    busyId.value = null;
  }
}

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

watch(
  () => authState.user?.id,
  (id, prev) => {
    if (id && id !== prev) {
      void load();
    }
  },
);

onMounted(load);
</script>

<template>
  <div>
    <div class="row space-between">
      <h1 class="page-title">我的申请</h1>
      <button type="button" :disabled="loading" @click="load">
        {{ loading ? "刷新中…" : "刷新" }}
      </button>
    </div>
    <p v-if="message" class="success">{{ message }}</p>
    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="loading && items.length === 0" class="card muted">正在加载申请…</div>
    <div v-else-if="items.length === 0" class="card muted">
      暂无申请记录。可在项目详情中选择角色并提交申请。
    </div>
    <div v-for="a in items" :key="a.id" class="card stack">
      <div class="row space-between">
        <strong>
          <router-link :to="`/projects/${a.projectId}`">
            {{ a.projectTitle }}
          </router-link>
          · {{ a.roleName }}
        </strong>
        <span class="badge" :class="statusClass(a.status)">
          {{ statusText(a.status) }}
        </span>
      </div>
      <div class="time-meta">提交时间：{{ formatTime(a.createdAt) }}</div>
      <div>申请理由：{{ a.reason }}</div>
      <div v-if="a.contribution">可承担：{{ a.contribution }}</div>
      <div v-if="a.rejectReason" class="error">拒绝原因：{{ a.rejectReason }}</div>
      <div>
        <button
          v-if="a.status === 'pending'"
          type="button"
          :disabled="busyId === a.id"
          @click="withdraw(a.id)"
        >
          {{ busyId === a.id ? "撤回中…" : "撤回" }}
        </button>
      </div>
    </div>
  </div>
</template>
