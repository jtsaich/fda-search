import type { roleLabels as EnRoleLabels } from "../en/roleLabels";

export const roleLabels: Record<keyof typeof EnRoleLabels, string> = {
  "role.label.admin": "管理员",
  "role.label.researcher": "研究员",
  "role.label.viewer": "查看者",
  "role.desc.admin": "拥有完整的系统权限，包括用户和角色管理",
  "role.desc.researcher": "可上传、管理文档并创建对话",
  "role.desc.viewer": "可查看文档并创建对话（只读权限）",
  "perm.label.documents.upload": "上传文档",
  "perm.label.documents.view": "查看文档",
  "perm.label.documents.delete": "删除文档",
  "perm.label.chat.create": "创建对话",
  "perm.label.chat.view": "查看对话",
  "perm.label.chat.delete": "删除对话",
  "perm.label.users.view": "查看用户",
  "perm.label.users.manage": "管理用户",
  "perm.label.roles.manage": "管理角色",
};
