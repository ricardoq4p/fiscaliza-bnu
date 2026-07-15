"""Sincroniza a lista pública de obras do EngeGOV com o site.

Uso: python scripts/sync_obras.py
"""

from __future__ import annotations

import json
import re
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.cookiejar import CookieJar
from pathlib import Path

import xlrd
from lxml import html


PORTAL_URL = "https://engegov.blumenau.sc.gov.br/portal-engegov/dashboard.xhtml?cidade=4898"
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "obras.json"


def texto(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def chave(value: object) -> str:
    normalized = unicodedata.normalize("NFD", texto(value))
    return re.sub(r"[^a-z0-9]+", "_", "".join(c for c in normalized if not unicodedata.combining(c)).lower()).strip("_")


def baixar_planilha() -> bytes:
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
    with opener.open(PORTAL_URL, timeout=45) as response:
        page = response.read()

    document = html.fromstring(page)
    form = document.get_element_by_id("frmListaObras")
    view_state = form.xpath('.//input[@name="javax.faces.ViewState"]/@value')[0]
    export_button = form.xpath('.//button[contains(normalize-space(.), ".xls")]/@name')[0]
    action = urllib.parse.urljoin(PORTAL_URL, form.attrib["action"])
    payload = urllib.parse.urlencode({
        "frmListaObras": "frmListaObras",
        export_button: export_button,
        "javax.faces.ViewState": view_state,
    }).encode()

    request = urllib.request.Request(action, data=payload, method="POST")
    with opener.open(request, timeout=90) as response:
        if "application/vnd.ms-excel" not in response.headers.get("Content-Type", ""):
            raise RuntimeError("O portal não retornou a planilha XLS esperada.")
        return response.read()


def converter(planilha: bytes) -> list[dict[str, str]]:
    sheet = xlrd.open_workbook(file_contents=planilha).sheet_by_index(0)
    headers = [chave(sheet.cell_value(0, column)) for column in range(sheet.ncols)]
    obras = []
    for row_index in range(1, sheet.nrows):
        row = {headers[column]: texto(sheet.cell_value(row_index, column)) for column in range(sheet.ncols)}
        if any(row.values()):
            obras.append(row)
    return obras


def main() -> None:
    obras = converter(baixar_planilha())
    payload = {
        "fonte": PORTAL_URL,
        "sincronizadoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "total": len(obras),
        "obras": obras,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(obras)} obras salvas em {OUTPUT}")
    if obras:
        print("Campos:", ", ".join(obras[0]))


if __name__ == "__main__":
    main()
