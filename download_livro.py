"""
Baixa o PDF completo de um livro da Estante de Livros SENAI.

Como o visualizador web funciona:
- A plataforma usa PDF.js (react-pdf) em estantedelivros.senai.br
- O PDF inteiro é baixado via API, mas só as páginas visíveis são renderizadas no DOM
- Por isso "Imprimir / Salvar como PDF" do navegador captura só parte do livro

Solução: chamar diretamente o endpoint de download da API (mesmo que o app usa).

Uso:
  python download_livro.py --drive-id SEU_DRIVE_ID
  python download_livro.py --url "https://estantedelivros.senai.br/view/ABC123"
  python download_livro.py --drive-id ABC123 --token "eyJhbG..."
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import requests

API_BASE = "https://api.recursosdidaticos.senai.br/api"
SITE = "https://estantedelivros.senai.br"


def extract_drive_id(value: str) -> str:
    """Extrai driveId de URL ou retorna o valor direto."""
    value = value.strip()
    m = re.search(r"/view/([^/?#]+)", value)
    if m:
        return m.group(1)
    return value


def download_with_token(drive_id: str, token: str, output: Path) -> Path:
    url = f"{API_BASE}/estante/livros/{drive_id}/download"
    headers = {"Authorization": f"Bearer {token}"}

    with requests.get(url, headers=headers, stream=True, timeout=120) as resp:
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "")
        if "pdf" not in content_type.lower() and not resp.content[:5].startswith(b"%PDF-"):
            preview = resp.text[:300] if resp.text else str(resp.content[:200])
            raise RuntimeError(
                f"Resposta não parece ser PDF (Content-Type: {content_type}).\n{preview}"
            )
        with open(output, "wb") as f:
            for chunk in resp.iter_content(chunk_size=65536):
                if chunk:
                    f.write(chunk)

    size_mb = output.stat().st_size / (1024 * 1024)
    print(f"Salvo: {output} ({size_mb:.2f} MB)")
    return output


def download_with_playwright(drive_id: str, output: Path, headless: bool) -> Path:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise SystemExit(
            "Playwright não instalado. Execute:\n"
            "  pip install -r requirements.txt\n"
            "  playwright install chromium"
        ) from exc

    captured: dict[str, str] = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context()
        page = context.new_page()

        def on_request(request):
            if "/download" in request.url and drive_id in request.url:
                auth = request.headers.get("authorization", "")
                if auth.startswith("Bearer "):
                    captured["token"] = auth[7:]

        page.on("request", on_request)

        print(f"Abrindo {SITE} — faça login se necessário.")
        page.goto(SITE, wait_until="domcontentloaded")

        if not headless:
            print("Após logar, pressione ENTER no terminal para continuar...")
            input()

        book_url = f"{SITE}/view/{drive_id}"
        print(f"Abrindo livro: {book_url}")
        page.goto(book_url, wait_until="networkidle", timeout=120_000)

        # Aguarda requisição de download com token
        for _ in range(30):
            if "token" in captured:
                break
            page.wait_for_timeout(1000)

        if "token" not in captured:
            # Tenta extrair token do localStorage (Asgardeo OIDC)
            storage = page.evaluate(
                """() => {
                    const out = {};
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        const v = localStorage.getItem(k);
                        if (k && v && (k.includes('oidc') || k.includes('token') || k.includes('asgardeo'))) {
                            out[k] = v;
                        }
                    }
                    return out;
                }"""
            )
            for key, raw in storage.items():
                try:
                    data = json.loads(raw)
                    for field in ("access_token", "id_token"):
                        if isinstance(data, dict) and field in data:
                            captured["token"] = data[field]
                            print(f"Token obtido de localStorage ({key})")
                            break
                except json.JSONDecodeError:
                    continue

        browser.close()

    if "token" not in captured:
        raise RuntimeError(
            "Não foi possível capturar o token de autenticação.\n"
            "Tente: DevTools > Network > filtre 'download' > copie o header Authorization\n"
            "e use: python download_livro.py --drive-id ID --token SEU_TOKEN"
        )

    return download_with_token(drive_id, captured["token"], output)


def main() -> int:
    parser = argparse.ArgumentParser(description="Baixa PDF completo da Estante SENAI")
    parser.add_argument("--drive-id", help="ID do livro (driveId)")
    parser.add_argument("--url", help="URL do livro (ex: .../view/ABC)")
    parser.add_argument("--token", help="Bearer token JWT (opcional, evita login automático)")
    parser.add_argument("-o", "--output", help="Arquivo de saída .pdf")
    parser.add_argument("--headless", action="store_true", help="Browser sem interface (só com --token)")
    args = parser.parse_args()

    drive_id = args.drive_id or (extract_drive_id(args.url) if args.url else None)
    if not drive_id:
        parser.error("Informe --drive-id ou --url")

    output = Path(args.output or f"livro_{drive_id}.pdf")

    if args.token:
        download_with_token(drive_id, args.token, output)
    else:
        download_with_playwright(drive_id, output, headless=args.headless)

    return 0


if __name__ == "__main__":
    sys.exit(main())
