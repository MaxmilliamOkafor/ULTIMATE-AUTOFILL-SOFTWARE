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
    renderResponses(checked ? currentResponses : currentResponses);
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
    completed: "badge-s"
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
    stats.textContent = `${items.length} total | ${items.filter((i) => i.status === "completed").length} completed`;
    body.innerHTML = items.map((it, idx) => {
      const urlShort = it.url.length > 50 ? it.url.slice(0, 50) + "..." : it.url;
      return `<tr>
      <td>${idx + 1}</td>
      <td><a href="${escHtml(it.url)}" target="_blank" rel="noopener">${escHtml(urlShort)}</a></td>
      <td>${escHtml(it.company || "-")}</td>
      <td>${escHtml(it.role || "-")}</td>
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
      await send({ type: "UPDATE_JOB_STATUS", payload: { id: b.dataset.id, status: "completed" } });
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
      toast(r?.ok ? `Added ${r.data.added} jobs (${r.data.parsed} parsed)` : r?.error || "Failed");
      $("impModal").classList.remove("on");
      await loadQueue();
      $("impOk").onclick = null;
    };
  });
  $("btnExportQ").addEventListener("click", async () => {
    const items = (await send({ type: "GET_JOB_QUEUE" }))?.data;
    if (!items?.length) {
      toast("Queue is empty");
      return;
    }
    const header = "url,company,role,priority,notes,status";
    const rows = items.map(
      (i) => [i.url, i.company || "", i.role || "", i.priority ?? "", i.notes || "", i.status].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );
    download([header, ...rows].join("\n"), "job-queue.csv", "text/csv");
    toast("Exported");
  });
  $("btnClearQ").addEventListener("click", async () => {
    if (!confirm("Clear entire queue?"))
      return;
    await send({ type: "CLEAR_JOB_QUEUE" });
    toast("Cleared");
    await loadQueue();
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
    await loadDomainMappings();
  }
  init();
})();
//# sourceMappingURL=options.js.map
