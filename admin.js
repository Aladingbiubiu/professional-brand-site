const categoryLabels = {
    auction: "拍卖公告",
    industry: "行业动态",
    investment: "招商信息",
    case: "项目案例",
    wechat: "公众号文章",
};

const investmentTags = ["房地产", "车辆", "物资设备", "产权", "租赁权", "其他"];

const statusLabels = {
    draft: "草稿",
    published: "已发布",
    archived: "下架",
};

const state = {
    articles: [],
    currentView: "dashboard",
};

const loginView = document.querySelector("#loginView");
const adminView = document.querySelector("#adminView");
const userInfo = document.querySelector("#userInfo");
const viewTitle = document.querySelector("#viewTitle");
const viewHint = document.querySelector("#viewHint");
const panels = {
    dashboard: document.querySelector("#dashboardPanel"),
    articles: document.querySelector("#articlesPanel"),
    editor: document.querySelector("#editorPanel"),
    settings: document.querySelector("#settingsPanel"),
};

async function request(path, options = {}) {
    const response = await fetch(path, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        credentials: "same-origin",
        ...options,
    });
    const contentType = response.headers.get("Content-Type") || "";
    const data = contentType.includes("application/json")
        ? await response.json()
        : { ok: false, message: `接口返回异常：HTTP ${response.status}` };
    if (!response.ok || data.ok === false) {
        throw new Error(data.message || "请求失败");
    }
    return data;
}

function formatDate(value) {
    return (value || "").replaceAll("-", ".");
}

function showMessage(element, text, isError = false) {
    element.textContent = text;
    element.classList.toggle("error", isError);
}

function updateCoverPreview(path) {
    const preview = document.querySelector("#coverPreview");
    const image = preview.querySelector("img");
    const code = preview.querySelector("code");

    if (!path) {
        preview.classList.remove("show");
        image.removeAttribute("src");
        code.textContent = "";
        return;
    }

    image.src = path;
    code.textContent = path;
    preview.classList.add("show");
}

function looksLikeHtml(value) {
    return /<\/?[a-z][\s\S]*>/i.test(value || "");
}

function textToHtml(value) {
    return String(value || "")
        .split(/\n+/)
        .filter(Boolean)
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join("");
}

function editor() {
    return document.querySelector("#bodyEditor");
}

function syncEditorToTextarea() {
    const form = document.querySelector("#articleForm");
    form.elements.body.value = editor().innerHTML.trim();
}

function setEditorContent(value) {
    editor().innerHTML = looksLikeHtml(value) ? value : textToHtml(value);
    syncEditorToTextarea();
}

async function uploadImageFile(file) {
    const data = new FormData();
    data.append("file", file);
    const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: data,
        credentials: "same-origin",
    });
    const payload = await response.json();

    if (!response.ok || payload.ok === false) {
        throw new Error(payload.message || "上传失败");
    }

    return payload.path;
}

function switchView(view) {
    state.currentView = view;
    Object.entries(panels).forEach(([name, panel]) => {
        panel.classList.toggle("hidden", name !== view);
    });
    document.querySelectorAll(".admin-nav button").forEach((button) => {
        button.classList.toggle("active", button.dataset.view === view);
    });

    const titles = {
        dashboard: ["工作台", "管理公告、动态、招商信息和案例内容。"],
        articles: ["内容管理", "筛选、编辑、发布或下架内容。"],
        editor: ["内容编辑", "填写标题、栏目、摘要和发布状态。"],
        settings: ["账号设置", "维护管理员登录密码。"],
    };
    viewTitle.textContent = titles[view][0];
    viewHint.textContent = titles[view][1];

    if (view === "dashboard" || view === "articles") {
        loadArticles();
    }
}

async function checkLogin() {
    const data = await request("/api/admin/me");
    if (data.user) {
        loginView.classList.add("hidden");
        adminView.classList.remove("hidden");
        userInfo.textContent = `${data.user.username} · ${data.user.role === "super_admin" ? "超级管理员" : "普通编辑"}`;
        switchView("dashboard");
    } else {
        adminView.classList.add("hidden");
        loginView.classList.remove("hidden");
    }
}

async function loadArticles() {
    const category = document.querySelector("#categoryFilter").value;
    const tag = document.querySelector("#tagFilter").value;
    const status = document.querySelector("#statusFilter").value;
    const params = new URLSearchParams();
    if (category) {
        params.set("category", category);
    }
    if (status) {
        params.set("status", status);
    }
    const data = await request(`/api/admin/articles?${params.toString()}`);
    state.articles = tag ? data.articles.filter((article) => article.tag === tag) : data.articles;
    renderRows();
    renderDashboard();
}

