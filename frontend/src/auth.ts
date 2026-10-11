import { reactive } from "vue";
import { ApiError, api, getToken, setToken } from "./api";

export type User = {
  id: number;
  username: string;
  nickname: string;
  bio: string;
  skills: string[];
  weeklyHours: number;
};

export const authState = reactive<{
  user: User | null;
  loaded: boolean;
  error: string | null;
}>({
  user: null,
  loaded: false,
  error: null,
});

export async function refreshMe() {
  if (!getToken()) {
    authState.user = null;
    authState.error = null;
    authState.loaded = true;
    return null;
  }
  try {
    authState.user = await api<User>("/api/auth/me");
    authState.error = null;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      setToken(null);
      authState.user = null;
      authState.error = e.message || "登录已失效，请重新登录";
    } else {
      // Keep token on transient/server errors; surface explicit feedback
      authState.error =
        e instanceof ApiError
          ? e.message
          : "身份初始化失败，请刷新页面重试";
    }
  } finally {
    authState.loaded = true;
  }
  return authState.user;
}

export async function login(username: string, password: string) {
  const result = await api<{ token: string; user: User }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(result.token);
  authState.user = result.user;
  authState.loaded = true;
  return result.user;
}

export function logout() {
  setToken(null);
  authState.user = null;
  authState.error = null;
  authState.loaded = true;
}
