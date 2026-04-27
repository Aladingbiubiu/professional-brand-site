const categoryLabels = {
    auction: "拍卖公告",
    industry: "行业动态",
    investment: "招商信息",
    case: "项目案例",
    law: "法律法规",
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

const IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const BODY_IMAGE_MAX_WIDTH = 1200;
const COVER_IMAGE_MAX_WIDTH = 1400;
const IMAGE_QUALITY = 0.86;

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
    updateToolbarState();
}

function applyInlineStyle(styles) {
    editor().focus();
    document.execCommand("fontSize", false, "4");
    editor().querySelectorAll("font[size='4']").forEach((node) => {
        const span = document.createElement("span");
        Object.assign(span.style, styles);
        span.innerHTML = node.innerHTML;
        node.replaceWith(span);
    });
    syncEditorToTextarea();
    updateToolbarState();
}

function currentBlock() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
        return null;
    }

    let node = selection.anchorNode;
    if (node && node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement;
    }

    while (node && node !== editor()) {
        if (/^(P|DIV|LI|H2|H3|H4|BLOCKQUOTE)$/i.test(node.tagName)) {
            return node;
        }
        node = node.parentElement;
    }

    return null;
}

function applyBlockStyle(styles) {
    editor().focus();
    const block = currentBlock();
    if (block) {
        Object.assign(block.style, styles);
    }
    syncEditorToTextarea();
    updateToolbarState();
}

function updateToolbarState() {
    document.querySelectorAll("[data-command]").forEach((button) => {
        const command = button.dataset.command;
        if (!["bold", "italic", "underline", "justifyLeft", "justifyCenter", "justifyRight"].includes(command)) {
            return;
        }
        button.classList.toggle("active", document.queryCommandState(command));
    });
}

function fileFromBlob(blob, name = "pasted-image.jpg") {
    return new File([blob], name, { type: blob.type || "image/jpeg" });
}

function imageBlobFromDataUrl(dataUrl) {
    return fetch(dataUrl).then((response) => response.blob());
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(file);
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("图片读取失败，请换一张图片重试"));
        };
        image.src = url;
    });
}

async function normalizeImageFile(file, maxWidth = BODY_IMAGE_MAX_WIDTH) {
    if (!file || !file.type.startsWith("image/")) {
        return file;
    }
    if (file.type === "image/gif") {
        return file;
    }

    const image = await loadImage(file);
    const scale = Math.min(1, maxWidth / image.naturalWidth);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", IMAGE_QUALITY);
    });

    if (!blob) {
        return file;
    }

    const normalized = fileFromBlob(blob, file.name.replace(/\.[^.]+$/, ".jpg"));
    if (normalized.size <= IMAGE_UPLOAD_MAX_BYTES || normalized.size < file.size) {
        return normalized;
    }
    return file;
}

function insertBodyImage(path) {
    editor().focus();
    document.execCommand("insertHTML", false, `<p><img src="${escapeHtml(path)}" alt=""></p>`);
    syncEditorToTextarea();
}

async function uploadImageFile(file, options = {}) {
    const normalized = await normalizeImageFile(file, options.maxWidth || BODY_IMAGE_MAX_WIDTH);
    if (normalized.size > IMAGE_UPLOAD_MAX_BYTES) {
        throw new Error("图片大小不能超过 5MB，请压缩后再上传");
    }
    const data = new FormData();
    data.append("file", normalized);
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

async function uploadImageFromDataUrl(dataUrl, options = {}) {
    const blob = await imageBlobFromDataUrl(dataUrl);
    const file = fileFromBlob(blob);
    return uploadImageFile(file, options);
}

function clipboardImageFiles(dataTransfer) {
    const fromFiles = Array.from(dataTransfer?.files || []).filter((file) => file.type.startsWith("image/"));
    const fromItems = Array.from(dataTransfer?.items || [])
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter(Boolean);
    return fromFiles.length ? fromFiles : fromItems;
}

async function uploadClipboardImages(dataTransfer, options = {}) {
    const files = clipboardImageFiles(dataTransfer);
    const paths = [];
    for (const file of files) {
        paths.push(await uploadImageFile(file, options));
    }
    return paths;
}

function normalizePastedHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html;
    template.content.querySelectorAll("img").forEach((image) => {
        image.removeAttribute("width");
        image.removeAttribute("height");
        image.removeAttribute("style");
        image.alt = image.alt || "";
    });
    return template.innerHTML;
}

async function replaceDataImages(root, options = {}) {
    const images = Array.from(root.querySelectorAll("img[src^='data:image']"));
    for (const image of images) {
        const path = await uploadImageFromDataUrl(image.src, options);
        image.src = path;
        image.removeAttribute("width");
        image.removeAttribute("height");
        image.removeAttribute("style");
    }
    syncEditorToTextarea();
}

