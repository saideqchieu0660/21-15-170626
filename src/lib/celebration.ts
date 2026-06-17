export const getConfetti = () => {
    return (...args: any[]) => {};
};

export const triggerCelebration = () => {
    window.dispatchEvent(new CustomEvent("app-pulse-logo"));
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([100, 50, 100, 50, 150]); // Distinct triple pulse pattern for celebration milestone
    }
};
