# 29N · Programas electorales

Visor sencillo para comparar los programas electorales del 29N.

**Abrir:** doble clic en `web/index.html` (no necesita servidor).

**Añadir programas:** deja los PDF en esta carpeta y pide a Claude que los procese.
Claude genera `datos/partidos/*.json` y ejecuta `node scripts/build.mjs`.

Vistas:
- **Resumen** — ideas fuerza de cada partido, nivel de concreción y mapa de calor tema × partido.
- **Comparar por tema** — claves del debate (preguntas con la postura de cada uno) y propuestas alineadas por subtema.
- **Explorar** — buscador con filtros.
- **Mi brújula** — valora propuestas a ciegas y calcula tu afinidad con cada partido (se guarda solo en tu navegador).

Cada propuesta tiene cita literal con página, a quién afecta, coste, viabilidad y argumentos a favor y en contra.
