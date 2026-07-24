"use client";

import { useCallback, useMemo } from "react";

/**
 * 权限检查 Hook
 *
 * 前端仅做按钮显隐控制，不做安全强制。
 * 后端 API 会通过 403 响应对无权限操作进行拦截。
 *
 * 当前实现：从 localStorage token 解析权限列表。
 * TODO: 后续可改为调用 GET /api/v1/auth/me 获取用户权限。
 */
export function usePermission() {
  /** 检查当前用户是否拥有指定权限码 */
  const hasPermission = useCallback((code: string): boolean => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return false;

      const payload = JSON.parse(atob(token.split(".")[1]));
      const role: string = payload?.role ?? "";
      const permissions: string[] = payload?.permissions ?? payload?.scope ?? [];

      // 超级管理员拥有全部权限
      if (role === "super_admin" || permissions.includes("*") || permissions.includes("admin")) {
        return true;
      }

      return permissions.includes(code);
    } catch {
      return true;
    }
  }, []);

  return useMemo(() => ({ hasPermission }), [hasPermission]);
}
