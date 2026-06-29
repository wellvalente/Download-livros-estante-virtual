const MENU_ID = "estante-senai-download";

function createMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Download livro (PDF completo)",
      contexts: ["all"],
      documentUrlPatterns: ["https://estantedelivros.senai.br/*"],
    });
  });
}

chrome.runtime.onInstalled.addListener(createMenu);
chrome.runtime.onStartup.addListener(createMenu);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  triggerDownload(tab.id);
});

chrome.action?.onClicked.addListener((tab) => {
  if (tab?.id) triggerDownload(tab.id);
});

function triggerDownload(tabId) {
  chrome.tabs.sendMessage(tabId, { action: "download-book" }, () => {
    if (chrome.runtime.lastError) {
      chrome.scripting.executeScript(
        { target: { tabId }, files: ["content.js"] },
        () => chrome.tabs.sendMessage(tabId, { action: "download-book" })
      );
    }
  });
}

// Converte ArrayBuffer -> base64 (em blocos, para arquivos grandes).
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Faz o download no contexto do service worker (sem restrição de CORS,
// graças ao host_permissions). Retorna o PDF em base64 para o content script.
async function fetchBook(url, token) {
  try {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, { headers, credentials: "include" });

    if (!response.ok) {
      let error = "";
      try {
        error = (await response.text()).slice(0, 300);
      } catch (_) {
        /* sem corpo */
      }
      return { ok: false, status: response.status, error };
    }

    const contentType = response.headers.get("Content-Type") || "";
    const buffer = await response.arrayBuffer();
    const head = new Uint8Array(buffer.slice(0, 5));
    const isPdf =
      String.fromCharCode(head[0], head[1], head[2], head[3]) === "%PDF" ||
      contentType.toLowerCase().includes("pdf");

    return {
      ok: true,
      status: response.status,
      size: buffer.byteLength,
      contentType,
      isPdf,
      base64: bufferToBase64(buffer),
    };
  } catch (err) {
    return { ok: false, status: 0, error: String(err?.message || err) };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === "fetch-book") {
    fetchBook(message.url, message.token).then(sendResponse);
    return true; // resposta assíncrona
  }
  return false;
});
