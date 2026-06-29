(function () {
  "use strict";

  const API_BASE = "https://api.recursosdidaticos.senai.br/api";
  const BTN_ID = "estante-senai-download-btn";
  const TOAST_ID = "estante-senai-toast";
  const DEBUG_ID = "estante-senai-debug";

  // ----- Painel de debug -----
  function getDebugPanel() {
    let panel = document.getElementById(DEBUG_ID);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = DEBUG_ID;
      panel.innerHTML = `
        <div class="estante-senai-debug__hdr">
          <span class="estante-senai-debug__title">Debug — Download Livro</span>
          <div class="estante-senai-debug__actions">
            <button type="button" class="estante-senai-debug__btn" data-act="clear">limpar</button>
            <button type="button" class="estante-senai-debug__btn" data-act="copy">copiar</button>
            <button type="button" class="estante-senai-debug__btn" data-act="close">×</button>
          </div>
        </div>
        <div class="estante-senai-debug__log"></div>`;
      document.body.appendChild(panel);
      panel.querySelector('[data-act="close"]').addEventListener("click", () => {
        panel.hidden = true;
      });
      panel.querySelector('[data-act="clear"]').addEventListener("click", () => {
        panel.querySelector(".estante-senai-debug__log").innerHTML = "";
      });
      panel.querySelector('[data-act="copy"]').addEventListener("click", () => {
        const text = panel.querySelector(".estante-senai-debug__log").innerText;
        navigator.clipboard?.writeText(text);
      });
    }
    return panel;
  }

  function dbg(message, type = "info") {
    const panel = getDebugPanel();
    panel.hidden = false;
    const log = panel.querySelector(".estante-senai-debug__log");
    const line = document.createElement("div");
    line.className = `estante-senai-debug__line estante-senai-debug__line--${type}`;
    const t = new Date().toLocaleTimeString("pt-BR", { hour12: false });
    line.textContent = `[${t}] ${message}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
    console.log(`[Estante SENAI] ${message}`);
  }

  function getDriveId() {
    const m = location.pathname.match(/\/view\/([^/?#]+)/);
    return m ? m[1] : null;
  }

  // Token capturado das requisições do próprio site (via inject.js).
  let capturedToken = null;
  window.addEventListener("estante-senai-token", (event) => {
    if (event?.detail) capturedToken = event.detail;
  });

  function findTokenInStorage(storage) {
    if (!storage) return null;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      const raw = storage.getItem(key);
      if (!raw) continue;
      try {
        const data = JSON.parse(raw);
        if (data?.access_token) return data.access_token;
        if (data?.id_token) return data.id_token;
      } catch (_) {
        // Valor pode ser o próprio JWT em texto puro (3 segmentos base64).
        if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(raw)) return raw;
      }
    }
    return null;
  }

  function getAuthToken() {
    return (
      capturedToken ||
      findTokenInStorage(window.localStorage) ||
      findTokenInStorage(window.sessionStorage)
    );
  }

  function sanitizeFilename(name) {
    return name
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
  }

  function guessBookTitle() {
    const h1 = document.querySelector("h1");
    if (h1?.textContent?.trim()) return sanitizeFilename(h1.textContent.trim());
    const title = document.title.replace(/\s*[-|].*estante.*/i, "").trim();
    if (title) return sanitizeFilename(title);
    return null;
  }

  function showToast(message, type = "info") {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      document.body.appendChild(toast);
    }
    toast.className = `estante-senai-toast estante-senai-toast--${type}`;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.hidden = true;
    }, 5000);
  }

  function setButtonState(btn, state) {
    if (!btn) return;
    btn.disabled = state === "loading";
    btn.classList.toggle("estante-senai-btn--loading", state === "loading");
    const label = btn.querySelector(".estante-senai-btn__label");
    if (label) {
      label.textContent =
        state === "loading" ? "Baixando..." : "Download livro";
    }
  }

  function base64ToBlob(base64, type) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: type || "application/pdf" });
  }

  let isDownloading = false;

  async function downloadBook(btn) {
    if (isDownloading) {
      dbg("Já existe um download em andamento. Ignorando clique.", "warn");
      return;
    }

    dbg("===== Clique em DOWNLOAD detectado =====");
    dbg(`URL da página: ${location.href}`);

    const driveId = getDriveId();
    if (!driveId) {
      dbg("driveId NÃO encontrado — você não está numa página /view/.", "error");
      showToast("Abra um livro para baixar (página /view/...).", "error");
      return;
    }
    dbg(`driveId detectado: ${driveId}`, "success");

    const token = getAuthToken();
    if (token) {
      dbg(`Token capturado (${token.length} caracteres).`, "success");
    } else {
      dbg("Token NÃO capturado. Tentando mesmo assim (cookies de sessão).", "warn");
    }

    const apiUrl = `${API_BASE}/estante/livros/${driveId}/download`;
    dbg(`Endpoint: ${apiUrl}`);

    isDownloading = true;
    setButtonState(btn, "loading");

    try {
      dbg("Enviando requisição ao service worker (background)...");
      let response;
      try {
        response = await chrome.runtime.sendMessage({
          action: "fetch-book",
          url: apiUrl,
          token: token || null,
        });
      } catch (msgErr) {
        throw new Error(
          `Falha na comunicação com o background: ${msgErr.message}. ` +
            "Recarregue a extensão em chrome://extensions/."
        );
      }

      if (!response) {
        throw new Error(
          "Sem resposta do background. Verifique o console do service worker " +
            "em chrome://extensions/ > Detalhes > service worker."
        );
      }

      dbg(`Resposta do background: ok=${response.ok}, status=${response.status}`);

      if (!response.ok) {
        if (response.error) dbg(`Detalhe do erro: ${response.error}`, "error");
        if (response.status === 401 || response.status === 403) {
          throw new Error("Acesso negado (sessão/token). Recarregue a página e tente de novo.");
        }
        if (response.status === 0) {
          throw new Error(`Erro de rede no background: ${response.error || "desconhecido"}`);
        }
        throw new Error(`Erro HTTP ${response.status} ao baixar o livro.`);
      }

      const sizeMb = (response.size / (1024 * 1024)).toFixed(2);
      dbg(`PDF recebido: ${sizeMb} MB (Content-Type: ${response.contentType || "?"}).`, "success");

      if (!response.isPdf) {
        dbg("ATENÇÃO: os primeiros bytes não são '%PDF'. Conteúdo pode estar incorreto.", "warn");
      }

      dbg("Reconstruindo o arquivo e iniciando o download...");
      const blob = base64ToBlob(response.base64, response.contentType);

      const title = guessBookTitle();
      const filename = title ? `${title}.pdf` : `livro_${driveId}.pdf`;
      dbg(`Nome do arquivo: ${filename}`);

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      dbg(`Download iniciado com sucesso: ${filename} (${sizeMb} MB).`, "success");
      showToast(`Download iniciado: ${filename} (${sizeMb} MB)`, "success");
    } catch (err) {
      dbg(`ERRO: ${err.message}`, "error");
      showToast(err.message || "Falha ao baixar o livro.", "error");
      console.error("[Estante SENAI Download]", err);
    } finally {
      isDownloading = false;
      setButtonState(btn, "idle");
    }
  }

  function createButton() {
    if (document.getElementById(BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.className = "estante-senai-btn";
    btn.title = "Baixar PDF completo do livro";
    btn.innerHTML = `
      <span class="estante-senai-btn__icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </span>
      <span class="estante-senai-btn__label">Download livro</span>
    `;
    btn.addEventListener("click", () => downloadBook(btn));
    document.body.appendChild(btn);
  }

  function removeButton() {
    document.getElementById(BTN_ID)?.remove();
    document.getElementById(TOAST_ID)?.remove();
  }

  function updateUI() {
    if (getDriveId()) {
      createButton();
    } else {
      removeButton();
    }
  }

  function watchRouteChanges() {
    const pushState = history.pushState;
    const replaceState = history.replaceState;

    history.pushState = function (...args) {
      pushState.apply(this, args);
      updateUI();
    };
    history.replaceState = function (...args) {
      replaceState.apply(this, args);
      updateUI();
    };
    window.addEventListener("popstate", updateUI);
  }

  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.action === "download-book") {
        downloadBook(document.getElementById(BTN_ID));
        sendResponse?.({ ok: true });
      }
      return true;
    });
  }

  watchRouteChanges();
  updateUI();
})();
