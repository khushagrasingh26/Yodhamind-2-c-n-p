const YMPersonalize = {
  getSuggestion() {
    const concern = localStorage.getItem('ym_concern'); // set in onboarding (Fix 9)
    const lastMood = parseInt(localStorage.getItem('ym_last_mood_score') || '5');
    const hour = new Date().getHours();
    const dayStreak = parseInt(localStorage.getItem('ym_streak') || '0');

    // Time-based defaults
    if (hour >= 22 || hour < 6) {
      return { tool: 'breathing', reason: 'Winding down before sleep?' };
    }
    if (hour >= 6 && hour < 9) {
      return { tool: 'journal', reason: 'Start your day with a clear head.' };
    }

    // Mood-based
    if (lastMood <= 3) {
      return { tool: 'breathing', reason: 'Take 2 minutes to breathe.' };
    }
    if (lastMood >= 7) {
      return { tool: 'games', reason: 'You\'re in a good place — train your focus.' };
    }

    // Concern-based
    const concernMap = {
      stress: { tool: 'assessment', reason: 'Check your stress level today.' },
      sleep:  { tool: 'breathing', reason: 'Try a sleep breathing exercise.' },
      motivation: { tool: 'games', reason: 'A 2-min game can reset your mind.' },
      anxiety: { tool: 'breathing', reason: 'Box breathing can help right now.' },
      all: { tool: 'assessment', reason: 'Start with understanding where you are.' }
    };

    return concernMap[concern] || { tool: 'assessment', reason: 'How are you feeling today?' };
  },

  getDestination(tool) {
    const map = {
      breathing: '/tools/spirit-breathing-tool.html',
      journal: '/journal',
      games: '/games',
      assessment: '/assessment',
      community: '/community'
    };
    return map[tool] || '/dashboard';
  }
};

// Inject suggestion into homepage hero if element exists
document.addEventListener('DOMContentLoaded', () => {
  const suggestionEl = document.getElementById('ym-suggestion');
  if (!suggestionEl) return;
  const s = YMPersonalize.getSuggestion();
  suggestionEl.innerHTML = `
    <p class="suggestion-reason">${s.reason}</p>
    <a href="${YMPersonalize.getDestination(s.tool)}" class="suggestion-link">
      Open recommended tool →
    </a>
  `;
  suggestionEl.removeAttribute('hidden');
});
