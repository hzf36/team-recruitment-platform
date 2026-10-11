<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { api, ApiError } from "../api";

const router = useRouter();
const title = ref("");
const goal = ref("");
const progress = ref("");
const expectedOutcome = ref("");
const roles = ref([
  { name: "前端开发", skillRequirementsText: "Web, JavaScript", capacity: 1 },
  { name: "测试工程师", skillRequirementsText: "Python, 测试", capacity: 1 },
]);
const error = ref("");
const message = ref("");
const loading = ref(false);

function addRole() {
  roles.value.push({ name: "", skillRequirementsText: "", capacity: 1 });
}

async function submit() {
  if (loading.value) return;
  error.value = "";
  message.value = "";
  const body = {
    title: title.value.trim(),
    goal: goal.value.trim(),
    progress: progress.value.trim(),
    expectedOutcome: expectedOutcome.value.trim(),
    roles: roles.value.map((r) => ({
      name: r.name.trim(),
      skillRequirements: r.skillRequirementsText
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
      capacity: Number(r.capacity),
    })),
  };
  if (!body.title || !body.goal || !body.progress || !body.expectedOutcome) {
    error.value = "请填写标题、目标、当前进展与预期成果";
    return;
  }
  if (
    body.roles.some(
      (r) => !r.name || !Number.isInteger(r.capacity) || r.capacity < 1,
    )
  ) {
    error.value = "每个角色需有名称，且人数上限为正整数";
    return;
  }
  if (body.roles.some((r) => r.skillRequirements.length === 0)) {
    error.value = "每个招募角色须填写至少一项技能要求（不能为空或仅空白）";
    return;
  }
  loading.value = true;
  try {
    const project = await api<{ id: number }>("/api/projects", {
      method: "POST",
      body: JSON.stringify(body),
    });
    message.value = "项目已发布，正在跳转…";
    await router.push(`/projects/${project.id}`);
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "发布失败";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="card">
    <h1 class="page-title">发布项目</h1>
    <p class="muted page-hint">至少添加一个角色。发起人会进入成员名单，但不占招募名额。</p>
    <form class="stack" @submit.prevent="submit">
      <label>标题 <input v-model="title" required /></label>
      <label>目标 <textarea v-model="goal" rows="3" required /></label>
      <label>当前进展 <textarea v-model="progress" rows="2" required /></label>
      <label>预期成果 <textarea v-model="expectedOutcome" rows="2" required /></label>

      <h3>招募角色</h3>
      <div v-for="(r, idx) in roles" :key="idx" class="card stack">
        <label>角色名称 <input v-model="r.name" required /></label>
        <label>
          技能要求（逗号分隔，至少一项）
          <input
            v-model="r.skillRequirementsText"
            required
            placeholder="如：Vue, JavaScript"
          />
        </label>
        <label>
          人数上限
          <input v-model.number="r.capacity" type="number" min="1" required />
        </label>
      </div>
      <button type="button" :disabled="loading" @click="addRole">增加角色</button>
      <p v-if="message" class="success">{{ message }}</p>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="primary" type="submit" :disabled="loading">
        {{ loading ? "发布中…" : "发布" }}
      </button>
    </form>
  </div>
</template>
