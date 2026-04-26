const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");

if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
        const isOpen = mainNav.classList.toggle("open");
        menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
}

const contactForm = document.querySelector(".contact-form");

if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const message = contactForm.querySelector(".form-message");

        if (!contactForm.checkValidity()) {
            message.textContent = "请完整填写姓名、电话、单位名称、咨询事项和留言。";
            message.classList.add("error");
            contactForm.reportValidity();
            return;
        }

        message.textContent = "提交成功。我们将根据您的需求安排后续沟通。";
        message.classList.remove("error");
        contactForm.reset();
    });
}

const slides = Array.from(document.querySelectorAll(".project-slide"));
const dots = Array.from(document.querySelectorAll(".carousel-dots button"));
let activeSlide = 0;
let carouselTimer;

function showSlide(index) {
    if (!slides.length || !dots.length) {
        return;
    }

    activeSlide = (index + slides.length) % slides.length;

    slides.forEach((slide, slideIndex) => {
        slide.classList.toggle("active", slideIndex === activeSlide);
    });

    dots.forEach((dot, dotIndex) => {
        dot.classList.toggle("active", dotIndex === activeSlide);
    });
}

function startCarousel() {
    if (slides.length <= 1) {
        return;
    }

    window.clearInterval(carouselTimer);
    carouselTimer = window.setInterval(() => {
        showSlide(activeSlide + 1);
    }, 5000);
}

if (slides.length && dots.length) {
    dots.forEach((dot, index) => {
        dot.addEventListener("click", () => {
            showSlide(index);
            startCarousel();
        });
    });

    startCarousel();
}

const tabButtons = Array.from(document.querySelectorAll(".info-tabs button"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

if (tabButtons.length && tabPanels.length) {
    tabButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const tab = button.dataset.tab;

            tabButtons.forEach((item) => {
                const isActive = item === button;
                item.classList.toggle("active", isActive);
                item.setAttribute("aria-selected", String(isActive));
            });

            tabPanels.forEach((panel) => {
                panel.classList.toggle("active", panel.dataset.panel === tab);
            });
        });
    });
}

const categoryNames = {
    auction: "拍卖公告",
    industry: "行业动态",
    investment: "招商信息",
    case: "项目案例",
    wechat: "微信公众号",
};

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDate(value) {
    return (value || "").replaceAll("-", ".");
}

function articleUrl(article) {
    if (article.external_url) {
        return article.external_url;
    }

    return `article.html?id=${article.id}`;
}

function articleTarget(article) {
    return article.external_url ? ' target="_blank" rel="noopener"' : "";
}

async function fetchArticles(params = {}) {
    const query = new URLSearchParams({ status: "published", ...params });
    const response = await fetch(`/api/articles?${query.toString()}`);

    if (!response.ok) {
        throw new Error("内容加载失败");
    }

    return response.json();
}

async function hydrateHomeTabs() {
    const panels = Array.from(document.querySelectorAll("[data-dynamic-articles]"));

    if (!panels.length) {
        return;
    }

    await Promise.all(panels.map(async (panel) => {
        const category = panel.dataset.panel;
        const data = await fetchArticles({ category, limit: "5" });

        if (!data.articles.length) {
            panel.innerHTML = '<a href="insights.html"><strong>暂无已发布内容</strong><span>待更新</span></a>';
            return;
        }

        panel.innerHTML = data.articles.map((article) => `
            <a href="${escapeHtml(articleUrl(article))}"${articleTarget(article)}>
                <time>${formatDate(article.published_at)}</time>
                <strong>${escapeHtml(article.title)}</strong>
                <span>${escapeHtml(article.tag || categoryNames[article.category] || "动态")}</span>
            </a>
        `).join("");
    }));
}

async function hydrateArticleList() {
    const list = document.querySelector("[data-articles-list]");

    if (!list) {
        return;
    }

    const data = await fetchArticles({ limit: "50" });

    if (!data.articles.length) {
        list.classList.add("empty");
        list.textContent = "暂无已发布内容。";
        return;
    }

    list.classList.remove("empty");
    list.innerHTML = data.articles.map((article) => `
        <article>
            <time>${escapeHtml(categoryNames[article.category] || "动态")}</time>
            <h2><a href="${escapeHtml(articleUrl(article))}"${articleTarget(article)}>${escapeHtml(article.title)}</a></h2>
            <p>${escapeHtml(article.summary || "更多内容请查看详情。")}</p>
            <span>${escapeHtml(article.tag || categoryNames[article.category] || "动态")}</span>
        </article>
    `).join("");
}

async function hydrateArticleDetail() {
    const title = document.querySelector("#articleTitle");

    if (!title) {
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const error = document.querySelector("#articleError");

    if (!id) {
        error.textContent = "缺少文章 ID。";
        return;
    }

    try {
        const response = await fetch(`/api/articles/${id}`);
        const data = await response.json();

        if (!response.ok || data.ok === false) {
            throw new Error(data.message || "文章加载失败");
        }

        const article = data.article;
        document.title = `${article.title} | 山东众信价格评估拍卖有限公司`;
        title.textContent = article.title;
        document.querySelector("#articleCategory").textContent = categoryNames[article.category] || "News";
        document.querySelector("#articleSummary").textContent = article.summary || "";
        document.querySelector("#articleDate").textContent = formatDate(article.published_at);
        document.querySelector("#articleTag").textContent = article.tag || categoryNames[article.category] || "";

        const cover = document.querySelector("#articleCover");
        if (article.cover_image) {
            cover.src = article.cover_image;
            cover.alt = article.title;
            cover.classList.remove("hidden");
        }

        const body = document.querySelector("#articleBody");
        const paragraphs = (article.body || article.summary || "").split(/\n+/).filter(Boolean);
        body.innerHTML = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
    } catch (loadError) {
        error.textContent = loadError.message;
    }
}

hydrateHomeTabs().catch(() => {});
hydrateArticleList().catch(() => {});
hydrateArticleDetail().catch(() => {});
