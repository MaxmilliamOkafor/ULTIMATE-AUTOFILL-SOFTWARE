"use strict";
(() => {
  // src/ui/popup/popup.ts
  var $ = (id) => document.getElementById(id);
  async function send(msg) {
    return chrome.runtime.sendMessage(msg);
  }
  async function init() {
    const rr = await send({ type: "GET_RESPONSES" });
    if (rr?.ok && Array.isArray(rr.data)) {
      $("respCount").textContent = `${rr.data.length} responses`;
    }
    const qr = await send({ type: "GET_JOB_QUEUE" });
    if (qr?.ok && Array.isArray(qr.data)) {
      $("queueCount").textContent = String(qr.data.length);
    }
    try {
      const ats = await send({ type: "DETECT_ATS" });
      if (ats?.ok && ats.data) {
        const d = ats.data;
        if (d.type !== "generic" && d.confidence > 0.3) {
          const info = $("atsInfo");
          info.style.display = "block";
          info.textContent = `Detected ATS: ${d.type} (${(d.confidence * 100).toFixed(0)}% confidence)`;
        }
      }
    } catch {
    }
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
  init();
})();
//# sourceMappingURL=popup.js.map
