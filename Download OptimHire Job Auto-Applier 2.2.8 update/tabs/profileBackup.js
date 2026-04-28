(() => {
  const PROFILE_KEYS = [
    "candidateDetails",
    "preferredJobsite",
    "skipStatusUpdates",
    "manualApplicationDetail",
    "isManualAppliedCount",
    "appliedCount",
    "matchingJobCount"
  ];

  const $ = (id) => document.getElementById(id);

  const setStatus = (el, msg, kind) => {
    el.textContent = msg;
    el.className = "status show " + (kind || "ok");
  };
  const clearStatus = (el) => {
    el.textContent = "";
    el.className = "status";
  };

  const readProfile = () =>
    new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(PROFILE_KEYS, (data) => {
          const err = chrome.runtime.lastError;
          if (err) return reject(err);
          resolve(data || {});
        });
      } catch (e) {
        reject(e);
      }
    });

  const writeProfile = (obj) =>
    new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(obj, () => {
          const err = chrome.runtime.lastError;
          if (err) return reject(err);
          resolve();
        });
      } catch (e) {
        reject(e);
      }
    });

  const removeProfile = () =>
    new Promise((resolve, reject) => {
      try {
        chrome.storage.local.remove(PROFILE_KEYS, () => {
          const err = chrome.runtime.lastError;
          if (err) return reject(err);
          resolve();
        });
      } catch (e) {
        reject(e);
      }
    });

  const tsStamp = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      "-" +
      pad(d.getHours()) +
      pad(d.getMinutes())
    );
  };

  const downloadJson = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const summarise = (data) => {
    const present = Object.keys(data || {}).filter(
      (k) => data[k] !== undefined && data[k] !== null
    );
    if (!present.length) return "(no profile data saved yet)";
    return present
      .map((k) => {
        const v = data[k];
        const t = typeof v;
        if (t === "object") {
          const s = JSON.stringify(v);
          return k + ": " + (s.length > 240 ? s.slice(0, 240) + "..." : s);
        }
        return k + ": " + String(v);
      })
      .join("\n");
  };

  $("btn-export").addEventListener("click", async () => {
    const status = $("export-status");
    clearStatus(status);
    try {
      const data = await readProfile();
      const present = Object.keys(data).filter(
        (k) => data[k] !== undefined && data[k] !== null
      );
      if (!present.length) {
        setStatus(
          status,
          "Nothing to export yet — fill out your profile in the side panel first.",
          "err"
        );
        return;
      }
      const payload = {
        __format: "optimhire-profile-backup",
        __version: 1,
        __exportedAt: new Date().toISOString(),
        data
      };
      downloadJson(payload, "optimhire-profile-" + tsStamp() + ".json");
      setStatus(
        status,
        "Backup downloaded (" + present.length + " field" + (present.length === 1 ? "" : "s") + ").",
        "ok"
      );
    } catch (e) {
      setStatus(status, "Export failed: " + (e && e.message ? e.message : e), "err");
    }
  });

  $("btn-preview").addEventListener("click", async () => {
    const status = $("export-status");
    const box = $("preview-box");
    clearStatus(status);
    try {
      const data = await readProfile();
      box.textContent = summarise(data);
      box.className = "summary show";
    } catch (e) {
      setStatus(status, "Could not read storage: " + (e && e.message ? e.message : e), "err");
    }
  });

  let pendingImport = null;
  $("file-input").addEventListener("change", async (e) => {
    const status = $("import-status");
    clearStatus(status);
    pendingImport = null;
    $("btn-import").disabled = true;
    const file = e.target.files && e.target.files[0];
    if (!file) {
      $("file-name").textContent = "No file selected";
      return;
    }
    $("file-name").textContent = file.name;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = parsed && parsed.__format === "optimhire-profile-backup"
        ? parsed.data
        : parsed;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("File doesn't look like a profile backup.");
      }
      const allowed = {};
      for (const k of PROFILE_KEYS) {
        if (k in payload) allowed[k] = payload[k];
      }
      if (!Object.keys(allowed).length) {
        throw new Error("Backup file has no recognised profile fields.");
      }
      pendingImport = allowed;
      $("btn-import").disabled = false;
      setStatus(
        status,
        "Ready to import " + Object.keys(allowed).length + " field(s). Click “Import & save” to apply.",
        "ok"
      );
    } catch (err) {
      setStatus(status, "Could not read file: " + (err && err.message ? err.message : err), "err");
    }
  });

  $("btn-import").addEventListener("click", async () => {
    const status = $("import-status");
    if (!pendingImport) {
      setStatus(status, "No file loaded.", "err");
      return;
    }
    try {
      await writeProfile(pendingImport);
      setStatus(
        status,
        "Imported " + Object.keys(pendingImport).length + " field(s). Reload the side panel for changes to take effect.",
        "ok"
      );
      pendingImport = null;
      $("btn-import").disabled = true;
      $("file-input").value = "";
      $("file-name").textContent = "No file selected";
    } catch (e) {
      setStatus(status, "Import failed: " + (e && e.message ? e.message : e), "err");
    }
  });

  $("btn-reset").addEventListener("click", async () => {
    const status = $("reset-status");
    clearStatus(status);
    if (!confirm("Clear saved profile data from this browser? This cannot be undone.")) return;
    try {
      await removeProfile();
      setStatus(status, "Profile data cleared.", "ok");
    } catch (e) {
      setStatus(status, "Reset failed: " + (e && e.message ? e.message : e), "err");
    }
  });
})();
