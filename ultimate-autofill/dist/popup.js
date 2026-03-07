"use strict";
(() => {
  // src/ui/popup/popup.ts
  var $ = (id) => document.getElementById(id);
  async function send(msg) {
    return chrome.runtime.sendMessage(msg);
  }
  var autoApplyPolling = null;
  async function init() {
    const rr = await send({ type: "GET_RESPONSES" });
    if (rr?.ok && Array.isArray(rr.data)) {
      $("respCount").textContent = `${rr.data.length} responses`;
    }
    const qr = await send({ type: "GET_JOB_QUEUE" });
    if (qr?.ok && Array.isArray(qr.data)) {
      $("queueCount").textContent = String(qr.data.length);
      const applied = qr.data.filter((j) => j.status === "applied" || j.status === "completed").length;
      $("appliedCount").textContent = String(applied);
    }
    const cr = await send({ type: "CHECK_CREDITS" });
    if (cr?.ok && cr.data) {
      const d = cr.data;
      $("creditsDisplay").textContent = d.unlimited ? "Unlimited" : `${d.remaining} credits`;
    }
    try {
      const ats = await send({ type: "DETECT_ATS" });
      if (ats?.ok && ats.data) {
        const d = ats.data;
        if (d.type !== "generic" && d.confidence > 0.3) {
          const info = $("atsInfo");
          info.style.display = "block";
          const atsLabel = d.type === "companysite" ? "Company Career Site" : d.type;
          info.textContent = `Detected: ${atsLabel} (${(d.confidence * 100).toFixed(0)}% confidence) \u2014 All forms supported`;
        }
      }
    } catch {
    }
    try {
      const tr = await send({ type: "GET_TAILORING_STATUS" });
      if (tr?.ok && tr.data?.enabled) {
        $("tailoringBadge").style.display = "block";
        $("tailoringStatus").textContent = `Active \u2014 ${Math.round(tr.data.intensity * 100)}% intensity`;
      }
    } catch {
    }
    await refreshAutoApplyStatus();
    $("btnFill").addEventListener("click", async () => {
      $("btnFill").classList.add("hidden");
      $("btnStop").classList.remove("hidden");
      $("dot").classList.remove("off");
      $("dot").classList.add("on");
      $("statusText").textContent = "Running...";
      await send({ type: "START_AUTOFILL" });
    });
    $("btnStop").addEventListener("click", async () => {
      $("btnStop").classList.add("hidden");
      $("btnFill").classList.remove("hidden");
      $("dot").classList.remove("on");
      $("dot").classList.add("off");
      $("statusText").textContent = "Stopped";
      await send({ type: "STOP_AUTOFILL" });
    });
    $("btnAutoApply").addEventListener("click", async () => {
      await send({ type: "START_AUTO_APPLY", payload: { source: "all" } });
      showAutoApplyRunning();
    });
    $("btnAutoApplyImported").addEventListener("click", async () => {
      await send({ type: "START_AUTO_APPLY", payload: { source: "imported" } });
      showAutoApplyRunning();
    });
    $("btnStopAutoApply").addEventListener("click", async () => {
      await send({ type: "STOP_AUTO_APPLY" });
      hideAutoApplyRunning();
    });
    $("btnPauseAutoApply").addEventListener("click", async () => {
      await send({ type: "PAUSE_AUTO_APPLY" });
      $("btnPauseAutoApply").classList.add("hidden");
      $("btnResumeAutoApply").classList.remove("hidden");
      $("statusText").textContent = "Paused";
    });
    $("btnResumeAutoApply").addEventListener("click", async () => {
      await send({ type: "RESUME_AUTO_APPLY" });
      $("btnResumeAutoApply").classList.add("hidden");
      $("btnPauseAutoApply").classList.remove("hidden");
      $("statusText").textContent = "Auto-applying...";
    });
    $("btnResponses").addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
    $("btnQueue").addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
    $("openOptions").addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }
  function showAutoApplyRunning() {
    $("btnAutoApply").classList.add("hidden");
    $("btnAutoApplyImported").classList.add("hidden");
    $("btnStopAutoApply").classList.remove("hidden");
    $("btnPauseAutoApply").classList.remove("hidden");
    $("dot").classList.remove("off");
    $("dot").classList.add("on");
    $("statusText").textContent = "Auto-applying...";
    if (!autoApplyPolling) {
      autoApplyPolling = setInterval(refreshAutoApplyStatus, 3e3);
    }
  }
  function hideAutoApplyRunning() {
    $("btnStopAutoApply").classList.add("hidden");
    $("btnPauseAutoApply").classList.add("hidden");
    $("btnResumeAutoApply").classList.add("hidden");
    $("btnAutoApply").classList.remove("hidden");
    $("btnAutoApplyImported").classList.remove("hidden");
    $("dot").classList.remove("on");
    $("dot").classList.add("off");
    $("statusText").textContent = "Stopped";
    $("autoApplyStatus").style.display = "none";
    if (autoApplyPolling) {
      clearInterval(autoApplyPolling);
      autoApplyPolling = null;
    }
  }
  async function refreshAutoApplyStatus() {
    try {
      const r = await send({ type: "GET_AUTO_APPLY_STATUS" });
      if (!r?.ok)
        return;
      const status = r.data;
      if (status.running) {
        showAutoApplyRunning();
        const el = $("autoApplyStatus");
        el.style.display = "block";
        el.textContent = `Auto-Apply: ${status.completedJobs}/${status.totalJobs} completed | ${status.failedJobs} failed | ${status.estimatedRemaining} remaining`;
        if (status.paused) {
          $("btnPauseAutoApply").classList.add("hidden");
          $("btnResumeAutoApply").classList.remove("hidden");
          $("statusText").textContent = "Paused";
        }
      }
    } catch {
    }
  }
  init();
})();
//# sourceMappingURL=popup.js.map
