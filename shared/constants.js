// YodhaMind Global Constants
window.YODHAMIND_CONFIG = {
    TOTAL_GAMES: 7
};

// Auto-inject into elements if they have data-config-key
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-config-key]').forEach(el => {
        const key = el.getAttribute('data-config-key');
        if (window.YODHAMIND_CONFIG[key] !== undefined) {
            el.textContent = window.YODHAMIND_CONFIG[key];
        }
    });
});
