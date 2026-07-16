"""Sincroniza a lista pública de obras do EngeGOV com o site.

Uso: python scripts/sync_obras.py
"""

from __future__ import annotations

import json
import os
import re
import ssl
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


def criar_opener() -> urllib.request.OpenerDirector:
    handlers: list[object] = [urllib.request.HTTPCookieProcessor(CookieJar())]
    if os.environ.get("ENGEGOV_INSECURE_SSL") == "1":
        contexto = ssl.create_default_context()
        contexto.check_hostname = False
        contexto.verify_mode = ssl.CERT_NONE
        handlers.append(urllib.request.HTTPSHandler(context=contexto))
        print("AVISO: validação SSL desativada somente para esta sincronização do EngeGOV.")
    return urllib.request.build_opener(*handlers)


def texto(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def chave(value: object) -> str:
    normalized = unicodedata.normalize("NFD", texto(value))
    return re.sub(r"[^a-z0-9]+", "_", "".join(c for c in normalized if not unicodedata.combining(c)).lower()).strip("_")


def baixar_planilha() -> bytes:
    opener = criar_opener()
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


def baixar_coordenadas() -> dict[str, tuple[float, float]]:
    """Lê, em uma única resposta Ajax, os marcadores do mapa público."""
    opener = criar_opener()
    with opener.open(PORTAL_URL, timeout=45) as response:
        page = response.read()

    document = html.fromstring(page)
    form = document.get_element_by_id("frmObrasGeorreferenciadas")
    view_state = form.xpath('.//input[@name="javax.faces.ViewState"]/@value')[0]
    button = form.xpath('.//button/@name')[0]
    action = urllib.parse.urljoin(PORTAL_URL, form.attrib["action"])
    payload = urllib.parse.urlencode({
        "frmObrasGeorreferenciadas": "frmObrasGeorreferenciadas",
        button: button,
        "javax.faces.ViewState": view_state,
    }).encode()
    with opener.open(urllib.request.Request(action, data=payload, method="POST"), timeout=60) as response:
        map_page = response.read()

    map_document = html.fromstring(map_page)
    map_view_state = map_document.xpath('//input[@name="javax.faces.ViewState"]/@value')[0]
    ajax_payload = urllib.parse.urlencode({
        "javax.faces.partial.ajax": "true",
        "javax.faces.source": "frmMapaObras:console",
        "javax.faces.partial.execute": "frmMapaObras:console",
        "javax.faces.partial.render": "frmMapaObras:gmapObras frmMapaObras:pnlNumObrasMapa",
        "javax.faces.behavior.event": "change",
        "javax.faces.partial.event": "change",
        "frmMapaObras": "frmMapaObras",
        "frmMapaObras:console": "4",
        "javax.faces.ViewState": map_view_state,
    }).encode()
    ajax_request = urllib.request.Request(action, data=ajax_payload, method="POST", headers={
        "Faces-Request": "partial/ajax",
        "X-Requested-With": "XMLHttpRequest",
    })
    with opener.open(ajax_request, timeout=90) as response:
        source = response.read().decode("utf-8")

    marker_pattern = re.compile(
        r"new google\.maps\.Marker\(\{position:new google\.maps\.LatLng\(([-\d.]+),\s*([-\d.]+)\),"
        r"id:'[^']+',title:\"((?:\\.|[^\"])*)\",icon:"
    )
    coordinates = {}
    for latitude, longitude, raw_title in marker_pattern.findall(source):
        title = json.loads(f'"{raw_title}"')
        coordinates[normalizar(title)] = (float(latitude), float(longitude))
    return coordinates


def normalizar(value: object) -> str:
    normalized = unicodedata.normalize("NFD", texto(value))
    return "".join(character for character in normalized if not unicodedata.combining(character)).casefold()


def converter(planilha: bytes, coordenadas: dict[str, tuple[float, float]]) -> list[dict[str, object]]:
    sheet = xlrd.open_workbook(file_contents=planilha).sheet_by_index(0)
    headers = [chave(sheet.cell_value(0, column)) for column in range(sheet.ncols)]
    obras = []
    for row_index in range(1, sheet.nrows):
        row = {headers[column]: texto(sheet.cell_value(row_index, column)) for column in range(sheet.ncols)}
        if re.fullmatch(r"(?:\d+|C\d+)", row.get("codigo", ""), re.I):
            coordinate = coordenadas.get(normalizar(row.get("descricao")))
            if coordinate:
                row["latitude"], row["longitude"] = coordinate
            obras.append(row)
    return obras


def main() -> None:
    coordenadas = baixar_coordenadas()
    obras = converter(baixar_planilha(), coordenadas)
    payload = {
        "fonte": PORTAL_URL,
        "sincronizadoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "total": len(obras),
        "obras": obras,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(obras)} obras salvas em {OUTPUT}")
    print(f"{sum('latitude' in obra for obra in obras)} obras com coordenadas oficiais")
    if obras:
        print("Campos:", ", ".join(obras[0]))


if __name__ == "__main__":
    main()

