const categoryLabels = {
    auction: "拍卖公告",
    industry: "行业动态",
    investment: "招商信息",
    case: "项目案例",
    wechat: "公众号文章",
};

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
    const data = await response.json();
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
    const status = document.querySelector("#statusFilter").value;
    const params = new URLSearchParams();
    if (category) {
        params.set("category", category);
    }
    if (status) {
        params.set("status", status);
    }
    const data = await request(`/api/admin/articles?${params.toString()}`);
    state.articles = data.articles;
    renderRows();
    renderDashboard();
}

function renderRows() {
    const rows = document.querySelector("#articleRows");
    rows.innerHTML = state.articles.map((article) => `
        <tr>
            <td>${escapeHtml(article.title)}</td>
            <td>${categoryLabels[article.category] || article.category}</td>
            <td><span class="status-pill">${statusLabels[article.status] || article.status}</span></td>
            <td>${formatDate(article.published_at)}</td>
            <td>
                <button class="admin-btn light" type="button" data-edit="${article.id}">编辑</button>
                <button class="admin-btn danger" type="button" data-delete="${article.id}">删除</button>
            </td>
        </tr>
    `).join("");
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
            <thead><tr><th>标题</th><th>栏目</th><th>状态</th><th>日期</th></tr></thead>
            <tbody>
                ${latest.map((article) => `
                    <tr>
                        <td>${escapeHtml(article.title)}</td>
                        <td>${categoryLabels[article.category] || article.category}</td>
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
    form.elements.body.value = article?.body || "";
    form.elements.cover_image.value = article?.cover_image || "";
    showMessage(document.querySelector("#editorMessage"), "");
    switchView("editor");
}

function formPayload() {
    const form = document.querySelector("#articleForm");
    return {
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
    };
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
document.querySelector("#statusFilter").addEventListener("change", loadArticles);
document.querySelector("#newArticleBtn").addEventListener("click", () => fillForm());
document.querySelector("#clearFormBtn").addEventListener("click", () => fillForm());
document.querySelector("#previewBtn").addEventListener("click", previewCurrent);

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
    const data = new FormData();
    data.append("file", file);
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
        showMessage(message, "封面图已上传。");
    } catch (error) {
        showMessage(message, error.message, true);
    }
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
