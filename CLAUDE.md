# 29N · Visor de programas electorales

Web estática (sin BBDD ni dependencias) para comparar los programas electorales de las elecciones del 29N.
El usuario deja los programas (PDF, DOCX, TXT, MD) en la raíz del proyecto; Claude los lee y los convierte en datos estructurados.

## Estructura

- `datos/temas.json` — catálogo de temas y subtemas (común a todos los partidos). Se puede ampliar si los programas lo piden.
- `datos/partidos/<id>.json` — un fichero por partido (lo genera Claude a partir del programa).
- `datos/comparativas.json` — por tema: resumen neutral de las diferencias + "ejes" (preguntas clave con la postura de cada partido).
- `datos/_demo/` — datos ficticios. Solo se usan si `datos/partidos/` está vacío.
- `scripts/extraer_texto.py` — vuelca el texto de los programas a `textos/` con marcas `=== Página N ===`.
- `scripts/build.mjs` — valida y junta todo en `web/datos.js`. **Ejecutar siempre tras tocar `datos/`.**
- `web/` — la app (`index.html`, `app.js`, `styles.css`). Se abre con doble clic en `web/index.html`.

## Cómo procesar un programa nuevo

1. `python3 scripts/extraer_texto.py` (si falta pypdf: `python3 -m pip install pypdf`). Alternativa: leer el PDF directamente con Read por rangos de páginas.
2. Leer el texto completo y crear `datos/partidos/<id>.json` con este esquema:

```json
{
  "id": "abc", "nombre": "Nombre oficial", "siglas": "ABC", "color": "#hex",
  "fuente": "nombre-del-fichero.pdf",
  "resumen": "2-3 frases neutrales sobre su enfoque general",
  "ideas_fuerza": ["3-5 prioridades que el propio programa destaca"],
  "propuestas": [{
    "id": "abc-001", "tema": "vivienda", "subtema": "alquiler",
    "titulo": "Frase corta y descriptiva (qué hace, no el eslogan)",
    "resumen": "Qué propone exactamente, en lenguaje llano",
    "cita": "Texto literal del programa", "pagina": 14,
    "concrecion": "alta | media | baja",
    "cifra": "opcional: compromiso cuantificado (importe, plazo, número)",
    "tipo": "nueva | ampliacion | reforma | recorte | derogacion",
    "implicaciones": {
      "afecta_a": "A quién beneficia / perjudica",
      "coste": "Coste estimado y si el programa dice cómo financiarlo",
      "viabilidad": "Competencias (¿puede hacerlo este nivel de gobierno?), plazos, obstáculos",
      "a_favor": ["argumentos que dan sus defensores / evidencia favorable"],
      "en_contra": ["críticas habituales / riesgos / evidencia contraria"]
    }
  }]
}
```

3. Actualizar `datos/comparativas.json` con los temas donde haya contraste (`postura`: `si | no | matiz | sin`).
4. `node scripts/build.mjs` y revisar avisos.

## Criterios editoriales (importante)

- **Neutralidad estricta.** El objetivo es ayudar a decidir, no recomendar. Mismo nivel de exigencia y el mismo número aproximado de argumentos a favor y en contra para todos los partidos.
- **Fidelidad.** Cada propuesta lleva cita literal y página (número de página del PDF, no el impreso; `textos/*.txt` lo marca con `=== Página N ===`). No inventar cifras: si el programa no cuantifica, decirlo ("no cuantificado").
- **Concreción**: `alta` = cifras, plazos o mecanismo concreto; `media` = qué hará pero sin cuánto/cuándo; `baja` = declaración de intenciones.
- **Granularidad**: una propuesta = una medida evaluable. Agrupar frases retóricas repetidas; ignorar diagnósticos sin medida.
- **Viabilidad**: señalar cuando una medida depende de otro nivel de gobierno (estatal, europeo, municipal) que el que se elige.
- Los temas y subtemas deben ser los mismos para todos los partidos, para que se puedan alinear en "Comparar por tema".
