/**
 * Cole no Console do DevTools (F12) em estantedelivros.senai.br
 * com um livro aberto. Copia o token e o driveId para uso no script Python.
 */
(function () {
  const driveId = location.pathname.match(/\/view\/([^/]+)/)?.[1];
  let token = null;

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const v = localStorage.getItem(k);
    if (!v) continue;
    try {
      const data = JSON.parse(v);
      if (data?.access_token) token = data.access_token;
      if (data?.id_token && !token) token = data.id_token;
    } catch (_) {}
  }

  if (!token) {
    console.warn("Token não encontrado no localStorage. Abra Network e filtre por 'download'.");
  }

  const url = driveId
    ? `https://api.recursosdidaticos.senai.br/api/estante/livros/${driveId}/download`
    : null;

  console.log("driveId:", driveId);
  console.log("download URL:", url);
  console.log("token (primeiros 40 chars):", token?.slice(0, 40) + "...");

  if (token && driveId) {
  console.log(
    "\nComando Python:\n" +
      `python download_livro.py --drive-id ${driveId} --token "${token}"`
  );
  }
})();
