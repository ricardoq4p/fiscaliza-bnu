"""Sincroniza, de forma incremental e moderada, contratos e prazos do EngeGOV.

Uso recomendado:
  python scripts/sync_detalhes.py --limit 20
  python scripts/sync_detalhes.py --all
"""

from __future__ import annotations

import argparse
import json
import re
import ssl
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.cookiejar import CookieJar
from pathlib import Path

from lxml import html


ROOT = Path(__file__).resolve().parents[1]
LISTA = ROOT / "data" / "obras.json"
OUTPUT = ROOT / "data" / "detalhes-obras.json"
PORTAL = "https://engegov.blumenau.sc.gov.br/portal-engegov/dashboard.xhtml?cidade=4898"


def limpar(fragmento: bytes) -> str:
    documento = html.fromstring(fragmento)
    return re.sub(r"\s+", " ", documento.text_content()).strip()


def entre(texto: str, inicio: str, fim: str) -> str | None:
    resultado = re.search(rf"{inicio}\s*(.*?)\s*{fim}", texto, re.I)
    return resultado.group(1).strip() if resultado else None


def dinheiro(texto: str, rotulo: str) -> str | None:
    resultado = re.search(rf"{rotulo}\s*R\$\s*([\d.,]+)", texto, re.I)
    return resultado.group(1) if resultado else None


def analisar(resposta: bytes, codigo: str) -> dict[str, object]:
    fonte = resposta.decode("utf-8", errors="replace")
    texto = limpar(resposta)
    knob = re.search(r'class="knob"[^>]*value="([\d,.]+)"|value="([\d,.]+)"[^>]*class="knob"', fonte)
    return {
        "codigo": codigo,
        "percentualExecutado": next((item for item in (knob.groups() if knob else ()) if item), None),
        "valorContratado": dinheiro(texto, "Valor Total Contratado"),
        "valorExecutado": dinheiro(texto, r"Valor Executado \(Medido\)"),
        "saldoContrato": dinheiro(texto, "Saldo do Contrato"),
        "dataContrato": entre(texto, "Data do Contrato:", r"N[º°]? Ordem de Serviço:"),
        "inicioObra": entre(texto, "Início da obra:", "Data Limite Execução:"),
        "dataLimiteExecucao": entre(texto, "Data Limite Execução:", "Término Contrato:"),
        "terminoContrato": entre(texto, "Término Contrato:", "Tipo de Recurso:"),
        "consultadoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=20, help="Quantidade máxima nesta execução")
    parser.add_argument("--all", action="store_true", help="Sincroniza todas as obras ainda pendentes")
    parser.add_argument("--delay", type=float, default=0.8, help="Intervalo entre requisições")
    args = parser.parse_args()

    lista = json.loads(LISTA.read_text(encoding="utf-8"))["obras"]
    atual = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {"obras": {}}
    detalhes = atual.get("obras", {})
    pendentes = [obra for obra in lista if obra.get("codigo") and obra["codigo"] not in detalhes]
    if not args.all:
        pendentes = pendentes[:max(args.limit, 0)]
    if not pendentes:
        print("Nenhuma obra pendente para esta execução.")
        return

    contexto = ssl.create_default_context()
    contexto.check_hostname = False
    contexto.verify_mode = ssl.CERT_NONE
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()), urllib.request.HTTPSHandler(context=contexto))
    pagina = opener.open(PORTAL, timeout=45).read()
    documento = html.fromstring(pagina)
    formulario = documento.get_element_by_id("frmListaObras")
    view_state = formulario.xpath('.//input[@name="javax.faces.ViewState"]/@value')[0]
    destino = urllib.parse.urljoin(PORTAL, formulario.attrib["action"])

    for indice, obra in enumerate(pendentes, 1):
        codigo = obra["codigo"]
        payload = urllib.parse.urlencode({
            "javax.faces.partial.ajax": "true",
            "javax.faces.source": "frmListaObras:tblListaObras",
            "javax.faces.partial.execute": "frmListaObras:tblListaObras",
            "javax.faces.partial.render": "frmAndamentoObra frmDadosContratoObra frmDadosMedicoesObra frmInfObraEmRevisao",
            "javax.faces.behavior.event": "rowSelect",
            "javax.faces.partial.event": "rowSelect",
            "frmListaObras": "frmListaObras",
            "frmListaObras:tblListaObras_selection": codigo,
            "javax.faces.ViewState": view_state,
        }).encode()
        requisicao = urllib.request.Request(destino, data=payload, headers={"Faces-Request": "partial/ajax", "X-Requested-With": "XMLHttpRequest", "User-Agent": "FiscalizaBNU/1.0"})
        try:
            detalhes[codigo] = analisar(opener.open(requisicao, timeout=60).read(), codigo)
            print(f"[{indice}/{len(pendentes)}] obra {codigo}")
        except Exception as erro:
            print(f"[{indice}/{len(pendentes)}] falha na obra {codigo}: {erro}")
        atual = {"sincronizadoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"), "total": len(detalhes), "obras": detalhes}
        OUTPUT.write_text(json.dumps(atual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if indice < len(pendentes):
            time.sleep(max(args.delay, 0.5))


if __name__ == "__main__":
    main()
