"""Extrae el texto de los programas electorales de la raíz del proyecto a textos/.

Acepta .pdf, .docx, .txt y .md. Cada página de PDF se marca con
"=== Página N ===" para poder citar la página de cada propuesta.

Uso:  python3 scripts/extraer_texto.py
Para PDF necesita pypdf:  python3 -m pip install pypdf
"""

import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "textos"
IGNORAR = {"README.md", "CLAUDE.md"}


def pdf(path: Path) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        sys.exit("Falta pypdf. Instálalo con:  python3 -m pip install pypdf")
    reader = PdfReader(str(path))
    partes = []
    for i, page in enumerate(reader.pages, 1):
        partes.append(f"\n=== Página {i} ===\n{page.extract_text() or ''}")
    return "".join(partes)


def docx(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml").decode("utf8")
    xml = re.sub(r"</w:p>", "\n", xml)
    return re.sub(r"<[^>]+>", "", xml)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    ficheros = [
        f for f in sorted(ROOT.iterdir())
        if f.is_file() and f.suffix.lower() in {".pdf", ".docx", ".txt", ".md"} and f.name not in IGNORAR
    ]
    if not ficheros:
        print("No hay programas en la raíz del proyecto (.pdf, .docx, .txt, .md).")
        return
    for f in ficheros:
        ext = f.suffix.lower()
        texto = pdf(f) if ext == ".pdf" else docx(f) if ext == ".docx" else f.read_text("utf8")
        destino = OUT / (f.stem + ".txt")
        destino.write_text(texto, "utf8")
        print(f"✓ {f.name} → textos/{destino.name} ({len(texto):,} caracteres)")


if __name__ == "__main__":
    main()
