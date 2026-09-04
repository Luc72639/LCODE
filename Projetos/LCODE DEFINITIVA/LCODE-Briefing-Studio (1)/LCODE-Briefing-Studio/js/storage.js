/**
 * storage.js
 * Persistência local do briefing: rascunho automático, recuperação
 * e trava de envio único por dispositivo.
 */
const BriefingStorage = (() => {
  const DRAFT_KEY = "lcode-briefing-draft";
  const SENT_KEY = "lcode-briefing-sent";
  const THEME_KEY = "lcode-briefing-theme";

  function saveDraft(data) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  function loadDraft() {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null;
    } catch {
      return null;
    }
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

  function markAsSent() {
    localStorage.setItem(SENT_KEY, "1");
  }

  function wasAlreadySent() {
    return localStorage.getItem(SENT_KEY) === "1";
  }

  function getTheme() {
    return localStorage.getItem(THEME_KEY);
  }

  function setTheme(value) {
    localStorage.setItem(THEME_KEY, value);
  }

  return { saveDraft, loadDraft, clearDraft, markAsSent, wasAlreadySent, getTheme, setTheme };
})();
