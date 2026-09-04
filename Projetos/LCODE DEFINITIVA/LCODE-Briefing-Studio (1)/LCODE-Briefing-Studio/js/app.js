/**
 * app.js
 * Orquestra as telas (intro → formulário → sucesso), a navegação
 * entre etapas, seleção de opções, autosave e envio do briefing.
 */
(() => {
  const TOTAL_STEPS = 7;
  let currentStep = 1;
  let autosaveTimer = null;

  const $ = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];

  const screenIntro = $("#screenIntro");
  const screenForm = $("#screenForm");
  const screenSuccess = $("#screenSuccess");
  const form = $("#briefingForm");
  const steps = $$(".step", form);
  const stepIndicator = $("#stepIndicator");
  const stepperFill = $("#stepperFill");
  const stepperDots = $("#stepperDots");
  const backBtn = $("#backBtn");
  const nextBtn = $("#nextBtn");
  const autosaveStatus = $("#autosaveStatus");
  const reviewBox = $("#reviewBox");

  /* ---------------- tema ---------------- */
  function initTheme() {
    const saved = BriefingStorage.getTheme();
    if (saved === "dark") document.documentElement.classList.add("dark");
    $("#themeToggle").addEventListener("click", () => {
      document.documentElement.classList.toggle("dark");
      BriefingStorage.setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    });
  }

  /* ---------------- stepper visual ---------------- */
  function buildStepperDots() {
    stepperDots.innerHTML = "";
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const li = document.createElement("li");
      li.textContent = String(i).padStart(2, "0");
      stepperDots.appendChild(li);
    }
  }

  function renderStepper() {
    stepperFill.style.width = `${(currentStep / TOTAL_STEPS) * 100}%`;
    $$("li", stepperDots).forEach((li, i) => li.classList.toggle("active", i + 1 === currentStep));
    stepIndicator.textContent = `Etapa ${currentStep} de ${TOTAL_STEPS}`;
  }

  /* ---------------- escolhas (cards / chips) ---------------- */
  function initChoiceGroups() {
    $$("[data-group]", form).forEach((group) => {
      const mode = group.dataset.mode;
      $$("button", group).forEach((btn) => {
        btn.addEventListener("click", () => {
          if (mode === "single") {
            $$("button", group).forEach((b) => b.classList.remove("selected"));
            btn.classList.add("selected");
          } else {
            btn.classList.toggle("selected");
          }
          scheduleAutosave();
        });
      });
    });
  }

  function getChoiceValue(group) {
    const mode = group.dataset.mode;
    const selected = $$("button.selected", group).map((b) => b.dataset.value);
    return mode === "single" ? (selected[0] || "") : selected;
  }

  function setChoiceValue(group, value) {
    const mode = group.dataset.mode;
    const values = mode === "single" ? [value] : Array.isArray(value) ? value : [];
    $$("button", group).forEach((b) => b.classList.toggle("selected", values.includes(b.dataset.value)));
  }

  /* ---------------- coleta / restauração de dados ---------------- */
  function collectData() {
    const data = {};
    new FormData(form).forEach((value, key) => (data[key] = value));
    $$("[data-group]", form).forEach((group) => (data[group.dataset.group] = getChoiceValue(group)));
    return data;
  }

  function restoreDraft() {
    const draft = BriefingStorage.loadDraft();
    if (!draft) return;
    Object.entries(draft).forEach(([key, value]) => {
      const group = $(`[data-group="${key}"]`, form);
      if (group) return setChoiceValue(group, value);
      const field = form.elements[key];
      if (field && typeof value === "string") field.value = value;
    });
  }

  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      const data = collectData();
      delete data.consentimento;
      BriefingStorage.saveDraft(data);
      autosaveStatus.textContent = "Salvo automaticamente";
    }, 300);
  }

  /* ---------------- validação por etapa ---------------- */
  function findInvalidField(stepEl) {
    return $$("input[required], select[required], textarea[required]", stepEl).find((f) => !f.checkValidity());
  }

  function validateAllSteps() {
    for (const stepEl of steps) {
      const invalid = findInvalidField(stepEl);
      if (invalid) {
        goToStep(Number(stepEl.dataset.step));
        invalid.classList.add("invalid");
        setTimeout(() => { invalid.focus(); invalid.reportValidity(); }, 50);
        return false;
      }
    }
    return true;
  }

  /* ---------------- navegação ---------------- */
  function goToStep(n) {
    currentStep = Math.max(1, Math.min(TOTAL_STEPS, n));
    steps.forEach((s) => s.classList.toggle("active", Number(s.dataset.step) === currentStep));
    renderStepper();
    backBtn.style.visibility = currentStep === 1 ? "hidden" : "visible";
    nextBtn.textContent = currentStep === TOTAL_STEPS ? "Enviar briefing" : "Continuar";
    if (currentStep === TOTAL_STEPS) renderReview();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleNext(e) {
    e.preventDefault();
    const currentStepEl = steps[currentStep - 1];
    const invalid = findInvalidField(currentStepEl);
    if (invalid) { invalid.classList.add("invalid"); invalid.focus(); invalid.reportValidity(); return; }

    if (currentStep === TOTAL_STEPS) return submitBriefing();
    goToStep(currentStep + 1);
  }

  function handleBack() {
    goToStep(currentStep - 1);
  }

  /* ---------------- revisão final ---------------- */
  function renderReview() {
    const d = collectData();
    const rows = [
      ["Empresa", d.empresa],
      ["Solução", d.solucao],
      ["Objetivo", Array.isArray(d.objetivo) ? d.objetivo.join(", ") : d.objetivo],
      ["Estilo visual", d.estilo],
      ["Páginas", Array.isArray(d.paginas) ? d.paginas.join(", ") : d.paginas],
    ];
    reviewBox.innerHTML = rows
      .map(([label, value]) => `<div class="review-row"><b>${label}</b><span>${value && value.length ? escapeHtml(value) : "—"}</span></div>`)
      .join("");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  }

  /* ---------------- envio ---------------- */
  async function submitBriefing() {
    if (!validateAllSteps()) return;
    const data = collectData();
    nextBtn.disabled = true;
    autosaveStatus.textContent = "Enviando...";
    try {
      await EmailService.send(data);
      BriefingStorage.markAsSent();
      BriefingStorage.clearDraft();
      showSuccess();
    } catch (err) {
      console.error(err);
      autosaveStatus.textContent = "Falha no envio";
      alert("Não foi possível enviar o briefing agora. Tente novamente em instantes.");
    } finally {
      nextBtn.disabled = false;
    }
  }

  /* ---------------- transições de tela ---------------- */
  function showForm() {
    screenIntro.hidden = true;
    screenForm.hidden = false;
    stepIndicator.hidden = false;
    goToStep(currentStep);
  }

  function showSuccess() {
    screenForm.hidden = true;
    screenSuccess.hidden = false;
    stepIndicator.hidden = true;
  }

  function showIntro() {
    screenSuccess.hidden = true;
    screenForm.hidden = true;
    screenIntro.hidden = false;
    stepIndicator.hidden = true;
  }

  /* ---------------- envio único ---------------- */
  function lockIfAlreadySent() {
    if (!BriefingStorage.wasAlreadySent()) return false;
    showSuccess();
    $(".success-content h1", screenSuccess).textContent = "Você já enviou um briefing.";
    $(".success-content p", screenSuccess).textContent =
      "Este dispositivo já registrou um envio para a LCODE. Caso precise corrigir alguma informação, entre em contato com nossa equipe.";
    return true;
  }

function initFieldValidation() {
    $$("input[required], select[required], textarea[required]", form).forEach((field) => {
      field.addEventListener("blur", () => field.classList.toggle("invalid", !field.checkValidity()));
      field.addEventListener("input", () => { if (field.checkValidity()) field.classList.remove("invalid"); });
    });
  }

  /* ---------------- init ---------------- */
  function init() {
    initTheme();
    buildStepperDots();
    initChoiceGroups();
    initFieldValidation();
    restoreDraft();
    form.addEventListener("input", scheduleAutosave);

    $("#startBtn").addEventListener("click", showForm);
    $("#restartBtn").addEventListener("click", (e) => { e.preventDefault(); showIntro(); });
    backBtn.addEventListener("click", handleBack);
    form.addEventListener("submit", handleNext);

    if (lockIfAlreadySent()) return;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
