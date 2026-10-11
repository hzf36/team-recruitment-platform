<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { authState, logout, refreshMe } from "./auth";
import { getToken } from "./api";

const router = useRouter();
const retrying = ref(false);

onMounted(() => {
  void refreshMe();
});

function onLogout() {
  logout();
  void router.push("/login");
}

async function retryAuth() {
  if (retrying.value) return;
  retrying.value = true;
  try {
    await refreshMe();
  } finally {
    retrying.value = false;
  }
}
</script>

<template>
  <div>
    <header v-if="authState.user" class="nav">
      <div class="container">
        <strong class="nav-brand">项目组队与成员招募</strong>
        <nav class="nav-links">
          <router-link to="/">项目列表</router-link>
          <router-link to="/projects/new">发布项目</router-link>
          <router-link to="/my-applications">我的申请</router-link>
          <router-link to="/profile">个人资料</router-link>
        </nav>
        <span class="nav-user">
          {{ authState.user.nickname }}（{{ authState.user.username }}）
        </span>
        <button class="nav-logout" type="button" @click="onLogout">退出</button>
      </div>
    </header>
    <main class="container">
      <div
        v-if="authState.error && !authState.user"
        class="card"
        style="margin: 12px 0"
      >
        <p class="error">{{ authState.error }}</p>
        <p v-if="getToken()" class="muted page-hint">
          登录凭证仍保留；服务恢复后可重试，无需重新输入密码。
        </p>
        <button
          v-if="getToken()"
          type="button"
          class="primary"
          :disabled="retrying"
          @click="retryAuth"
        >
          {{ retrying ? "重试中…" : "重试加载身份" }}
        </button>
      </div>
      <router-view />
    </main>
  </div>
</template>
