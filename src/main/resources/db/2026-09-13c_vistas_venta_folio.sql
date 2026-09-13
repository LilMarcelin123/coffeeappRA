-- ═══════════════════════════════════════════════════════════════
-- Vistas de venta unificada — Modulo de Gestion
-- Fecha: 2026-09-13 (se agrega n_folio_dia)
--
-- El problema que resuelven:
--   Una venta vive en dos lugares segun la hora del dia. Mientras el
--   dia esta abierto esta en `orden`; despues del cierre pasa a
--   `hist_orden`. Si el modulo consultara solo el archivo, el panel
--   diria que hoy no se ha vendido nada hasta la 1 am.
--
--   Estas vistas juntan los dos lados y calculan el dia de negocio
--   (de 01:00 a 01:00) en un solo lugar. TODA consulta del modulo
--   debe salir de aqui, no de las tablas directamente.
--
-- Ojo con `origen`:
--   VIVO    = aun no archivada, puede cambiar si reabren la orden
--   ARCHIVO = ya cerrada en firme
--
-- Nota sobre COLLATE:
--   Las tablas historicas y las vivas se crearon con cotejamientos
--   distintos (utf8mb4_0900_ai_ci contra utf8mb4_unicode_ci) y MySQL
--   se niega a unir texto de dos cotejamientos. Por eso cada columna
--   de texto lo lleva explicito en ambos lados del UNION.
-- ═══════════════════════════════════════════════════════════════


-- ── Ventas (nivel orden) ────────────────────────────────────────
CREATE OR REPLACE VIEW v_venta_orden AS
SELECT
    ho.id_orden,
    ho.n_folio_dia,
    ho.t_hora_creacion,
    DATE(ho.t_hora_creacion - INTERVAL 1 HOUR)            AS d_dia_negocio,
    HOUR(ho.t_hora_creacion)                              AS n_hora,
    ho.p_total,
    ho.id_tipo_pago,
    ho.n_tipo_pago      COLLATE utf8mb4_unicode_ci        AS n_tipo_pago,
    ho.source           COLLATE utf8mb4_unicode_ci        AS source,
    ho.n_tipo_consumo   COLLATE utf8mb4_unicode_ci        AS n_tipo_consumo,
    ho.n_nombre_cliente COLLATE utf8mb4_unicode_ci        AS n_nombre_cliente,
    ho.id_cierre,
    'ARCHIVO'           COLLATE utf8mb4_unicode_ci        AS origen
FROM hist_orden ho

UNION ALL

SELECT
    o.id_orden,
    o.n_folio_dia,
    o.t_hora_creacion,
    DATE(o.t_hora_creacion - INTERVAL 1 HOUR)             AS d_dia_negocio,
    HOUR(o.t_hora_creacion)                               AS n_hora,
    o.p_total,
    o.id_tipo_pago,
    COALESCE(tp.n_tipo_pago, 'SIN REGISTRO')
                        COLLATE utf8mb4_unicode_ci        AS n_tipo_pago,
    o.source            COLLATE utf8mb4_unicode_ci        AS source,
    o.n_tipo_consumo    COLLATE utf8mb4_unicode_ci        AS n_tipo_consumo,
    o.n_nombre_cliente  COLLATE utf8mb4_unicode_ci        AS n_nombre_cliente,
    NULL                                                  AS id_cierre,
    'VIVO'              COLLATE utf8mb4_unicode_ci        AS origen
FROM orden o
LEFT JOIN tipo_pago tp ON tp.id_tipo_pago = o.id_tipo_pago
WHERE o.n_estatus_orden = 'CERRADA';


-- ── Ventas (nivel producto) ─────────────────────────────────────
-- Para ranking de productos y el cruce con tipo de consumo.
-- El nombre del producto se toma del historico cuando existe: asi
-- un producto borrado del catalogo sigue apareciendo en su reporte.
CREATE OR REPLACE VIEW v_venta_item AS
SELECT
    hoi.id_orden,
    hoi.id_producto,
    hoi.n_nombre_producto COLLATE utf8mb4_unicode_ci      AS n_nombre_producto,
    hoi.p_cantidad,
    hoi.precio_total,
    DATE(ho.t_hora_creacion - INTERVAL 1 HOUR)            AS d_dia_negocio,
    ho.n_tipo_consumo     COLLATE utf8mb4_unicode_ci      AS n_tipo_consumo,
    ho.source             COLLATE utf8mb4_unicode_ci      AS source,
    'ARCHIVO'             COLLATE utf8mb4_unicode_ci      AS origen
FROM hist_orden_item hoi
INNER JOIN hist_orden ho ON ho.id_orden  = hoi.id_orden
                        AND ho.id_cierre = hoi.id_cierre

UNION ALL

SELECT
    oi.id_orden,
    oi.id_producto,
    p.n_nombre_producto   COLLATE utf8mb4_unicode_ci      AS n_nombre_producto,
    oi.p_cantidad,
    oi.precio_total,
    DATE(o.t_hora_creacion - INTERVAL 1 HOUR)             AS d_dia_negocio,
    o.n_tipo_consumo      COLLATE utf8mb4_unicode_ci      AS n_tipo_consumo,
    o.source              COLLATE utf8mb4_unicode_ci      AS source,
    'VIVO'                COLLATE utf8mb4_unicode_ci      AS origen
FROM orden_item oi
INNER JOIN orden o    ON o.id_orden     = oi.id_orden
LEFT  JOIN producto p ON p.id_producto  = oi.id_producto
WHERE o.n_estatus_orden = 'CERRADA';


-- ── VERIFICACION (ejecutar por separado) ────────────────────────
-- Debe aparecer el dia de hoy con las ventas vivas:
-- SELECT d_dia_negocio, origen, COUNT(*) AS ordenes, SUM(p_total) AS venta
-- FROM v_venta_orden
-- GROUP BY d_dia_negocio, origen
-- ORDER BY d_dia_negocio DESC
-- LIMIT 8;
