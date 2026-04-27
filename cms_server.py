from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import sqlite3
from datetime import datetime, timedelta, timezone
from http import cookies
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
UPLOAD_DIR = ROOT / "uploads"
DB_PATH = DATA_DIR / "content.db"
SESSION_SECONDS = 60 * 60 * 8
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
CATEGORIES = {"auction", "industry", "investment", "case", "law", "wechat"}
STATUSES = {"draft", "published", "archived"}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def json_bytes(payload: object) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def positive_int(value: str, default: int, maximum: int | None = None) -> int:
    try:
        parsed = int(value or default)
    except (TypeError, ValueError):
        parsed = default
    parsed = max(parsed, 1)
    return min(parsed, maximum) if maximum else parsed


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 160_000)
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, _ = stored.split("$", 1)
    except ValueError:
        return False
    return hmac.compare_digest(hash_password(password, salt), stored)


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def article_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "category": row["category"],
        "published_at": row["published_at"],
        "summary": row["summary"],
        "body": row["body"],
        "external_url": row["external_url"],
        "cover_image": row["cover_image"],
        "status": row["status"],
        "sort_order": row["sort_order"],
        "tag": row["tag"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def init_db() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    UPLOAD_DIR.mkdir(exist_ok=True)

    with db() as conn:
        conn.executescript(
            """
            create table if not exists users (
                id integer primary key autoincrement,
                username text not null unique,
                password_hash text not null,
                role text not null default 'editor',
                created_at text not null
            );

            create table if not exists sessions (
                token text primary key,
                user_id integer not null,
                expires_at text not null,
                created_at text not null,
                foreign key(user_id) references users(id)
            );

            create table if not exists articles (
                id integer primary key autoincrement,
                title text not null,
                category text not null,
                published_at text not null,
                summary text not null default '',
                body text not null default '',
                external_url text not null default '',
                cover_image text not null default '',
                status text not null default 'draft',
                sort_order integer not null default 0,
                tag text not null default '',
                created_at text not null,
                updated_at text not null
            );
            """
        )

        admin = conn.execute("select id from users where username = 'admin'").fetchone()
        if not admin:
            password = os.environ.get("CMS_ADMIN_PASSWORD", "admin123")
            conn.execute(
                "insert into users (username, password_hash, role, created_at) values (?, ?, ?, ?)",
                ("admin", hash_password(password), "super_admin", now_iso()),
            )

        count = conn.execute("select count(*) from articles").fetchone()[0]
        if count == 0:
            seed_articles(conn)


def seed_articles(conn: sqlite3.Connection) -> None:
    seed = [
        ("莱芜区大宗优质房产推介！", "wechat", "2026-04-26", "围绕莱芜区大宗优质房产资源发布推介信息，为意向合作方、投资方和资产处置需求提供项目线索。", "", "https://mp.weixin.qq.com/s/z5ixXhYEv4VPl5d4dxmNPw", "", "published", 100, "房产推介"),
        ("资产处置拍卖公告：涉诉财物公开处置服务启动", "auction", "2026-04-20", "围绕涉诉财物、车辆设备和资产处置需求，提供公开拍卖与流程协同服务。", "", "", "", "published", 90, "公告"),
        ("车辆及设备类标的拍卖资料征集与展示安排", "auction", "2026-04-12", "面向车辆、设备类标的开展资料征集、核验和展示安排。", "", "", "", "published", 80, "公告"),
        ("司法辅助拍卖项目委托流程及资料清单提示", "auction", "2026-03-28", "提示司法辅助拍卖项目的委托流程、资料清单和前期核验要点。", "", "", "", "published", 70, "提示"),
        ("涉诉财物价格评估中现场勘验的重要性", "industry", "2026-04-18", "现场勘验、资料核验和市场信息共同影响涉诉财物价格评估成果质量。", "", "", "", "published", 90, "观察"),
        ("征迁补偿评估如何提高资料完整性和复核效率", "industry", "2026-04-05", "围绕征迁补偿评估中的资料准备、现场确认和成果复核提出实务观察。", "", "", "", "published", 80, "评估"),
        ("资产处置项目合作机构征集：评估、拍卖、咨询协同服务", "investment", "2026-04-15", "面向资产处置项目合作机构，征集评估、拍卖、咨询等协同服务资源。", "", "", "", "published", 90, "其他"),
        ("产权交易及拍卖标的信息发布合作需求征集", "investment", "2026-04-02", "围绕产权交易和拍卖标的信息发布开展合作需求征集。", "", "", "", "published", 80, "产权"),
        ("济泰高速公路泰安段地上附着物和构筑物评估", "case", "2026-03-18", "围绕重点工程建设过程中的地上附着物、构筑物等价值判断事项，提供第三方评估支持。", "", "", "", "published", 70, "交通工程"),
        ("济泰高速公路“三改”工程评估", "case", "2026-03-12", "结合项目资料和现场情况，对相关资产及补偿事项进行评估，为工程实施提供参考依据。", "", "", "", "published", 60, "工程评估"),
        ("泰安环山路东延工程评估", "case", "2026-03-06", "在城市道路建设与改扩建过程中，参与相关资产价值评估工作。", "", "", "", "published", 50, "城市建设"),
        ("山东科大泰山科技学院征迁工程评估", "case", "2026-02-26", "服务教育机构相关征迁和资产处置场景，围绕资料核验、现场勘查和价值测算形成专业成果。", "", "", "", "published", 40, "征迁服务"),
        ("京台高速公路泰安段改扩建工程评估", "case", "2026-02-18", "面向高速公路改扩建项目中的补偿和价值认定需求，提供规范、客观的评估服务。", "", "", "", "published", 30, "交通工程"),
        ("新泰市植物园地上物评估", "case", "2026-02-12", "根据地上物类型和委托需求开展价值评估，支持项目管理、补偿确认和后续处置安排。", "", "", "", "published", 20, "资产评估"),
    ]
    timestamp = now_iso()
    conn.executemany(
        """
        insert into articles
        (title, category, published_at, summary, body, external_url, cover_image, status, sort_order, tag, created_at, updated_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [(*row, timestamp, timestamp) for row in seed],
    )


class CMSHandler(SimpleHTTPRequestHandler):
    server_version = "ZhongxinCMS/1.0"

    def translate_path(self, path: str) -> str:
        parsed = urlparse(path)
        route = unquote(parsed.path)
        if route == "/admin":
            route = "/admin.html"
        if route == "/article":
            route = "/article.html"
        relative = route.lstrip("/") or "index.html"
        return str((ROOT / relative).resolve())

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/articles":
            self.handle_public_articles(parsed)
            return
        if parsed.path.startswith("/api/articles/"):
            self.handle_public_article(parsed.path)
            return
        if parsed.path == "/api/admin/me":
            self.handle_me()
            return
        if parsed.path == "/api/admin/articles":
            self.handle_admin_articles(parsed)
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/admin/login":
            self.handle_login()
            return
        if parsed.path == "/api/admin/logout":
            self.handle_logout()
            return
        if parsed.path == "/api/admin/password":
            self.handle_change_password()
            return
        if parsed.path == "/api/admin/articles":
            self.handle_save_article()
            return
        if parsed.path == "/api/admin/upload":
            self.handle_upload()
            return
        self.not_found()

    def do_PUT(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/admin/articles/"):
            self.handle_save_article(self.article_id_from_path(parsed.path))
            return
        self.not_found()

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/admin/articles/"):
            article_id = self.article_id_from_path(parsed.path)
            if not article_id:
                self.error_json(400, "无效文章 ID")
                return
            if not self.require_user():
                return
            with db() as conn:
                conn.execute("delete from articles where id = ?", (article_id,))
            self.write_json({"ok": True})
            return
        self.not_found()

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        data = self.rfile.read(length)
        return json.loads(data.decode("utf-8"))

    def write_json(self, payload: object, status: int = 200) -> None:
        body = json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def error_json(self, status: int, message: str) -> None:
        self.write_json({"ok": False, "message": message}, status)

    def not_found(self) -> None:
        self.error_json(404, "接口不存在")

    def get_session_token(self) -> str:
        raw = self.headers.get("Cookie", "")
        jar = cookies.SimpleCookie(raw)
        if "cms_session" not in jar:
            return ""
        return jar["cms_session"].value

    def current_user(self) -> sqlite3.Row | None:
        token = self.get_session_token()
        if not token:
            return None
        with db() as conn:
            row = conn.execute(
                """
                select users.* from sessions
                join users on users.id = sessions.user_id
                where sessions.token = ? and sessions.expires_at > ?
                """,
                (token, now_iso()),
            ).fetchone()
        return row

    def require_user(self) -> sqlite3.Row | None:
        user = self.current_user()
        if not user:
            self.error_json(401, "请先登录")
            return None
        return user

    def handle_public_articles(self, parsed) -> None:
        qs = parse_qs(parsed.query)
        category = qs.get("category", [""])[0]
        status = qs.get("status", ["published"])[0]
        limit = positive_int(qs.get("limit", ["50"])[0], 50, 100)
        page_size = positive_int(qs.get("page_size", [str(limit)])[0], limit, 100)
        page = positive_int(qs.get("page", ["1"])[0], 1)
        tag = qs.get("tag", [""])[0]
        exclude_category = qs.get("exclude_category", [""])[0]
        offset = (page - 1) * page_size

        where = ["status = ?"]
        values: list[object] = [status]
        if category:
            where.append("category = ?")
            values.append(category)
        if category == "investment" and tag == "其他":
            where.append("(tag = ? or tag not in (?, ?, ?, ?, ?, ?))")
            values.extend(["其他", "房地产", "车辆", "物资设备", "产权", "租赁权", "其他"])
        elif tag:
            where.append("tag = ?")
            values.append(tag)
        if exclude_category:
            where.append("category != ?")
            values.append(exclude_category)

        with db() as conn:
            total = conn.execute(
                f"select count(*) from articles where {' and '.join(where)}",
                values,
            ).fetchone()[0]
            total_pages = max((total + page_size - 1) // page_size, 1)
            page = min(page, total_pages)
            offset = (page - 1) * page_size
            rows = conn.execute(
                f"""
                select * from articles
                where {' and '.join(where)}
                order by date(published_at) desc, sort_order desc, id desc
                limit ? offset ?
                """,
                [*values, page_size, offset],
            ).fetchall()
        self.write_json({
            "ok": True,
            "articles": [article_row_to_dict(row) for row in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        })

    def handle_public_article(self, path: str) -> None:
        article_id = self.article_id_from_path(path)
        if not article_id:
            self.error_json(400, "无效文章 ID")
            return
        with db() as conn:
            row = conn.execute("select * from articles where id = ? and status = 'published'", (article_id,)).fetchone()
        if not row:
            self.error_json(404, "文章不存在或未发布")
            return
        self.write_json({"ok": True, "article": article_row_to_dict(row)})

    def handle_me(self) -> None:
        user = self.current_user()
        if not user:
            self.write_json({"ok": True, "user": None})
            return
        self.write_json({"ok": True, "user": {"username": user["username"], "role": user["role"]}})

    def handle_admin_articles(self, parsed) -> None:
        if not self.require_user():
            return
        qs = parse_qs(parsed.query)
        category = qs.get("category", [""])[0]
        status = qs.get("status", [""])[0]
        where: list[str] = []
        values: list[object] = []
        if category:
            where.append("category = ?")
            values.append(category)
        if status:
            where.append("status = ?")
            values.append(status)
        clause = "where " + " and ".join(where) if where else ""
        with db() as conn:
            rows = conn.execute(
                f"select * from articles {clause} order by date(published_at) desc, sort_order desc, id desc",
                values,
            ).fetchall()
        self.write_json({"ok": True, "articles": [article_row_to_dict(row) for row in rows]})

    def handle_login(self) -> None:
        payload = self.read_json()
        username = (payload.get("username") or "").strip()
        password = payload.get("password") or ""
        with db() as conn:
            user = conn.execute("select * from users where username = ?", (username,)).fetchone()
            if not user or not verify_password(password, user["password_hash"]):
                self.error_json(401, "账号或密码错误")
                return
            token = secrets.token_urlsafe(32)
            expires = datetime.now(timezone.utc) + timedelta(seconds=SESSION_SECONDS)
            conn.execute(
                "insert into sessions (token, user_id, expires_at, created_at) values (?, ?, ?, ?)",
                (token, user["id"], expires.replace(microsecond=0).isoformat(), now_iso()),
            )
        body = json_bytes({"ok": True, "user": {"username": user["username"], "role": user["role"]}})
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Set-Cookie", f"cms_session={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={SESSION_SECONDS}")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_logout(self) -> None:
        token = self.get_session_token()
        if token:
            with db() as conn:
                conn.execute("delete from sessions where token = ?", (token,))
        body = json_bytes({"ok": True})
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Set-Cookie", "cms_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_change_password(self) -> None:
        user = self.require_user()
        if not user:
            return
        payload = self.read_json()
        old_password = payload.get("old_password") or ""
        new_password = payload.get("new_password") or ""
        if len(new_password) < 6:
            self.error_json(400, "新密码至少 6 位")
            return
        if not verify_password(old_password, user["password_hash"]):
            self.error_json(400, "原密码错误")
            return
        with db() as conn:
            conn.execute("update users set password_hash = ? where id = ?", (hash_password(new_password), user["id"]))
        self.write_json({"ok": True})

    def handle_save_article(self, article_id: int | None = None) -> None:
        if not self.require_user():
            return
        payload = self.read_json()
        data = self.clean_article_payload(payload)
        if "message" in data:
            self.error_json(400, data["message"])
            return
        timestamp = now_iso()
        with db() as conn:
            if article_id:
                conn.execute(
                    """
                    update articles set
                    title = ?, category = ?, published_at = ?, summary = ?, body = ?, external_url = ?,
                    cover_image = ?, status = ?, sort_order = ?, tag = ?, updated_at = ?
                    where id = ?
                    """,
                    (*data["values"], timestamp, article_id),
                )
            else:
                cur = conn.execute(
                    """
                    insert into articles
                    (title, category, published_at, summary, body, external_url, cover_image, status, sort_order, tag, created_at, updated_at)
                    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (*data["values"], timestamp, timestamp),
                )
                article_id = cur.lastrowid
            row = conn.execute("select * from articles where id = ?", (article_id,)).fetchone()
        self.write_json({"ok": True, "article": article_row_to_dict(row)})

    def clean_article_payload(self, payload: dict) -> dict:
        title = (payload.get("title") or "").strip()
        category = payload.get("category") or "industry"
        status = payload.get("status") or "draft"
        if not title:
            return {"message": "请填写标题"}
        if category not in CATEGORIES:
            return {"message": "栏目类型不正确"}
        if status not in STATUSES:
            return {"message": "状态不正确"}
        published_at = (payload.get("published_at") or datetime.now().strftime("%Y-%m-%d")).strip()
        summary = (payload.get("summary") or "").strip()
        body = (payload.get("body") or "").strip()
        external_url = (payload.get("external_url") or "").strip()
        cover_image = (payload.get("cover_image") or "").strip()
        tag = (payload.get("tag") or "").strip()
        try:
            sort_order = int(payload.get("sort_order") or 0)
        except ValueError:
            sort_order = 0
        return {"values": (title, category, published_at, summary, body, external_url, cover_image, status, sort_order, tag)}

    def handle_upload(self) -> None:
        if not self.require_user():
            return
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type or "boundary=" not in content_type:
            self.error_json(400, "请上传文件")
            return
        boundary = content_type.split("boundary=", 1)[1].strip().strip('"').encode("utf-8")
        length = int(self.headers.get("Content-Length", "0"))
        if length > MAX_UPLOAD_BYTES:
            self.error_json(413, "图片大小不能超过 5MB")
            return
        data = self.rfile.read(length)
        marker = b"--" + boundary
        for part in data.split(marker):
            if b"filename=" not in part:
                continue
            header, _, body = part.partition(b"\r\n\r\n")
            if not body:
                continue
            body = body.rsplit(b"\r\n", 1)[0]
            if len(body) > MAX_UPLOAD_BYTES:
                self.error_json(413, "图片大小不能超过 5MB")
                return
            filename = self.extract_filename(header.decode("utf-8", errors="ignore"))
            suffix = Path(filename).suffix.lower() or self.detect_image_suffix(body)
            if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
                self.error_json(400, "仅支持 jpg、png、webp、gif 图片")
                return
            saved = f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(4)}{suffix}"
            path = UPLOAD_DIR / saved
            path.write_bytes(body)
            self.write_json({"ok": True, "path": f"uploads/{saved}"})
            return
        self.error_json(400, "未找到上传文件")

    def extract_filename(self, header: str) -> str:
        match = re.search(r'filename="([^"]+)"', header)
        if match:
            return match.group(1) or "upload.jpg"

        match = re.search(r"filename=([^\r\n;]+)", header)
        if match:
            return match.group(1).strip() or "upload.jpg"

        return "upload.jpg"

    def detect_image_suffix(self, data: bytes) -> str:
        if data.startswith(b"\xff\xd8\xff"):
            return ".jpg"
        if data.startswith(b"\x89PNG\r\n\x1a\n"):
            return ".png"
        if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
            return ".gif"
        if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
            return ".webp"
        return ""

    def article_id_from_path(self, path: str) -> int | None:
        try:
            return int(path.rstrip("/").split("/")[-1])
        except ValueError:
            return None


def main() -> None:
    init_db()
    port = int(os.environ.get("PORT", "8080"))
    os.chdir(ROOT)
    httpd = ThreadingHTTPServer(("127.0.0.1", port), CMSHandler)
    print(f"Zhongxin CMS running at http://127.0.0.1:{port}")
    print("Default admin: admin / admin123 (set CMS_ADMIN_PASSWORD before first run to change it)")
    print("Production note: change the password, back up data/content.db and uploads/, and run behind HTTPS/reverse proxy.")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
