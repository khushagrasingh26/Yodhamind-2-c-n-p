/**
 * shared/theme.js — YodhaMind Global Theme Manager
 * ══════════════════════════════════════════════════
 * 
 * Included early in the <head> to prevent Flash of Unstyled Content (FOUC).
 * Reads the 'ym_theme' from localStorage and sets the data-theme attribute.
 */

(function() {
    try {
        // Temporarily forcing light mode globally as requested
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('ym_theme', 'light');
    } catch (e) {
        console.error('Theme initialization failed', e);
    }
})();

window.ymToggleTheme = function() {
    console.log("Dark mode is temporarily disabled.");
};