async function normalizeEditorImages() {
    await replaceDataImages(editor(), { maxWidth: BODY_IMAGE_MAX_WIDTH });
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

function updateTagFilterVisibility() {
    const categoryFilter = document.querySelector("#categoryFilter");
    const tagFilter = document.querySelector("#tagFilter");
    const shouldShow = categoryFilter.value === "investment";

    tagFilter.classList.toggle("hidden", !shouldShow);
    tagFilter.disabled = !shouldShow;

    if (!shouldShow) {
        tagFilter.value = "";
    }
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

document.querySelector("#categoryFilter").addEventListener("change", () => {
    updateTagFilterVisibility();
    loadArticles();
});
document.querySelector("#tagFilter").addEventListener("change", loadArticles);
document.querySelector("#statusFilter").addEventListener("change", loadArticles);
document.querySelector("#newArticleBtn").addEventListener("click", () => fillForm());
document.querySelector("#clearFormBtn").addEventListener("click", () => fillForm());
document.querySelector("#previewBtn").addEventListener("click", previewCurrent);
document.querySelector("#articleForm").elements.category.addEventListener("change", updateTagHelp);
editor().addEventListener("input", () => {
    syncEditorToTextarea();
    updateToolbarState();
});
editor().addEventListener("keyup", updateToolbarState);
editor().addEventListener("mouseup", updateToolbarState);
document.addEventListener("selectionchange", () => {
    if (document.activeElement === editor()) {
        updateToolbarState();
    }
});

document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
        editor().focus();
        document.execCommand(button.dataset.command, false, null);
        syncEditorToTextarea();
        updateToolbarState();
    });
});

document.querySelector("#fontSizeSelect").addEventListener("change", (event) => {
    const size = event.target.value;
    if (!size) {
        return;
    }
    applyInlineStyle({ fontSize: size });
    event.target.value = "";
});

document.querySelector("#lineHeightSelect").addEventListener("change", (event) => {
    const lineHeight = event.target.value;
    if (!lineHeight) {
        return;
    }
    applyBlockStyle({ lineHeight });
    event.target.value = "";
});

document.querySelector("#blockFormatSelect").addEventListener("change", (event) => {
    const format = event.target.value;
    if (!format) {
        return;
    }
    editor().focus();
    document.execCommand("formatBlock", false, format);
    event.target.value = "";
    syncEditorToTextarea();
    updateToolbarState();
});

document.querySelector("#textColorInput").addEventListener("input", (event) => {
    applyInlineStyle({ color: event.target.value });
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
        showMessage(message, "正在整理正文图片，请稍候...");
        await normalizeEditorImages();
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
    uploadInput.disabled = true;
    showMessage(message, "封面图上传中，请稍候...");
    try {
        const path = await uploadImageFile(file, { maxWidth: COVER_IMAGE_MAX_WIDTH });
        document.querySelector("#articleForm").elements.cover_image.value = path;
        updateCoverPreview(path);
        showMessage(message, `封面图已上传：${path}`);
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
        insertBodyImage(path);
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

editor().addEventListener("paste", async (event) => {
    const clipboard = event.clipboardData;
    if (!clipboard) {
        return;
    }

    const message = document.querySelector("#editorMessage");
    const imageFiles = clipboardImageFiles(clipboard);
    const html = clipboard.getData("text/html");

    if (imageFiles.length) {
        event.preventDefault();
        showMessage(message, "正在上传粘贴的图片，请稍候...");
        try {
            const paths = await uploadClipboardImages(clipboard, { maxWidth: BODY_IMAGE_MAX_WIDTH });
            paths.forEach(insertBodyImage);
            showMessage(message, "粘贴图片已上传并插入正文。");
        } catch (error) {
            showMessage(message, error.message, true);
        }
        return;
    }

    if (html && html.includes("data:image")) {
        event.preventDefault();
        showMessage(message, "正在处理粘贴内容里的图片，请稍候...");
        try {
            const template = document.createElement("template");
            template.innerHTML = normalizePastedHtml(html);
            await replaceDataImages(template.content, { maxWidth: BODY_IMAGE_MAX_WIDTH });
            document.execCommand("insertHTML", false, template.innerHTML);
            syncEditorToTextarea();
            showMessage(message, "粘贴内容已整理完成。");
        } catch (error) {
            showMessage(message, error.message, true);
        }
        return;
    }

    if (html) {
        event.preventDefault();
        document.execCommand("insertHTML", false, normalizePastedHtml(html));
        syncEditorToTextarea();
    }
});

document.querySelector("#articleForm").elements.cover_image.addEventListener("paste", async (event) => {
    const coverInput = event.currentTarget;
    const clipboard = event.clipboardData;
    if (!clipboard) {
        return;
    }
    const imageFiles = clipboardImageFiles(clipboard);
    const html = clipboard.getData("text/html");
    const pastedImage = html ? new DOMParser().parseFromString(html, "text/html").querySelector("img") : null;
    if (!imageFiles.length && !pastedImage) {
        return;
    }

    event.preventDefault();
    const message = document.querySelector("#editorMessage");
    showMessage(message, "正在上传粘贴的封面图，请稍候...");
    try {
        let path = "";
        if (imageFiles.length) {
            path = await uploadImageFile(imageFiles[0], { maxWidth: COVER_IMAGE_MAX_WIDTH });
        } else if (pastedImage.src.startsWith("data:image")) {
            path = await uploadImageFromDataUrl(pastedImage.src, { maxWidth: COVER_IMAGE_MAX_WIDTH });
        } else {
            path = pastedImage.src;
        }
        coverInput.value = path;
        updateCoverPreview(path);
        showMessage(message, `封面图已上传：${path}`);
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

updateTagFilterVisibility();
checkLogin().catch(() => {
    adminView.classList.add("hidden");
    loginView.classList.remove("hidden");
});
