import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 轻量路由守卫
 * 注意：Token 存储在 localStorage，middleware（服务端）无法读取。
 * 核心鉴权由 (dashboard)/layout.tsx 的客户端 useEffect 完成。
 * 此文件处理可服务端判断的简单跳转。
 *
 * V1.1 计划：Token 改用 httpOnly cookie → middleware 即可完整鉴权。
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API 代理透传（Next.js rewrites 已处理 /api/v1 → 后端）
  // 此处无需额外处理

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
