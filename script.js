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
