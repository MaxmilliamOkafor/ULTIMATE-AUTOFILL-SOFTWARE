"use strict";
(() => {
  // src/utils/helpers.ts
  function generateId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : r & 3 | 8).toString(16);
    });
  }

  // src/utils/fuzzy.ts
  function normalize(text) {
    return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0)
      return n;
    if (n === 0)
      return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    let curr = new Array(n + 1);
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        curr[j] = Math.min(
          prev[j] + 1,
          curr[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      [prev, curr] = [curr, prev];
    }
    return prev[n];
  }
  function stringSimilarity(a, b) {
    const na = normalize(a), nb = normalize(b);
    if (na === nb)
      return 1;
    const max = Math.max(na.length, nb.length);
    return max === 0 ? 1 : 1 - levenshtein(na, nb) / max;
  }
  function findDuplicates(items, threshold = 0.75) {
    const out = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const sim = stringSimilarity(items[i].question, items[j].question);
        if (sim >= threshold)
          out.push({ idA: items[i].id, idB: items[j].id, similarity: sim });
      }
    }
    return out.sort((a, b) => b.similarity - a.similarity);
  }

  // src/ui/options/options.ts
  var $ = (id) => document.getElementById(id);
  var send = (msg) => chrome.runtime.sendMessage(msg);
  var selected = /* @__PURE__ */ new Set();
  var currentResponses = [];
  var currentLibId = "";
  function toast(text) {
    const el = $("toast");
    el.textContent = text;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2500);
  }
  function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      document.querySelectorAll(".tc").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      $(`tab-${t.dataset.tab}`).classList.add("active");
    });
  });
  async function loadLibraries() {
    const r = await send({ type: "GET_LIBRARIES" });
    if (!r?.ok)
      return;
    const libs = r.data;
    const activeR = await send({ type: "GET_ACTIVE_LIBRARY" });
    const active = activeR?.data;
    currentLibId = active?.id || libs[0]?.id || "";
    for (const sel of [
      $("libSelect"),
      $("newDomLib")
    ]) {
      sel.innerHTML = libs.map((l) => `<option value="${l.id}" ${l.id === currentLibId ? "selected" : ""}>${escHtml(l.name)}</option>`).join("");
    }
    renderLibsList(libs);
  }
  function renderLibsList(libs) {
    const el = $("libsList");
    if (!libs.length) {
      el.innerHTML = '<p class="muted">No libraries.</p>';
      return;
    }
    el.innerHTML = libs.map((l) => `<div class="fr mb2">
    <span class="f1"><strong>${escHtml(l.name)}</strong> (${l.responses.length} responses)</span>
    <button class="btn btn-s btn-d del-lib" data-id="${l.id}">Delete</button>
  </div>`).join("");
    el.querySelectorAll(".del-lib").forEach((b) => b.addEventListener("click", async () => {
      const id = b.dataset.id;
      await send({ type: "DELETE_LIBRARY", payload: { id } });
      toast("Library deleted");
      await loadLibraries();
      await loadResponses();
    }));
  }
  async function loadResponses() {
    const r = await send({ type: "GET_RESPONSES", payload: { libraryId: currentLibId } });
    if (!r?.ok)
      return;
    currentResponses = r.data;
    renderResponses(currentResponses);
  }
  function renderResponses(list) {
    const body = $("rBody");
    const noR = $("noR");
    if (!list.length) {
      body.innerHTML = "";
      noR.style.display = "block";
      return;
    }
    noR.style.display = "none";
    body.innerHTML = list.map((r) => {
      const preview = r.response.length > 60 ? r.response.slice(0, 60) + "..." : r.response;
      const kw = r.keywords.join(", ");
      return `<tr>
      <td><input type="checkbox" class="chk row-chk" data-id="${r.id}" ${selected.has(r.id) ? "checked" : ""}></td>
      <td><strong>${escHtml(r.question)}</strong><br><span class="muted">${escHtml(r.key)}</span></td>
      <td>${escHtml(preview)}</td>
      <td><span class="muted">${escHtml(kw)}</span></td>
      <td>${r.appearances}</td>
      <td>
        <button class="btn btn-s edit-r" data-id="${r.id}">Edit</button>
        <button class="btn btn-s btn-d del-r" data-id="${r.id}">Del</button>
      </td>
    </tr>`;
    }).join("");
    body.querySelectorAll(".row-chk").forEach((cb) => cb.addEventListener("change", () => {
      const id = cb.dataset.id;
      if (cb.checked)
        selected.add(id);
      else
        selected.delete(id);
      updateBulkUI();
    }));
    body.querySelectorAll(".edit-r").forEach((b) => b.addEventListener("click", () => openEditModal(b.dataset.id)));
    body.querySelectorAll(".del-r").forEach((b) => b.addEventListener("click", async () => {
      await send({ type: "DELETE_RESPONSE", payload: { id: b.dataset.id, libraryId: currentLibId } });
      toast("Deleted");
      await loadResponses();
    }));
  }
  function updateBulkUI() {
    const n = selected.size;
    $("btnBTag").disabled = n === 0;
    $("btnBDel").disabled = n === 0;
    $("selCnt").textContent = n > 0 ? `${n} selected` : "";
  }
  $("searchR").addEventListener("input", async () => {
    const q = $("searchR").value;
    const r = await send({ type: "SEARCH_RESPONSES", payload: { query: q, libraryId: currentLibId } });
    if (r?.ok)
      renderResponses(r.data);
  });
  $("libSelect").addEventListener("change", async () => {
    currentLibId = $("libSelect").value;
    await send({ type: "SET_ACTIVE_LIBRARY", payload: { id: currentLibId } });
    selected.clear();
    updateBulkUI();
    await loadResponses();
  });
  $("selAll").addEventListener("change", () => {
    const checked = $("selAll").checked;
    selected.clear();
    if (checked)
      currentResponses.forEach((r) => selected.add(r.id));
    renderResponses(currentResponses);
    updateBulkUI();
  });
  function openEditModal(id) {
    const resp = id ? currentResponses.find((r) => r.id === id) : null;
    $("rmTitle").textContent = resp ? "Edit Response" : "New Saved Response";
    $("mQ").value = resp?.question || "";
    $("mR").value = resp?.response || "";
    $("mK").value = resp?.keywords.join(", ") || "";
    $("mT").value = resp?.tags?.join(", ") || "";
    $("mId").value = resp?.id || "";
    $("respModal").classList.add("on");
  }
  $("btnAdd").addEventListener("click", () => openEditModal());
  $("mCancel").addEventListener("click", () => $("respModal").classList.remove("on"));
  $("mSave").addEventListener("click", async () => {
    const q = $("mQ").value.trim();
    const r = $("mR").value.trim();
    if (!q) {
      toast("Question is required");
      return;
    }
    const kw = $("mK").value.split(",").map((s) => s.trim()).filter(Boolean);
    const tags = $("mT").value.split(",").map((s) => s.trim()).filter(Boolean);
    const existingId = $("mId").value;
    const key = kw.join("|") || q.toLowerCase().split(/\s+/).slice(0, 3).join("|");
    const resp = {
      id: existingId || generateId(),
      key,
      keywords: kw.length ? kw : q.toLowerCase().split(/\s+/).slice(0, 5),
      question: q,
      response: r,
      appearances: existingId ? currentResponses.find((x) => x.id === existingId)?.appearances || 0 : 0,
      fromAutofill: false,
      tags: tags.length ? tags : void 0
    };
    await send({ type: "SAVE_RESPONSE", payload: { response: resp, libraryId: currentLibId } });
    $("respModal").classList.remove("on");
    toast("Saved");
    await loadResponses();
  });
  $("btnImport").addEventListener("click", () => {
    $("impTitle").textContent = "Import JSON";
    $("impPwGrp").style.display = "none";
    $("impFile").value = "";
    $("impFile").accept = ".json";
    $("impModal").classList.add("on");
  });
  $("impCancel").addEventListener("click", () => $("impModal").classList.remove("on"));
  $("impOk").addEventListener("click", async () => {
    const file = $("impFile").files?.[0];
    if (!file) {
      toast("Select a file");
      return;
    }
    const text = await file.text();
    const pw = $("impPw").value;
    try {
      if (pw) {
        const r = await send({ type: "IMPORT_ENCRYPTED", payload: { data: text, passphrase: pw, libraryId: currentLibId } });
        toast(r?.ok ? `Imported ${r.data} responses` : r?.error || "Import failed");
      } else {
        const data = JSON.parse(text);
        const arr = Array.isArray(data) ? data : [];
        const r = await send({ type: "IMPORT_RESPONSES", payload: { data: arr, libraryId: currentLibId } });
        toast(r?.ok ? `Imported ${r.data} new responses` : r?.error || "Import failed");
      }
      $("impModal").classList.remove("on");
      await loadResponses();
    } catch (e) {
      toast(`Error: ${e}`);
    }
  });
  $("btnExport").addEventListener("click", async () => {
    const r = await send({ type: "EXPORT_RESPONSES", payload: { libraryId: currentLibId } });
    if (!r?.ok)
      return;
    download(JSON.stringify(r.data, null, 2), "responses.json", "application/json");
    toast("Exported");
  });
  $("btnExportEnc").addEventListener("click", () => {
    $("encPw").value = "";
    $("encModal").classList.add("on");
  });
  $("encCancel").addEventListener("click", () => $("encModal").classList.remove("on"));
  $("encOk").addEventListener("click", async () => {
    const pw = $("encPw").value;
    if (!pw) {
      toast("Passphrase required");
      return;
    }
    const r = await send({ type: "EXPORT_ENCRYPTED", payload: { passphrase: pw, libraryId: currentLibId } });
    if (r?.ok) {
      download(r.data, "responses.encrypted.txt", "text/plain");
      toast("Exported encrypted");
    }
    $("encModal").classList.remove("on");
  });
  $("btnBTag").addEventListener("click", () => {
    $("btInput").value = "";
    $("tagModal").classList.add("on");
  });
  $("btCancel").addEventListener("click", () => $("tagModal").classList.remove("on"));
  $("btApply").addEventListener("click", async () => {
    const tags = $("btInput").value.split(",").map((s) => s.trim()).filter(Boolean);
    if (!tags.length) {
      toast("Enter tags");
      return;
    }
    await send({ type: "BULK_TAG", payload: { ids: [...selected], tags, libraryId: currentLibId } });
    $("tagModal").classList.remove("on");
    toast(`Tagged ${selected.size} entries`);
    selected.clear();
    updateBulkUI();
    await loadResponses();
  });
  $("btnBDel").addEventListener("click", async () => {
    if (!confirm(`Delete ${selected.size} entries?`))
      return;
    await send({ type: "DELETE_RESPONSES", payload: { ids: [...selected], libraryId: currentLibId } });
    toast(`Deleted ${selected.size} entries`);
    selected.clear();
    updateBulkUI();
    await loadResponses();
  });
  $("btnDups").addEventListener("click", async () => {
    const dups = findDuplicates(currentResponses, 0.75);
    const card = $("dupsCard");
    const list = $("dupsList");
    if (!dups.length) {
      card.style.display = "none";
      toast("No duplicates found");
      return;
    }
    card.style.display = "block";
    list.innerHTML = dups.slice(0, 20).map((d) => {
      const a = currentResponses.find((r) => r.id === d.idA);
      const b = currentResponses.find((r) => r.id === d.idB);
      if (!a || !b)
        return "";
      return `<div class="card" style="padding:12px;margin-bottom:8px">
      <p><strong>${escHtml(a.question)}</strong> vs <strong>${escHtml(b.question)}</strong></p>
      <p class="muted">Similarity: ${(d.similarity * 100).toFixed(0)}%</p>
      <button class="btn btn-s btn-p merge-btn" data-keep="${a.id}" data-merge="${b.id}">Merge (keep first)</button>
    </div>`;
    }).join("");
    list.querySelectorAll(".merge-btn").forEach((b) => b.addEventListener("click", async () => {
      await send({ type: "MERGE_RESPONSES", payload: { keepId: b.dataset.keep, mergeId: b.dataset.merge, libraryId: currentLibId } });
      toast("Merged");
      await loadResponses();
      $("btnDups").click();
    }));
  });
  async function loadQueue() {
    const r = await send({ type: "GET_JOB_QUEUE" });
    if (!r?.ok)
      return;
    const items = r.data;
    renderQueue(items);
  }
  var STATUS_BADGE = {
    not_started: "badge-g",
    opened: "badge-i",
    prefilled: "badge-s",
    needs_input: "badge-w",
    blocked: "badge-d",
    completed: "badge-s",
    applying: "badge-p",
    applied: "badge-s",
    failed: "badge-d",
    skipped: "badge-w",
    paused: "badge-w"
  };
  function renderQueue(items) {
    const body = $("qBody");
    const noQ = $("noQ");
    const stats = $("qStats");
    if (!items.length) {
      body.innerHTML = "";
      noQ.style.display = "block";
      stats.textContent = "";
      return;
    }
    noQ.style.display = "none";
    const applied = items.filter((i) => i.status === "applied" || i.status === "completed").length;
    const failed = items.filter((i) => i.status === "failed").length;
    stats.textContent = `${items.length} total | ${applied} applied | ${failed} failed`;
    body.innerHTML = items.map((it, idx) => {
      const urlShort = it.url.length > 40 ? it.url.slice(0, 40) + "..." : it.url;
      const src = it.source === "csv_import" ? '<span class="badge badge-i">CSV</span>' : it.source === "scraper" ? '<span class="badge badge-p">Scraper</span>' : '<span class="badge badge-g">Manual</span>';
      return `<tr>
      <td>${idx + 1}</td>
      <td><a href="${escHtml(it.url)}" target="_blank" rel="noopener">${escHtml(urlShort)}</a></td>
      <td>${escHtml(it.company || "-")}</td>
      <td>${escHtml(it.role || "-")}</td>
      <td>${src}</td>
      <td><span class="badge ${STATUS_BADGE[it.status] || "badge-g"}">${it.status.replace(/_/g, " ")}</span></td>
      <td>
        <button class="btn btn-s btn-p open-job" data-id="${it.id}" data-url="${escHtml(it.url)}">Open</button>
        <button class="btn btn-s mark-done" data-id="${it.id}">Done</button>
        <button class="btn btn-s btn-d rm-job" data-id="${it.id}">Del</button>
      </td>
    </tr>`;
    }).join("");
    body.querySelectorAll(".open-job").forEach((b) => b.addEventListener("click", async () => {
      await send({ type: "OPEN_JOB_TAB", payload: { id: b.dataset.id, url: b.dataset.url } });
      toast("Opened");
      await loadQueue();
    }));
    body.querySelectorAll(".mark-done").forEach((b) => b.addEventListener("click", async () => {
      await send({ type: "UPDATE_JOB_STATUS", payload: { id: b.dataset.id, status: "completed" } });
      toast("Marked complete");
      await loadQueue();
    }));
    body.querySelectorAll(".rm-job").forEach((b) => b.addEventListener("click", async () => {
      await send({ type: "REMOVE_JOB", payload: { id: b.dataset.id } });
      toast("Removed");
      await loadQueue();
    }));
  }
  $("btnImportCSV").addEventListener("click", () => {
    $("impTitle").textContent = "Import CSV";
    $("impPwGrp").style.display = "none";
    $("impFile").value = "";
    $("impFile").accept = ".csv,.txt";
    $("impModal").classList.add("on");
    $("impOk").onclick = async () => {
      const file = $("impFile").files?.[0];
      if (!file) {
        toast("Select a file");
        return;
      }
      const text = await file.text();
      const r = await send({ type: "IMPORT_JOB_CSV", payload: { csv: text } });
      if (r?.ok) {
        const stats = r.data;
        toast(`Added ${stats.added} jobs (${stats.totalParsed} parsed, ${stats.duplicates} duplicates, ${stats.invalidUrls} invalid)`);
      } else {
        toast(r?.error || "Failed");
      }
      $("impModal").classList.remove("on");
      await loadQueue();
      $("impOk").onclick = null;
    };
  });
  $("btnExportQ").addEventListener("click", async () => {
    const r = await send({ type: "EXPORT_JOB_RESULTS" });
    if (!r?.ok || !r.data) {
      toast("Queue is empty");
      return;
    }
    download(r.data, "job-queue.csv", "text/csv");
    toast("Exported");
  });
  $("btnRetryFailed").addEventListener("click", async () => {
    const r = await send({ type: "RETRY_FAILED_JOBS" });
    if (r?.ok) {
      toast(`Retried ${r.data} jobs`);
      await loadQueue();
    }
  });
  $("btnClearQ").addEventListener("click", async () => {
    if (!confirm("Clear entire queue?"))
      return;
    await send({ type: "CLEAR_JOB_QUEUE" });
    toast("Cleared");
    await loadQueue();
  });
  function setupCSVDropZone() {
    const dropZone = $("csvDropZone");
    const fileInput = $("csvFileInput");
    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (file)
        await handleCSVFile(file);
      fileInput.value = "";
    });
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("drag-over");
    });
    dropZone.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("drag-over");
      const files = e.dataTransfer?.files;
      if (files?.length) {
        const file = files[0];
        if (file.name.endsWith(".csv") || file.name.endsWith(".txt") || file.type === "text/csv" || file.type === "text/plain") {
          await handleCSVFile(file);
        } else {
          toast("Please drop a .csv or .txt file");
        }
      }
    });
  }
  async function handleCSVFile(file) {
    const text = await file.text();
    const r = await send({ type: "IMPORT_JOB_CSV", payload: { csv: text } });
    if (!r?.ok) {
      toast(r?.error || "Import failed");
      return;
    }
    const stats = r.data;
    $("importStatsPanel").style.display = "block";
    $("isParsed").textContent = String(stats.totalParsed);
    $("isValid").textContent = String(stats.validUrls);
    $("isInvalid").textContent = String(stats.invalidUrls);
    $("isDups").textContent = String(stats.duplicates);
    $("isAdded").textContent = String(stats.added);
    if (stats.invalidRows.length) {
      $("invalidRowsPanel").style.display = "block";
      $("invalidRowsBody").innerHTML = stats.invalidRows.map(
        (r2) => `<tr><td>${r2.row}</td><td>${escHtml(r2.url)}</td><td>${escHtml(r2.reason)}</td></tr>`
      ).join("");
    } else {
      $("invalidRowsPanel").style.display = "none";
    }
    toast(`Imported ${stats.added} jobs from CSV`);
    await loadImportedJobs();
    await loadQueue();
  }
  async function loadImportedJobs() {
    const sr = await send({ type: "GET_IMPORT_STATS" });
    if (sr?.ok) {
      const s = sr.data;
      $("impTotal").textContent = String(s.total);
      $("impPending").textContent = String(s.pending);
      $("impApplied").textContent = String(s.applied);
      $("impFailed").textContent = String(s.failed);
      $("impSkipped").textContent = String(s.skipped);
    }
    const r = await send({ type: "GET_JOB_QUEUE" });
    if (!r?.ok)
      return;
    const allItems = r.data;
    const imported = allItems.filter((i) => i.source === "csv_import");
    renderImportedJobs(imported);
  }
  function renderImportedJobs(items) {
    const body = $("impBody");
    const noImp = $("noImp");
    if (!items.length) {
      body.innerHTML = "";
      noImp.style.display = "block";
      return;
    }
    noImp.style.display = "none";
    body.innerHTML = items.map((it, idx) => {
      const urlShort = it.url.length > 40 ? it.url.slice(0, 40) + "..." : it.url;
      return `<tr>
      <td>${idx + 1}</td>
      <td><a href="${escHtml(it.url)}" target="_blank" rel="noopener">${escHtml(urlShort)}</a></td>
      <td>${escHtml(it.company || "-")}</td>
      <td>${escHtml(it.role || "-")}</td>
      <td><span class="badge ${STATUS_BADGE[it.status] || "badge-g"}">${it.status.replace(/_/g, " ")}</span></td>
      <td>
        <button class="btn btn-s btn-p open-imp" data-id="${it.id}" data-url="${escHtml(it.url)}">Open</button>
        <button class="btn btn-s btn-d rm-imp" data-id="${it.id}">Del</button>
      </td>
    </tr>`;
    }).join("");
    body.querySelectorAll(".open-imp").forEach((b) => b.addEventListener("click", async () => {
      await send({ type: "OPEN_JOB_TAB", payload: { id: b.dataset.id, url: b.dataset.url } });
      toast("Opened");
      await loadImportedJobs();
    }));
    body.querySelectorAll(".rm-imp").forEach((b) => b.addEventListener("click", async () => {
      await send({ type: "REMOVE_JOB", payload: { id: b.dataset.id } });
      toast("Removed");
      await loadImportedJobs();
    }));
  }
  $("btnStartImported").addEventListener("click", async () => {
    await send({ type: "START_AUTO_APPLY", payload: { source: "imported" } });
    $("btnStartImported").style.display = "none";
    $("btnStopImported").style.display = "";
    $("btnPauseImported").style.display = "";
    toast("Auto-apply started for imported jobs");
  });
  $("btnStopImported").addEventListener("click", async () => {
    await send({ type: "STOP_AUTO_APPLY" });
    $("btnStopImported").style.display = "none";
    $("btnPauseImported").style.display = "none";
    $("btnStartImported").style.display = "";
    toast("Auto-apply stopped");
  });
  $("btnPauseImported").addEventListener("click", async () => {
    await send({ type: "PAUSE_AUTO_APPLY" });
    toast("Auto-apply paused");
  });
  $("btnExportResults").addEventListener("click", async () => {
    const r = await send({ type: "EXPORT_JOB_RESULTS" });
    if (!r?.ok || !r.data) {
      toast("No results to export");
      return;
    }
    download(r.data, "import-results.csv", "text/csv");
    toast("Exported results");
  });
  $("btnClearImported").addEventListener("click", async () => {
    if (!confirm("Clear all imported jobs?"))
      return;
    const r = await send({ type: "GET_JOB_QUEUE" });
    if (!r?.ok)
      return;
    const imported = r.data.filter((i) => i.source === "csv_import");
    for (const job of imported) {
      await send({ type: "REMOVE_JOB", payload: { id: job.id } });
    }
    toast("Cleared imported jobs");
    await loadImportedJobs();
    await loadQueue();
  });
  async function loadSettingsUI() {
    const r = await send({ type: "GET_SETTINGS" });
    if (!r?.ok)
      return;
    const s = r.data;
    $("sAutoApplyEnabled").checked = s.autoApply.enabled;
    $("sAutoSubmit").checked = s.autoApply.autoSubmit;
    $("sAutoDetect").checked = s.autoDetectAndFill;
    $("sHumanPacing").checked = s.autoApply.humanLikePacing;
    $("sCloseTab").checked = s.autoApply.closeTabAfterApply;
    $("sRequireResume").checked = s.autoApply.requireResumeForSubmit;
    $("sMaxHour").value = String(s.autoApply.rateLimit.maxPerHour);
    $("sMaxDay").value = String(s.autoApply.rateLimit.maxPerDay);
    $("sDelay").value = String(s.autoApply.delayBetweenJobs / 1e3);
    $("sScraperEnabled").checked = s.scraper.enabled;
    $("sSourceAts").checked = s.scraper.sources.ats;
    $("sSourceIndeed").checked = s.scraper.sources.indeed;
    $("sSourceLinkedin").checked = s.scraper.sources.linkedinNonEasyApply;
    $("sTargetCount").value = String(s.scraper.targetCountPerSession);
    $("sInterval").value = String(s.scraper.intervalMinutes);
    $("hdrCredits").textContent = s.creditsUnlimited ? "Credits: Unlimited" : "Credits: Limited";
    if (s.applicationsAccount) {
      $("accountStatus").textContent = `Account saved: ${s.applicationsAccount.email}`;
      $("appEmail").value = s.applicationsAccount.email;
    }
    renderPlatformList(s.supportedPlatforms);
  }
  function renderPlatformList(platforms) {
    const platformData = [
      { id: "workday", name: "Workday", domains: ["myworkdayjobs.com", "myworkday.com"] },
      { id: "greenhouse", name: "Greenhouse", domains: ["greenhouse.io"] },
      { id: "lever", name: "Lever", domains: ["lever.co"] },
      { id: "smartrecruiters", name: "SmartRecruiters", domains: ["smartrecruiters.com"] },
      { id: "icims", name: "iCIMS", domains: ["icims.com"] },
      { id: "taleo", name: "Taleo", domains: ["taleo.net"] },
      { id: "ashby", name: "Ashby", domains: ["ashbyhq.com"] },
      { id: "bamboohr", name: "BambooHR", domains: ["bamboohr.com"] },
      { id: "oraclecloud", name: "Oracle Cloud HCM", domains: ["oraclecloud.com"] },
      { id: "linkedin", name: "LinkedIn (Non-Easy Apply)", domains: ["linkedin.com"] },
      { id: "indeed", name: "Indeed", domains: ["indeed.com"] }
    ];
    const el = $("platformList");
    el.innerHTML = platformData.map((p) => `
    <div class="platform-row">
      <label class="toggle"><input type="checkbox" class="platform-toggle" data-id="${p.id}" ${platforms[p.id] !== false ? "checked" : ""}><span class="slider"></span></label>
      <span class="platform-name">${escHtml(p.name)}</span>
      <span class="platform-domains">${p.domains.map((d) => `<code>${escHtml(d)}</code>`).join(", ")}</span>
    </div>
  `).join("");
  }
  $("btnSaveAllSettings").addEventListener("click", async () => {
    const r = await send({ type: "GET_SETTINGS" });
    if (!r?.ok)
      return;
    const s = r.data;
    s.autoApply.enabled = $("sAutoApplyEnabled").checked;
    s.autoApply.autoSubmit = $("sAutoSubmit").checked;
    s.autoDetectAndFill = $("sAutoDetect").checked;
    s.autoApply.humanLikePacing = $("sHumanPacing").checked;
    s.autoApply.closeTabAfterApply = $("sCloseTab").checked;
    s.autoApply.requireResumeForSubmit = $("sRequireResume").checked;
    s.autoApply.rateLimit.maxPerHour = parseInt($("sMaxHour").value) || 30;
    s.autoApply.rateLimit.maxPerDay = parseInt($("sMaxDay").value) || 200;
    s.autoApply.delayBetweenJobs = (parseInt($("sDelay").value) || 3) * 1e3;
    s.scraper.enabled = $("sScraperEnabled").checked;
    s.scraper.sources.ats = $("sSourceAts").checked;
    s.scraper.sources.indeed = $("sSourceIndeed").checked;
    s.scraper.sources.linkedinNonEasyApply = $("sSourceLinkedin").checked;
    s.scraper.targetCountPerSession = parseInt($("sTargetCount").value) || 50;
    s.scraper.intervalMinutes = parseInt($("sInterval").value) || 10;
    document.querySelectorAll(".platform-toggle").forEach((toggle) => {
      const id = toggle.dataset.id;
      s.supportedPlatforms[id] = toggle.checked;
    });
    s.creditsUnlimited = true;
    await send({ type: "SAVE_SETTINGS", payload: s });
    toast("Settings saved");
  });
  $("btnSaveAccount").addEventListener("click", async () => {
    const email = $("appEmail").value.trim();
    const password = $("appPassword").value;
    const passphrase = $("appPassphrase").value;
    if (!email) {
      toast("Email is required");
      return;
    }
    if (!password) {
      toast("Password is required");
      return;
    }
    if (!passphrase) {
      toast("Encryption passphrase is required");
      return;
    }
    if (passphrase.length < 8) {
      toast("Passphrase must be at least 8 characters");
      return;
    }
    await send({ type: "SAVE_APP_ACCOUNT", payload: { email, password, passphrase } });
    $("appPassword").value = "";
    $("appPassphrase").value = "";
    $("accountStatus").textContent = `Account saved: ${email}`;
    toast("Account saved (encrypted)");
  });
  $("btnClearAccount").addEventListener("click", async () => {
    if (!confirm("Clear saved account credentials?"))
      return;
    await send({ type: "CLEAR_APP_ACCOUNT" });
    $("appEmail").value = "";
    $("accountStatus").textContent = "";
    toast("Account cleared");
  });
  $("btnNewLib").addEventListener("click", async () => {
    const name = prompt("Library name:");
    if (!name)
      return;
    await send({ type: "CREATE_LIBRARY", payload: { name } });
    toast("Created");
    await loadLibraries();
  });
  async function loadDomainMappings() {
    const r = await send({ type: "GET_DOMAIN_MAPPINGS" });
    if (!r?.ok)
      return;
    const mappings = r.data;
    const libs = (await send({ type: "GET_LIBRARIES" }))?.data || [];
    const el = $("dmList");
    const entries = Object.entries(mappings);
    if (!entries.length) {
      el.innerHTML = '<p class="muted">No mappings.</p>';
      return;
    }
    el.innerHTML = entries.map(([dom, libId]) => {
      const lib = libs.find((l) => l.id === libId);
      return `<div class="fr mb2"><span class="f1"><code>${escHtml(dom)}</code> &rarr; ${escHtml(lib?.name || "Unknown")}</span><button class="btn btn-s btn-d rm-dm" data-dom="${escHtml(dom)}">Remove</button></div>`;
    }).join("");
    el.querySelectorAll(".rm-dm").forEach((b) => b.addEventListener("click", async () => {
      await send({ type: "REMOVE_DOMAIN_MAPPING", payload: { domain: b.dataset.dom } });
      toast("Removed");
      await loadDomainMappings();
    }));
  }
  $("btnAddDM").addEventListener("click", async () => {
    const dom = $("newDom").value.trim();
    const libId = $("newDomLib").value;
    if (!dom) {
      toast("Enter domain");
      return;
    }
    await send({ type: "SET_DOMAIN_MAPPING", payload: { domain: dom, libraryId: libId } });
    $("newDom").value = "";
    toast("Added");
    await loadDomainMappings();
  });
  function download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function init() {
    await loadLibraries();
    await loadResponses();
    await loadQueue();
    await loadImportedJobs();
    await loadDomainMappings();
    await loadSettingsUI();
    setupCSVDropZone();
  }
  init();
})();
//# sourceMappingURL=options.js.map