function renderRows() {
    const rows = document.querySelector("#articleRows");
    rows.innerHTML = state.articles.map((article) => `
        <tr>
            <td>${escapeHtml(article.title)}</td>
            <td>${categoryLabels[article.category] || article.category}</td>
            <td>${escapeHtml(article.tag || "-")}</td>
            <td><span class="status-pill">${statusLabels[article.status] || article.status}</span></td>
            <td>${formatDate(article.published_at)}</td>
            <td>
                <button class="admin-btn light" type="button" data-edit="${article.id}">编辑</button>
                <button class="admin-btn danger" type="button" data-delete="${article.id}">删除</button>
            </td>
        </tr>
    `).join("");
}

function updateTagHelp() {
    const form = document.querySelector("#articleForm");
    const tagInput = form.elements.tag;
    const help = document.querySelector("#tagHelp");
    const isInvestment = form.elements.category.value === "investment";

    if (isInvestment) {
        tagInput.placeholder = "房地产 / 车辆 / 物资设备 / 产权 / 租赁权 / 其他";
        help.textContent = "招商信息会按这里填写的细分类型在前台左侧菜单中筛选。";
        return;
    }

    tagInput.placeholder = "公告 / 交通工程 / 专业观察 / 房产推介";
    help.textContent = "非招商栏目可填写普通标签，用于列表和详情页展示。";
}

function normalizeInvestmentTag(payload) {
    if (payload.category === "investment" && !investmentTags.includes(payload.tag)) {
        payload.tag = payload.tag || "其他";
    }
    return payload;
}

function renderDashboard() {
    const list = document.querySelector("#dashboardList");
    const latest = state.articles.slice(0, 6);
    if (!latest.length) {
        list.innerHTML = "<p>暂无内容。</p>";
        return;
    }
    list.innerHTML = `
        <table class="article-table">
            <thead><tr><th>标题</th><th>栏目</th><th>细分/标签</th><th>状态</th><th>日期</th></tr></thead>
            <tbody>
                ${latest.map((article) => `
                    <tr>
                        <td>${escapeHtml(article.title)}</td>
                        <td>${categoryLabels[article.category] || article.category}</td>
                        <td>${escapeHtml(article.tag || "-")}</td>
                        <td><span class="status-pill">${statusLabels[article.status] || article.status}</span></td>
                        <td>${formatDate(article.published_at)}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}

function fillForm(article = null) {
    const form = document.querySelector("#articleForm");
    form.reset();
    form.elements.id.value = article?.id || "";
    form.elements.title.value = article?.title || "";
    form.elements.category.value = article?.category || "auction";
    form.elements.status.value = article?.status || "draft";
    form.elements.published_at.value = article?.published_at || new Date().toISOString().slice(0, 10);
    form.elements.sort_order.value = article?.sort_order || 0;
    form.elements.tag.value = article?.tag || "";
    form.elements.external_url.value = article?.external_url || "";
    form.elements.summary.value = article?.summary || "";
    setEditorContent(article?.body || "");
    form.elements.cover_image.value = article?.cover_image || "";
    updateTagHelp();
    updateCoverPreview(form.elements.cover_image.value);
    showMessage(document.querySelector("#editorMessage"), "");
    switchView("editor");
}

function formPayload() {
    const form = document.querySelector("#articleForm");
    syncEditorToTextarea();
    return normalizeInvestmentTag({
        title: form.elements.title.value,
        category: form.elements.category.value,
        status: form.elements.status.value,
        published_at: form.elements.published_at.value,
        sort_order: form.elements.sort_order.value,
        tag: form.elements.tag.value,
        external_url: form.elements.external_url.value,
        summary: form.elements.summary.value,
        body: form.elements.body.value,
        cover_image: form.elements.cover_image.value,
    });
}

function previewCurrent() {
    const payload = formPayload();
    if (payload.external_url) {
        window.open(payload.external_url, "_blank", "noopener");
        return;
    }
    const id = document.querySelector("#articleForm").elements.id.value;
    if (id) {
        window.open(`article.html?id=${id}`, "_blank", "noopener");
    }
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

document.querySelector("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.querySelector("#loginMessage");
    const form = event.currentTarget;
    try {
        await request("/api/admin/login", {
            method: "POST",
            body: JSON.stringify({
                username: form.elements.username.value,
                password: form.elements.password.value,
            }),
        });
        showMessage(message, "");
        await checkLogin();
    } catch (error) {
        showMessage(message, error.message, true);
    }
});

document.querySelector("#logoutBtn").addEventListener("click", async () => {
    await request("/api/admin/logout", { method: "POST", body: "{}" });
    await checkLogin();
});

