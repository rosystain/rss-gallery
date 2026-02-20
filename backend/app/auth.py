"""
简易认证模块 - 基于 HMAC 签名 Cookie 的 Passkey 认证

特点：
- 只需环境变量 AUTH_PASSKEY，不设置则不启用
- 无状态：签名 Cookie 不依赖服务端存储，重启不会登出
- HTTP-Only Cookie 防 XSS
- 滑动续期：每次请求自动刷新 Cookie 过期时间
"""

import hashlib
import hmac
import os
import time
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

# 配置
AUTH_PASSKEY = os.getenv("AUTH_PASSKEY", "").strip()
COOKIE_NAME = "rss_gallery_session"
COOKIE_MAX_AGE = 90 * 24 * 60 * 60  # 90 天（秒）

# 白名单路径前缀（无需认证）
AUTH_WHITELIST = [
    "/health",
    "/api/auth/",
    "/uploads/",
    "/docs",
    "/openapi.json",
    "/redoc",
]

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


def is_auth_enabled() -> bool:
    """是否启用认证"""
    return bool(AUTH_PASSKEY)


def _create_token(passkey: str) -> str:
    """
    生成签名 token。
    格式: {timestamp}.{nonce}.{signature}
    signature = HMAC-SHA256(passkey, timestamp + "." + nonce)
    """
    timestamp = str(int(time.time()))
    nonce = os.urandom(16).hex()
    payload = f"{timestamp}.{nonce}"
    signature = hmac.new(
        passkey.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()
    return f"{payload}.{signature}"


def _verify_token(token: str, passkey: str) -> bool:
    """验证 token 签名是否有效"""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return False
        timestamp, nonce, signature = parts

        # 重新计算签名
        payload = f"{timestamp}.{nonce}"
        expected = hmac.new(
            passkey.encode(), payload.encode(), hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(signature, expected)
    except Exception:
        return False


def _set_auth_cookie(response, token: str):
    """设置认证 Cookie"""
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=False,  # 允许 HTTP（本地开发/内网），生产环境建议反代加 HTTPS
        path="/",
    )


def _clear_auth_cookie(response):
    """清除认证 Cookie"""
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
    )


# ── API 路由 ──────────────────────────────────────────

@auth_router.get("/status")
def auth_status():
    """返回认证是否启用（无需认证即可访问）"""
    return {"authEnabled": is_auth_enabled()}


@auth_router.post("/login")
async def auth_login(request: Request):
    """验证 passkey 并设置 Cookie"""
    if not is_auth_enabled():
        return JSONResponse(
            status_code=400,
            content={"detail": "认证未启用"},
        )

    try:
        body = await request.json()
        passkey = body.get("passkey", "")
    except Exception:
        passkey = ""

    if not passkey or not hmac.compare_digest(passkey, AUTH_PASSKEY):
        return JSONResponse(
            status_code=401,
            content={"detail": "密码错误"},
        )

    # 生成 token 并设置 Cookie
    token = _create_token(AUTH_PASSKEY)
    response = JSONResponse(content={"success": True})
    _set_auth_cookie(response, token)
    return response


@auth_router.post("/logout")
def auth_logout():
    """清除认证 Cookie"""
    response = JSONResponse(content={"success": True})
    _clear_auth_cookie(response)
    return response


@auth_router.get("/check")
def auth_check(request: Request):
    """检查当前是否已认证"""
    if not is_auth_enabled():
        return {"authenticated": True}

    token = request.cookies.get(COOKIE_NAME)
    if token and _verify_token(token, AUTH_PASSKEY):
        return {"authenticated": True}

    return JSONResponse(
        status_code=401,
        content={"authenticated": False},
    )


# ── 中间件 ────────────────────────────────────────────

def is_path_whitelisted(path: str) -> bool:
    """检查路径是否在白名单中"""
    for prefix in AUTH_WHITELIST:
        if path.startswith(prefix):
            return True
    return False


async def auth_middleware(request: Request, call_next):
    """
    认证中间件：
    - 认证未启用 → 放行
    - 白名单路径 → 放行
    - 有有效 Cookie → 放行 + 滑动续期
    - 否则 → 401
    """
    if not is_auth_enabled():
        return await call_next(request)

    path = request.url.path

    if is_path_whitelisted(path):
        return await call_next(request)

    # 验证 Cookie
    token = request.cookies.get(COOKIE_NAME)
    if not token or not _verify_token(token, AUTH_PASSKEY):
        return JSONResponse(
            status_code=401,
            content={"detail": "未认证"},
        )

    # 放行并滑动续期
    response = await call_next(request)

    # 滑动续期：重新设置 Cookie 刷新过期时间
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )

    return response
