"""冒烟测试 — 组员提 PR 后一键跑，确认所有接口不报 500

用法：
    python scripts/smoke_test.py

前提：API 服务已启动在 localhost:8000
"""

import requests

BASE = "http://localhost:8000/api/v1"

# ============== 测试用例 ==============
# 格式：(方法, 路径, 预期状态码范围)
ROUTES = [
    # ---- 系统 ----
    ("GET",  "/health",             200),

    # ---- 认证 ----
    ("POST", "/auth/login",         404),  # 无 DB 时返回错误，但不应该 500

    # ---- A1 奖状奖学金（同学2 完成后取消注释）----
    # ("GET",  "/apple/awards",       200),
    # ("POST", "/apple/awards",       403),  # 无 token 返回 403
    # ("GET",  "/apple/awards/1",     404),

    # ---- A2 财务收支（同学3 完成后取消注释）----
    # ("GET",  "/apple/finance",      200),
    # ("POST", "/apple/finance",      403),

    # ---- A3 资产盘点（同学3 完成后取消注释）----
    # ("GET",  "/apple/assets",       200),
    # ("POST", "/apple/assets",       403),

    # ---- A4 学生事务（同学4 完成后取消注释）----
    # ("GET",  "/apple/students",     200),
    # ("POST", "/apple/students",     403),
]

# ============== 运行 ==============

def main():
    print("🔍 冒烟测试开始...")
    print(f"   目标: {BASE}")
    print()

    passed = 0
    failed = 0

    for method, path, expected in ROUTES:
        url = f"{BASE}{path}"
        try:
            if method == "GET":
                resp = requests.get(url, timeout=5)
            elif method == "POST":
                resp = requests.post(url, json={}, timeout=5)
            else:
                resp = requests.request(method, url, timeout=5)

            status = resp.status_code
            if status < 500:
                print(f"   ✅ {method:4s} {path:30s} → {status}")
                passed += 1
            else:
                print(f"   ❌ {method:4s} {path:30s} → {status} (500! 服务端错误)")
                failed += 1

        except requests.ConnectionError:
            print(f"   ⚠️  {method:4s} {path:30s} → 连接失败（API 没启动？）")
            failed += 1
        except Exception as e:
            print(f"   ❌ {method:4s} {path:30s} → {e}")
            failed += 1

    print()
    print(f"结果: {passed} 通过, {failed} 失败")

    if failed > 0:
        print("❌ 有接口异常，检查 API 日志")
        exit(1)
    else:
        print("✅ 冒烟测试全部通过")


if __name__ == "__main__":
    main()
