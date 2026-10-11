<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { login } from "../auth";
import { ApiError } from "../api";

const router = useRouter();
const username = ref("alice");
const password = ref("password123");
const error = ref("");
const loading = ref(false);

async function submit() {
  error.value = "";
  loading.value = true;
  try {
    await login(username.value.trim(), password.value);
    await router.push("/");
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "登录失败";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="card" style="max-width: 420px; margin: 60px auto">
    <h1>登录</h1>
    <p class="muted">预置账号：alice / bob / carol / dave，密码均为 password123</p>
    <form class="stack" @submit.prevent="submit">
      <label>
        用户名
        <input v-model="username" autocomplete="username" />
      </label>
      <label>
        密码
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="primary" type="submit" :disabled="loading">
        {{ loading ? "登录中…" : "登录" }}
      </button>
    </form>
  </div>
</template>
