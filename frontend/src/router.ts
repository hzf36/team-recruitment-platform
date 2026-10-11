import { createRouter, createWebHistory } from "vue-router";
import { getToken } from "./api";
import LoginView from "./views/LoginView.vue";
import ProjectsView from "./views/ProjectsView.vue";
import ProjectDetailView from "./views/ProjectDetailView.vue";
import CreateProjectView from "./views/CreateProjectView.vue";
import ProfileView from "./views/ProfileView.vue";
import MyApplicationsView from "./views/MyApplicationsView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: LoginView },
    { path: "/", component: ProjectsView },
    { path: "/projects/new", component: CreateProjectView },
    { path: "/projects/:id", component: ProjectDetailView, props: true },
    { path: "/profile", component: ProfileView },
    { path: "/my-applications", component: MyApplicationsView },
  ],
});

router.beforeEach((to) => {
  if (to.path !== "/login" && !getToken()) {
    return "/login";
  }
  if (to.path === "/login" && getToken()) {
    return "/";
  }
});