document.querySelectorAll(".admin-nav button").forEach((button) => {
    button.addEventListener("click", () => {
        if (button.dataset.view === "editor") {
            fillForm();
            return;
        }
        switchView(button.dataset.view);
    });
});

document.querySelector("#categoryFilter").addEventListener("change", loadArticles);
document.querySelector("#tagFilter").addEventListener("change", loadArticles);
document.querySelector("#statusFilter").addEventListener("change", loadArticles);
document.querySelector("#newArticleBtn").addEventListener("click", () => fillForm());
document.querySelector("#clearFormBtn").addEventListener("click", () => fillForm());
document.querySelector("#previewBtn").addEventListener("click", previewCurrent);
document.querySelector("#articleForm").elements.category.addEventListener("change", updateTagHelp);
editor().addEventListener("input", syncEditorToTextarea);

document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
        editor().focus();
        document.execCommand(button.dataset.command, false, null);
        syncEditorToTextarea();
    });
});

document.querySelector("#fontSizeSelect").addEventListener("change", (event) => {
    const size = event.target.value;
    if (!size) {
        return;
    }
    editor().focus();
    document.execCommand("fontSize", false, "4");
    editor().querySelectorAll("font[size='4']").forEach((node) => {
        const span = document.createElement("span");
        span.style.fontSize = size;
        span.innerHTML = node.innerHTML;
        node.replaceWith(span);
    });
    event.target.value = "";
    syncEditorToTextarea();
});

document.querySelector("#bodyImageBtn").addEventListener("click", () => {
    document.querySelector("#bodyImageUpload").click();
});

document.querySelector("#articleRows").addEventListener("click", async (event) => {
    const editId = event.target.dataset.edit;
    const deleteId = event.target.dataset.delete;
    if (editId) {
        const article = state.articles.find((item) => String(item.id) === editId);
        fillForm(article);
    }
    if (deleteId && confirm("确定删除这条内容吗？")) {
        await request(`/api/admin/articles/${deleteId}`, { method: "DELETE" });
        await loadArticles();
    }
});

document.querySelector("#articleForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.elements.id.value;
    const message = document.querySelector("#editorMessage");
    try {
        const saved = await request(id ? `/api/admin/articles/${id}` : "/api/admin/articles", {
            method: id ? "PUT" : "POST",
            body: JSON.stringify(formPayload()),
        });
        form.elements.id.value = saved.article.id;
        showMessage(message, "已保存。发布状态为“已发布”时，前台会自动显示。");
        await loadArticles();
    } catch (error) {
        showMessage(message, error.message, true);
    }
});

document.querySelector("#coverUpload").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    const message = document.querySelector("#editorMessage");
    const uploadInput = event.currentTarget;
    const data = new FormData();
    data.append("file", file);
    uploadInput.disabled = true;
    showMessage(message, "封面图上传中，请稍候...");
    try {
        const response = await fetch("/api/admin/upload", {
            method: "POST",
            body: data,
            credentials: "same-origin",
        });
        const payload = await response.json();
        if (!response.ok || payload.ok === false) {
            throw new Error(payload.message || "上传失败");
        }
        document.querySelector("#articleForm").elements.cover_image.value = payload.path;
        updateCoverPreview(payload.path);
        showMessage(message, `封面图已上传：${payload.path}`);
    } catch (error) {
        showMessage(message, error.message, true);
    } finally {
        uploadInput.disabled = false;
        uploadInput.value = "";
    }
});

document.querySelector("#bodyImageUpload").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    const message = document.querySelector("#editorMessage");
    const input = event.currentTarget;
    input.disabled = true;
    showMessage(message, "正文图片上传中，请稍候...");
    try {
        const path = await uploadImageFile(file);
        editor().focus();
        document.execCommand("insertHTML", false, `<p><img src="${escapeHtml(path)}" alt=""></p>`);
        syncEditorToTextarea();
        showMessage(message, "正文图片已插入。");
    } catch (error) {
        showMessage(message, error.message, true);
    } finally {
        input.disabled = false;
        input.value = "";
    }
});

document.querySelector("#articleForm").elements.cover_image.addEventListener("input", (event) => {
    updateCoverPreview(event.target.value);
});

document.querySelector("#passwordForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.querySelector("#passwordMessage");
    try {
        await request("/api/admin/password", {
            method: "POST",
            body: JSON.stringify({
                old_password: form.elements.old_password.value,
                new_password: form.elements.new_password.value,
            }),
        });
        form.reset();
        showMessage(message, "密码已更新。");
    } catch (error) {
        showMessage(message, error.message, true);
    }
});

checkLogin().catch(() => {
    adminView.classList.add("hidden");
    loginView.classList.remove("hidden");
});
