// Roda no MUNDO PRINCIPAL da página (mesmo contexto do app React).
// Intercepta fetch e XHR para capturar o token Bearer que o próprio site
// envia para a API, repassando-o ao content script via evento de janela.
(function () {
  "use strict";

  const TOKEN_EVENT = "estante-senai-token";

  function report(authHeader) {
    if (typeof authHeader !== "string") return;
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (m) {
      window.dispatchEvent(new CustomEvent(TOKEN_EVENT, { detail: m[1] }));
    }
  }

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      try {
        let auth;
        if (init && init.headers) {
          auth = new Headers(init.headers).get("Authorization");
        }
        if (!auth && input instanceof Request) {
          auth = input.headers.get("Authorization");
        }
        report(auth);
      } catch (_) {
        /* ignora */
      }
      return origFetch.apply(this, arguments);
    };
  }

  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try {
      if (String(name).toLowerCase() === "authorization") {
        report(value);
      }
    } catch (_) {
      /* ignora */
    }
    return origSetHeader.apply(this, arguments);
  };
})();
