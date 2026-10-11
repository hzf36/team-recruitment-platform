<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, ApiError } from "../api";

type Role = {
  id: number;
  name: string;
  skillRequirements: string[];
  capacity: number;
  filled: number;
  remaining: number;
};

type Project = {
  id: number;
  title: string;
  goal: string;
  paused: boolean;
  ownerNickname: string;
  roles: Role[];
  recruitStatus: string;
};

const items = ref<Project[]>([]);
const keyword = ref("");
const role = ref("");
const skills = ref("");
const error = ref("");
const loading = ref(false);

async function load() {
  error.value = "";
  loading.value = true;
  try {
    const qs = new URLSearchParams();
    if (keyword.value.trim()) qs.set("keyword", keyword.value.trim());
    if (role.value.trim()) qs.set("role", role.value.trim());
    if (skills.value.trim()) qs.set("skills", skills.value.trim());
    const data = await api<{ items: Project[] }>(
      `/api/projects?${qs.toString()}`,
    );
    items.value = data.items;
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "加载失败";
    items.value = [];
  } finally {
    loading.value = false;
  }
}

function clearFilters() {
  keyword.value = "";
  role.value = "";
  skills.value = "";
  void load();
}

function statusLabel(p: Project) {
  if (p.recruitStatus === "paused") return "暂停招募";
  if (p.recruitStatus === "full") return "招募已满";
  return "招募中";
}

function openRoles(p: Project) {
  return p.roles.filter((r) => r.remaining > 0);
}

function fullRoles(p: Project) {
  return p.roles.filter((r) => r.remaining <= 0);
}

onMounted(load);
</script>

<template>
  <div>
    <div class="row space-between">
      <h1 class="page-title">项目列表</h1>
      <router-link to="/projects/new">发布项目</router-link>
    </div>
    <div class="card filter-form">
      <p class="muted page-hint">
        可按关键词、角色、技能筛选；填写的条件需同时满足。
      </p>
      <div class="filter-fields">
        <label>
          关键词
          <input v-model="keyword" placeholder="标题或介绍" />
        </label>
        <label>
          招募角色
          <input v-model="role" placeholder="如：前端" />
        </label>
        <label>
          技能
          <input v-model="skills" placeholder="如：Vue, JavaScript" />
        </label>
      </div>
      <div class="filter-actions">
        <button class="primary" type="button" :disabled="loading" @click="load">
          {{ loading ? "筛选中…" : "筛选" }}
        </button>
        <button class="ghost" type="button" :disabled="loading" @click="clearFilters">
          清空筛选
        </button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </div>

    <div v-if="loading" class="card muted">正在加载项目…</div>
    <div v-else-if="items.length === 0" class="card">
      <p class="muted">没有符合条件的项目。可调整筛选，或先发布一个项目。</p>
    </div>
    <div v-for="p in items" :key="p.id" class="card">
      <div class="row space-between">
        <h2 style="margin: 0; font-size: 1.15rem">
          <router-link :to="`/projects/${p.id}`">{{ p.title }}</router-link>
        </h2>
        <span
          class="badge"
          :class="{
            warn: p.recruitStatus === 'paused',
            danger: p.recruitStatus === 'full',
            ok: p.recruitStatus === 'open',
          }"
        >
          {{ statusLabel(p) }}
        </span>
      </div>
      <p>{{ p.goal }}</p>
      <p class="muted">发起人：{{ p.ownerNickname }}</p>
      <div class="role-meta">
        <div v-if="openRoles(p).length" class="role-meta-line">
          <span>可申请：</span>
          <span
            v-for="r in openRoles(p)"
            :key="r.id"
            class="badge ok"
          >
            {{ r.name }} 余 {{ r.remaining }}/{{ r.capacity }}
          </span>
        </div>
        <div v-if="fullRoles(p).length" class="role-meta-line">
          <span>已满：</span>
          <span
            v-for="r in fullRoles(p)"
            :key="r.id"
            class="badge danger"
          >
            {{ r.name }} {{ r.filled }}/{{ r.capacity }}
          </span>
        </div>
        <p
          v-if="p.recruitStatus === 'full'"
          class="error"
          style="margin: 0"
        >
          全部角色已满，项目招募已满。
        </p>
      </div>
    </div>
  </div>
</template>
