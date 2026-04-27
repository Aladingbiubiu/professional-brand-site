const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");

if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
        const isOpen = mainNav.classList.toggle("open");
        menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
}

const contactForm = document.querySelector(".contact-form");
const investmentTags = ["房地产", "车辆", "物资设备", "产权", "租赁权", "其他"];

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
    law: "法律法规",
    wechat: "微信公众号",
};

const filterTitles = {
    all: "新闻动态",
    auction: "拍卖公告",
    industry: "行业动态",
    investment: "招商信息",
    case: "项目案例",
    law: "法律法规",
    wechat: "公众号文章",
};

const filterKickers = {
    all: "News",
    auction: "Auction Notices",
    industry: "Industry Updates",
    investment: "Investment Information",
    case: "Project Cases",
    law: "Laws & Regulations",
    wechat: "WeChat Articles",
};

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function looksLikeHtml(value) {
    return /<\/?[a-z][\s\S]*>/i.test(value || "");
}

function sanitizeRichHtml(value) {
    const allowedTags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "IMG", "SPAN", "DIV", "H2", "H3", "H4", "BLOCKQUOTE", "A"]);
    const allowedStyleProps = new Set([
        "font-size",
        "font-weight",
        "font-style",
        "text-align",
        "text-indent",
        "line-height",
        "margin",
        "margin-top",
        "margin-right",
        "margin-bottom",
        "margin-left",
        "padding",
        "padding-top",
        "padding-right",
        "padding-bottom",
        "padding-left",
        "color",
        "background-color",
        "list-style-type",
    ]);
    const template = document.createElement("template");
    template.innerHTML = value || "";

    function sanitizeStyle(styleText) {
        const safeRules = [];
        styleText.split(";").forEach((rule) => {
            const [rawProp, ...rawValue] = rule.split(":");
            const prop = (rawProp || "").trim().toLowerCase();
            const val = rawValue.join(":").trim();

            if (!allowedStyleProps.has(prop) || !val || /url\s*\(|expression\s*\(|javascript:/i.test(val)) {
                return;
            }

            safeRules.push(`${prop}: ${val}`);
        });
        return safeRules.join("; ");
    }

    function cleanNode(node) {
        Array.from(node.childNodes).forEach((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
                return;
            }
            if (child.nodeType !== Node.ELEMENT_NODE || !allowedTags.has(child.tagName)) {
                child.replaceWith(...Array.from(child.childNodes));
                return;
            }

            Array.from(child.attributes).forEach((attribute) => {
                const name = attribute.name.toLowerCase();
                const val = attribute.value;
                const isSafeImage = child.tagName === "IMG" && ["src", "alt"].includes(name) && !/^javascript:/i.test(val);
                const isSafeLink = child.tagName === "A" && ["href", "target", "rel"].includes(name) && !/^javascript:/i.test(val);
                const safeStyle = name === "style" ? sanitizeStyle(val) : "";

                if (safeStyle) {
                    child.setAttribute("style", safeStyle);
                    return;
                }

                if (!isSafeImage && !isSafeLink) {
                    child.removeAttribute(attribute.name);
                }
            });

            if (child.tagName === "A") {
                child.setAttribute("rel", "noopener");
            }

            cleanNode(child);
        });
    }

    cleanNode(template.content);
    return template.innerHTML;
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

const noticeFallbackImages = {
    auction: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=760&q=80",
    industry: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=760&q=80",
    investment: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=760&q=80",
    case: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1100&q=82",
    wechat: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1100&q=82",
};

async function hydrateNoticeBoard() {
    const columns = Array.from(document.querySelectorAll("[data-notice-feed]"));

    if (!columns.length) {
        return;
    }

    await Promise.all(columns.map(async (column) => {
        const category = column.dataset.noticeFeed;
        const data = await fetchArticles({ category, limit: category === "investment" ? "50" : "5" });
        const body = column.querySelector(".notice-column-body");

        if (!data.articles.length) {
            body.innerHTML = '<p class="notice-empty">暂无已发布内容</p>';
            return;
        }

        if (category === "investment") {
            setupInvestmentTabs(column, data.articles);
            return;
        }

        renderNoticeFeed(column, data.articles, category);
    }));
}

function setupInvestmentTabs(column, articles) {
    const tabs = Array.from(column.querySelectorAll("[data-investment-tag]"));
    const fixedTags = new Set(investmentTags);
    let activeTabIndex = 0;
    let tabTimer;

    function articlesForTag(tag) {
        if (tag === "其他") {
            return articles.filter((article) => article.tag === "其他" || !fixedTags.has(article.tag));
        }

        return articles.filter((article) => article.tag === tag);
    }

    function activateTab(tab, shouldScroll = false) {
        const tag = tab.dataset.investmentTag || "";
        const filtered = articlesForTag(tag);
        activeTabIndex = tabs.indexOf(tab);
        tabs.forEach((item) => item.classList.toggle("active", item === tab));
        renderNoticeFeed(column, filtered, "investment", { emptyLabel: tag });

        if (shouldScroll) {
            column.querySelector(".notice-column-body")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }

    const tabsWithContent = tabs.filter((tab) => articlesForTag(tab.dataset.investmentTag || "").length > 0);
    const rotatingTabs = tabsWithContent.length ? tabsWithContent : tabs;

    function startTabTimer() {
        window.clearInterval(tabTimer);

        if (rotatingTabs.length < 2) {
            return;
        }

        tabTimer = window.setInterval(() => {
            const currentRotatingIndex = rotatingTabs.indexOf(tabs[activeTabIndex]);
            const nextIndex = currentRotatingIndex >= 0 ? currentRotatingIndex + 1 : 0;
            activateTab(rotatingTabs[nextIndex % rotatingTabs.length], false);
        }, 4200);
    }

    tabs.forEach((tab) => {
        tab.addEventListener("click", (event) => {
            event.preventDefault();
            activateTab(tab, true);
            startTabTimer();
        });
    });

    column.addEventListener("mouseenter", () => window.clearInterval(tabTimer));
    column.addEventListener("mouseleave", startTabTimer);

    activateTab(rotatingTabs[0], false);
    startTabTimer();
}

async function hydrateListFeeds() {
    const feeds = Array.from(document.querySelectorAll("[data-list-feed]"));

    if (!feeds.length) {
        return;
    }

    await Promise.all(feeds.map(async (feed) => {
        const category = feed.dataset.listFeed;
        const data = await fetchArticles({ category, limit: "5" });
        const list = feed.querySelector(".compact-list");

        if (!data.articles.length) {
            list.innerHTML = '<p class="notice-empty">暂无已发布内容</p>';
            return;
        }

        list.innerHTML = data.articles.map((article) => `
            <a class="compact-item" href="${escapeHtml(articleUrl(article))}"${articleTarget(article)}>
                <strong>${escapeHtml(article.title)}</strong>
                <time>${escapeHtml(formatDate(article.published_at))}</time>
            </a>
        `).join("");
    }));
}

function renderNoticeFeed(column, articles, category, options = {}) {
    const body = column.querySelector(".notice-column-body");

    if (!articles.length) {
        const emptyLabel = options.emptyLabel ? `“${options.emptyLabel}”分类暂无已发布内容` : "暂无已发布内容";
        body.innerHTML = `<p class="notice-empty investment-empty">${escapeHtml(emptyLabel)}</p>`;
        return;
    }

    const [featured, ...items] = articles;
    const image = featured.cover_image || noticeFallbackImages[category] || noticeFallbackImages.industry;
    body.innerHTML = `
        <a class="notice-featured" href="${escapeHtml(articleUrl(featured))}"${articleTarget(featured)}>
            <img src="${escapeHtml(image)}" alt="${escapeHtml(featured.title)}">
            <div>
                <time>${formatDate(featured.published_at)}</time>
                <strong>${escapeHtml(featured.title)}</strong>
                <p>${escapeHtml(featured.summary || "更多内容请查看详情。")}</p>
            </div>
        </a>
        <div class="notice-list">
            ${items.map((article) => `
                <a class="notice-item" href="${escapeHtml(articleUrl(article))}"${articleTarget(article)}>
                    <strong>${escapeHtml(article.title)}</strong>
                    <time>${formatDate(article.published_at)}</time>
                </a>
            `).join("")}
        </div>
    `;
}

async function hydrateNewsShowcase() {
    const showcase = document.querySelector("[data-news-showcase]");

    if (!showcase) {
        return;
    }

    const groups = await Promise.all([
        fetchArticles({ category: "auction", limit: "4" }),
        fetchArticles({ category: "investment", limit: "4" }),
        fetchArticles({ category: "industry", limit: "4" }),
    ]);
    const articles = groups
        .flatMap((group) => group.articles || [])
        .sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""))
        .slice(0, 8);

    if (!articles.length) {
        return;
    }

    const visual = showcase.querySelector(".news-visual");
    const summary = showcase.querySelector(".news-summary");
    const headlines = showcase.querySelector(".news-headlines");
    let activeNews = 0;
    let newsTimer;

    visual.innerHTML = `
        ${articles.map((article, index) => {
            const image = article.cover_image || noticeFallbackImages[article.category] || noticeFallbackImages.industry;
            return `
                <a class="news-slide${index === 0 ? " active" : ""}" href="${escapeHtml(articleUrl(article))}"${articleTarget(article)}>
                    <img src="${escapeHtml(image)}" alt="${escapeHtml(article.title)}">
                </a>
            `;
        }).join("")}
        <div class="news-dots" aria-label="新闻轮播切换">
            ${articles.map((_, index) => `<button class="${index === 0 ? "active" : ""}" type="button" aria-label="查看新闻 ${index + 1}"></button>`).join("")}
        </div>
    `;

    function renderSummary(index) {
        const article = articles[index];
        const [year, month, day] = (article.published_at || "").split("-");

        summary.innerHTML = `
            <time>${escapeHtml(year || "")}</time>
            <strong>${escapeHtml(month && day ? `${month}-${day}` : formatDate(article.published_at))}</strong>
            <h3>${escapeHtml(article.title)}</h3>
            <p>${escapeHtml(article.summary || "更多内容请查看详情。")}</p>
            <a class="btn primary" href="${escapeHtml(articleUrl(article))}"${articleTarget(article)}>新闻详情</a>
        `;
    }

    function showNews(index) {
        activeNews = (index + articles.length) % articles.length;
        showcase.querySelectorAll(".news-slide").forEach((slide, slideIndex) => {
            slide.classList.toggle("active", slideIndex === activeNews);
        });
        showcase.querySelectorAll(".news-dots button").forEach((dot, dotIndex) => {
            dot.classList.toggle("active", dotIndex === activeNews);
        });
        renderSummary(activeNews);
    }

    function startNewsTimer() {
        window.clearInterval(newsTimer);
        newsTimer = window.setInterval(() => showNews(activeNews + 1), 5200);
    }

    showcase.querySelectorAll(".news-dots button").forEach((button, index) => {
        button.addEventListener("click", () => {
            showNews(index);
            startNewsTimer();
        });
    });

    headlines.innerHTML = articles.slice(1, 4).map((article) => `
        <a href="${escapeHtml(articleUrl(article))}"${articleTarget(article)}>
            <span>热门</span>
            <strong>${escapeHtml(article.title)}</strong>
            <time>${escapeHtml(article.published_at || "")}</time>
        </a>
    `).join("");

    renderSummary(0);
    startNewsTimer();
}

