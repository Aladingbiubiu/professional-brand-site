(function () {
    "use strict";

    const groups = Array.isArray(window.ZHONGXIN_UNIVERSITY_GROUPS) ? window.ZHONGXIN_UNIVERSITY_GROUPS : [];
    const tabsEl = document.querySelector("#tmRegionTabs");
    const gridEl = document.querySelector("#tmUniversityGrid");
    const resultEl = document.querySelector("#tmResult");
    const emptyEl = document.querySelector("#tmEmpty");
    const searchEl = document.querySelector("#tmSearch");
    const keyOnlyEl = document.querySelector("#tmKeyOnly");
    const toastEl = document.querySelector("#tmToast");

    if (!tabsEl || !gridEl || !groups.length) {
        return;
    }

    const densityLabels = {
        high: "高密度",
        mid: "中密度",
        low: "低密度",
    };
    const state = {
        groupId: groups[0].id,
        query: "",
        keyOnly: false,
    };
    let toastTimer;

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function normalize(value) {
        return String(value || "").trim().toLowerCase();
    }

    function safeUrl(value) {
        try {
            const url = new URL(value);
            return /^https?:$/.test(url.protocol) ? url.href : "#";
        } catch (error) {
            return "#";
        }
    }

    function icon(name) {
        return `<svg class="tm-icon" aria-hidden="true"><use href="#tm-i-${name}"></use></svg>`;
    }

    function currentGroup() {
        return groups.find((group) => group.id === state.groupId) || groups[0];
    }

    function visibleUniversities() {
        const query = normalize(state.query);

        return currentGroup().universities.filter((university) => {
            if (state.keyOnly && !university.key) {
                return false;
            }
            if (!query) {
                return true;
            }
            return normalize(university.name).includes(query) || normalize(university.region).includes(query);
        });
    }

    function renderTabs() {
        tabsEl.innerHTML = groups.map((group) => {
            const active = group.id === state.groupId;
            return `<button class="tm-tab${active ? " active" : ""}" type="button" aria-pressed="${active}" data-group="${escapeHtml(group.id)}">${escapeHtml(group.name)}<b>${group.universities.length}</b></button>`;
        }).join("");
    }

    function renderCard(university) {
        const density = ["high", "mid", "low"].includes(university.density) ? university.density : "low";
        const propertyUrl = `https://www.sdcqjy.com/search/zc?type=proj&keyword=${encodeURIComponent(university.name)}`;

        return `<article class="tm-uni-card">
            <div class="tm-uni-head">
                <h3>${escapeHtml(university.name)}</h3>
                ${university.key ? '<span class="tm-key">重点</span>' : ""}
            </div>
            <p class="tm-uni-meta"><i class="tm-dot tm-dot-${density}"></i>${escapeHtml(university.region)} · ${densityLabels[density]}</p>
            <div class="tm-uni-links">
                <a class="tm-uni-link" href="${escapeHtml(safeUrl(university.dept))}" target="_blank" rel="noopener">${icon("dept")}<span>国资处</span></a>
                <a class="tm-uni-link" href="${escapeHtml(safeUrl(university.tender))}" target="_blank" rel="noopener">${icon("search")}<span>招标网</span></a>
                <a class="tm-uni-link" href="${escapeHtml(propertyUrl)}" target="_blank" rel="noopener">${icon("landmark")}<span>产权挂牌</span></a>
            </div>
        </article>`;
    }

    function render() {
        const group = currentGroup();
        const universities = visibleUniversities();

        gridEl.innerHTML = universities.map(renderCard).join("");

        if (resultEl) {
            resultEl.textContent = `${group.name} · 共 ${universities.length} 所院校${state.keyOnly ? "（仅看重点）" : ""}`;
        }

        if (emptyEl) {
            emptyEl.hidden = universities.length > 0;
        }
    }

    function setGroup(groupId) {
        if (!groups.some((group) => group.id === groupId)) {
            return;
        }

        state.groupId = groupId;
        renderTabs();
        render();

        try {
            const url = new URL(window.location.href);
            url.searchParams.set("region", groupId);
            window.history.replaceState(null, "", url);
        } catch (error) {
            /* 本地 file:// 预览时忽略地址栏同步 */
        }
    }

    function showToast(message) {
        if (!toastEl) {
            return;
        }

        window.clearTimeout(toastTimer);
        toastEl.textContent = message;
        toastEl.classList.add("show");
        toastTimer = window.setTimeout(() => {
            toastEl.classList.remove("show");
        }, 2200);
    }

    async function writeClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (error) {
                /* 继续尝试兼容方案 */
            }
        }

        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.top = "-1000px";
        document.body.appendChild(area);
        area.select();

        let copied = false;
        try {
            copied = document.execCommand("copy");
        } catch (error) {
            copied = false;
        }

        area.remove();
        return copied;
    }

    function packKeywords(card) {
        return Array.from(card.querySelectorAll(".tm-chips span"))
            .map((chip) => chip.textContent.trim())
            .filter(Boolean);
    }

    function flashButton(button, label) {
        const original = button.dataset.originalLabel || button.textContent;
        button.dataset.originalLabel = original;
        button.textContent = label;
        button.classList.add("is-copied");

        window.clearTimeout(button.tmTimer);
        button.tmTimer = window.setTimeout(() => {
            button.textContent = original;
            button.classList.remove("is-copied");
        }, 1800);
    }

    const initialParams = new URLSearchParams(window.location.search);
    const initialRegion = initialParams.get("region");

    if (groups.some((group) => group.id === initialRegion)) {
        state.groupId = initialRegion;
    }

    state.query = initialParams.get("q") || "";
    state.keyOnly = initialParams.get("key") === "1";

    if (searchEl) {
        searchEl.value = state.query;
        searchEl.addEventListener("input", () => {
            state.query = searchEl.value;
            render();
        });
    }

    if (keyOnlyEl) {
        keyOnlyEl.checked = state.keyOnly;
        keyOnlyEl.addEventListener("change", () => {
            state.keyOnly = keyOnlyEl.checked;
            render();
        });
    }

    tabsEl.addEventListener("click", (event) => {
        const button = event.target.closest("[data-group]");
        if (button) {
            setGroup(button.dataset.group);
        }
    });

    document.querySelectorAll(".tm-keyword-card").forEach((card) => {
        const button = card.querySelector(".tm-copy-btn");
        if (!button) {
            return;
        }

        button.addEventListener("click", async () => {
            const keywords = packKeywords(card);
            const copied = await writeClipboard(keywords.join(" "));

            if (!copied) {
                showToast("复制失败，请手动选择复制");
                return;
            }

            flashButton(button, "已复制");
            showToast(`已复制 ${keywords.length} 个关键词`);
        });
    });

    const copyAllButton = document.querySelector("#tmCopyAll");
    if (copyAllButton) {
        copyAllButton.addEventListener("click", async () => {
            const keywords = Array.from(document.querySelectorAll(".tm-keyword-card"))
                .flatMap(packKeywords);

            if (!keywords.length) {
                return;
            }

            const copied = await writeClipboard(keywords.join(" "));

            if (!copied) {
                showToast("复制失败，请手动选择复制");
                return;
            }

            flashButton(copyAllButton, "已复制全部");
            showToast(`已复制 ${keywords.length} 个关键词`);
        });
    }

    renderTabs();
    render();
})();
