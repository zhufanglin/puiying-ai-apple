import os
import httpx
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import Response

API_PORT = int(os.environ.get("API_PORT", "8001"))
WEB_PORT = int(os.environ.get("WEB_PORT", "3000"))
PUBLIC_PORT = int(os.environ.get("PORT", "8888"))

app = FastAPI(title="Apple Unified Entry", docs_url=None, redoc_url=None)
client = None

@app.on_event("startup")
async def startup():
    global client
    client = httpx.AsyncClient(timeout=60.0)
    print(f"Proxy: /api/* -> 127.0.0.1:{API_PORT}, /* -> 127.0.0.1:{WEB_PORT}")

@app.on_event("shutdown")
async def shutdown():
    if client:
        await client.aclose()

@app.api_route("/api/v1/{path:path}", methods=["GET","POST","PUT","PATCH","DELETE","OPTIONS"])
async def proxy_api(path: str, request: Request):
    url = f"http://127.0.0.1:{API_PORT}/api/v1/{path}"
    body = await request.body()
    headers = dict(request.headers)
    headers.pop("host", None)
    resp = await client.request(method=request.method, url=url, content=body, headers=headers)
    return Response(content=resp.content, status_code=resp.status_code, headers=dict(resp.headers))

@app.api_route("/{path:path}", methods=["GET","POST","PUT","PATCH","DELETE","OPTIONS"])
async def proxy_web(path: str, request: Request):
    url = f"http://127.0.0.1:{WEB_PORT}/{path}" if path else f"http://127.0.0.1:{WEB_PORT}/"
    body = await request.body()
    headers = dict(request.headers)
    headers.pop("host", None)
    resp = await client.request(method=request.method, url=url, content=body, headers=headers)
    return Response(content=resp.content, status_code=resp.status_code, headers=dict(resp.headers))

if __name__ == "__main__":
    print(f"\nApple 子系统统一入口: http://localhost:{PUBLIC_PORT}\n")
    uvicorn.run(app, host="0.0.0.0", port=PUBLIC_PORT, log_level="info")