async function hydrateArticleList() {
    const list = document.querySelector("[data-articles-list]");

    if (!list) {
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const category = params.get("category") || "";
    const tag = params.get("tag") || "";
    const page = Math.max(parseInt(params.get("page") || "1", 10) || 1, 1);
    const pageSize = 10;
    const requestParams = { page: String(page), page_size: String(pageSize) };

    if (category) {
        requestParams.category = category;
    } else {
        requestParams.exclude_category = "wechat";
    }

    if (tag) {
        requestParams.tag = tag;
    }

    const data = await fetchArticles(requestParams);
    const articles = data.articles;
    const title = document.querySelector("#articleListTitle");
    const kicker = document.querySelector("#articleListKicker");
    const count = document.querySelector("#articleListCount");
    const activeHref = `${window.location.pathname.split("/").pop() || "insights.html"}${window.location.search}`;

    document.querySelectorAll("[data-filter-link]").forEach((link) => {
        const linkUrl = new URL(link.getAttribute("href"), window.location.href);
        const currentUrl = new URL(activeHref, window.location.href);
        linkUrl.searchParams.delete("page");
        currentUrl.searchParams.delete("page");
        link.classList.toggle("active", linkUrl.search === currentUrl.search);
    });

    if (title) {
        title.textContent = tag || filterTitles[category] || filterTitles.all;
    }

    if (kicker) {
        kicker.textContent = filterKickers[category] || filterKickers.all;
    }

    if (count) {
        count.textContent = data.total ? `共 ${data.total} 条内容，第 ${data.page} / ${data.total_pages} 页` : "暂无匹配内容";
    }

    let pager = document.querySelector("[data-article-pagination]");
    if (!pager) {
        pager = document.createElement("nav");
        pager.className = "article-pagination";
        pager.setAttribute("data-article-pagination", "");
        pager.setAttribute("aria-label", "内容分页");
        list.insertAdjacentElement("afterend", pager);
    }

    if (!articles.length) {
        list.classList.add("empty");
        list.textContent = "暂无已发布内容。";
        renderArticlePagination(pager, data.page || 1, data.total_pages || 1);
        return;
    }

    list.classList.remove("empty");
    list.innerHTML = articles.map((article) => {
        const subMeta = category
            ? formatDate(article.published_at)
            : (article.tag || formatDate(article.published_at));

        return `
        <article>
            <h2><a href="${escapeHtml(articleUrl(article))}"${articleTarget(article)}>${escapeHtml(article.title)}</a></h2>
            <p>${escapeHtml(article.summary || "更多内容请查看详情。")}</p>
            <span>${escapeHtml(subMeta)}</span>
        </article>
    `;
    }).join("");
    renderArticlePagination(pager, data.page, data.total_pages);
}

function pageUrl(page) {
    const url = new URL(window.location.href);
    if (page <= 1) {
        url.searchParams.delete("page");
    } else {
        url.searchParams.set("page", String(page));
    }
    return `${url.pathname.split("/").pop() || "insights.html"}${url.search}`;
}

function renderArticlePagination(pager, page, totalPages) {
    const current = Math.max(page || 1, 1);
    const total = Math.max(totalPages || 1, 1);

    if (total <= 1) {
        pager.innerHTML = "";
        pager.classList.add("hidden");
        return;
    }

    pager.classList.remove("hidden");
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    const pageLinks = [];

    for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
        pageLinks.push(`<a class="${pageNumber === current ? "active" : ""}" href="${escapeHtml(pageUrl(pageNumber))}">${pageNumber}</a>`);
    }

    pager.innerHTML = `
        <a class="${current === 1 ? "disabled" : ""}" href="${escapeHtml(pageUrl(1))}">首页</a>
        <a class="${current === 1 ? "disabled" : ""}" href="${escapeHtml(pageUrl(Math.max(1, current - 1)))}">上一页</a>
        ${pageLinks.join("")}
        <a class="${current === total ? "disabled" : ""}" href="${escapeHtml(pageUrl(Math.min(total, current + 1)))}">下一页</a>
        <a class="${current === total ? "disabled" : ""}" href="${escapeHtml(pageUrl(total))}">末页</a>
    `;
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
        document.querySelector("#articleContentTitle").textContent = article.title;
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
        const content = article.body || article.summary || "";
        body.innerHTML = looksLikeHtml(content)
            ? sanitizeRichHtml(content)
            : content.split(/\n+/).filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
    } catch (loadError) {
        error.textContent = loadError.message;
    }
}

hydrateNoticeBoard().catch(() => {});
hydrateListFeeds().catch(() => {});
hydrateNewsShowcase().catch(() => {});
hydrateArticleList().catch(() => {});
hydrateArticleDetail().catch(() => {});
