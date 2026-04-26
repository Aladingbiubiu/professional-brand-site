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
