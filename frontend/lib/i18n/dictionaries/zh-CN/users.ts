import type { users as EnUsers } from "../en/users";

export const users: Record<keyof typeof EnUsers, string> = {
  "users.title": "用户管理",
  "users.subtitle": "管理用户角色和权限",
  "users.loadFailed": "加载用户失败",
  "users.updateRoleFailed": "更新角色失败",
  "users.deleteFailed": "删除用户失败",
  "users.confirmDelete": "确定要删除用户 {userEmail} 吗？",
  "users.colUser": "用户",
  "users.colRole": "角色",
  "users.colJoined": "加入时间",
  "users.you": "（你）",
  "users.noUsers": "未找到用户",
  "users.roleDefinitions": "角色定义",
};
