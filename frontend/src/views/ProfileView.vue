<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { api, ApiError } from "../api";
import { authState, refreshMe } from "../auth";

const nickname = ref("");
const bio = ref("");
const skillsText = ref("");
const weeklyHours = ref(0);
const message = ref("");
const error = ref("");
const loading = ref(false);

function syncFromAuth() {
  if (authState.user) {
    error.value = "";
    nickname.value = authState.user.nickname;
    bio.value = authState.user.bio;
    skillsText.value = authState.user.skills.join(", ");
    weeklyHours.value = authState.user.weeklyHours;
    return;
  }
  if (authState.error) {
    error.value = authState.error;
  } else if (authState.loaded) {
    error.value = "未登录或身份初始化失败";
  }
}

onMounted(async () => {
  await refreshMe();
  syncFromAuth();
});

watch(
  () => [authState.user, authState.error, authState.loaded] as const,
  () => {
    syncFromAuth();
  },
);

async function save() {
  if (loading.value) return;
  message.value = "";
  error.value = "";
  loading.value = true;
  try {
    const skills = skillsText.value
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    authState.user = await api("/api/profile/me", {
      method: "PUT",
      body: JSON.stringify({
        nickname: nickname.value.trim(),
        bio: bio.value,
        skills,
        weeklyHours: Number(weeklyHours.value),
      }),
    });
    message.value = "资料已保存";
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "保存失败";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="card">
    <h1 class="page-title">个人资料</h1>
    <p class="muted page-hint">用于展示与申请快照；修改不会改写已提交申请里的旧资料。</p>
    <form class="stack" @submit.prevent="save">
      <label>
        昵称
        <input v-model="nickname" required />
      </label>
      <label>
        简介
        <textarea v-model="bio" rows="3" />
      </label>
      <label>
        技能标签（逗号分隔）
        <input v-model="skillsText" placeholder="Vue, 测试" />
      </label>
      <label>
        每周可投入时间（小时）
        <input v-model.number="weeklyHours" type="number" min="0" max="168" />
      </label>
      <p v-if="message" class="success">{{ message }}</p>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="primary" type="submit" :disabled="loading">
        {{ loading ? "保存中…" : "保存" }}
      </button>
    </form>
  </div>
</template>
