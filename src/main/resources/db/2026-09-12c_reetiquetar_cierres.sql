-- ═══════════════════════════════════════════════════════════════
-- Reetiquetado de cierres historicos + vistas del dia de negocio
-- Fecha: 2026-09-12
--
-- Por que:
--   El relleno inicial de d_fecha_negocio uso la hora en que corrio
--   el cierre. Resulto mala fuente: el 10 de septiembre no se cerro,
--   y su corte salio hasta el 11 a las 15:05, quedando etiquetado
--   como dia 11 cuando sus 20 ordenes eran del 10.
--
--   Revisando el historico: 36 cierres archivaron ordenes de mas de
--   un dia y 68 quedaron con fecha equivocada. Todo herencia del
--   procedimiento viejo, que archivaba "todo lo cerrado" sin filtrar
--   por fecha. Los cierres nuevos ya no pueden hacer eso.
--
-- Que se hace:
--   1. Cada cierre se reetiqueta con el dia de las ordenes que
--      archivo, no con la hora en que se ejecuto. Para los que
--      abarcan varios dias se usa el ultimo, y la vista del punto 3
--      expone el rango real para que se vea en pantalla.
--   2. Vista de ordenes historicas con su dia de negocio ya
--      calculado, para que la regla de la 01:00 viva en un solo
--      lugar y no se repita en cada consulta del modulo.
--   3. Vista de cierres con el rango de dias que abarca cada uno.
--
-- REGLA DEL MODULO:
--   Ventas por dia  -> v_hist_orden_dia (hora de la orden)
--   Arqueo de caja  -> v_hist_cierre_dia (el corte)
--   Nunca al reves.
-- ═══════════════════════════════════════════════════════════════


-- ── PASO 1 · Reetiquetar por las ordenes archivadas ─────────────
UPDATE hist_cierre_dia c
JOIN (
    SELECT id_cierre,
           DATE(MAX(t_hora_creacion) - INTERVAL 1 HOUR) AS d_dia
    FROM hist_orden
    GROUP BY id_cierre
) x ON x.id_cierre = c.id_cierre
SET c.d_fecha_negocio = x.d_dia
WHERE c.d_fecha_negocio <> x.d_dia;


-- ── PASO 2 · Ordenes historicas con su dia de negocio ───────────
-- El dia va de las 01:00 a las 01:00: restar una hora y truncar.
CREATE OR REPLACE VIEW v_hist_orden_dia AS
SELECT
    ho.id_hist_orden,
    ho.id_cierre,
    ho.id_orden,
    ho.n_nombre_cliente,
    ho.t_hora_creacion,
    DATE(ho.t_hora_creacion - INTERVAL 1 HOUR) AS d_dia_negocio,
    HOUR(ho.t_hora_creacion)                   AS n_hora,
    ho.p_total,
    ho.id_tipo_pago,
    ho.n_tipo_pago,
    ho.source,
    ho.n_tipo_consumo,
    ho.resumen_items
FROM hist_orden ho;


-- ── PASO 3 · Cierres con el rango que abarcan ───────────────────
-- dias_abarcados > 1 marca los cortes viejos que juntaron varios
-- dias: la pantalla debe mostrarlos como rango, no como un dia.
CREATE OR REPLACE VIEW v_hist_cierre_dia AS
SELECT
    c.id_cierre,
    c.d_fecha_negocio,
    c.t_fecha_cierre,
    c.n_total_ordenes,
    c.p_total_general,
    c.p_total_efectivo,
    c.p_total_tarjeta,
    c.p_total_otro,
    c.n_usuario_cierre,
    c.n_observaciones,
    r.d_primer_dia,
    r.d_ultimo_dia,
    COALESCE(r.dias_abarcados, 0) AS dias_abarcados
FROM hist_cierre_dia c
LEFT JOIN (
    SELECT id_cierre,
           DATE(MIN(t_hora_creacion) - INTERVAL 1 HOUR) AS d_primer_dia,
           DATE(MAX(t_hora_creacion) - INTERVAL 1 HOUR) AS d_ultimo_dia,
           COUNT(DISTINCT DATE(t_hora_creacion - INTERVAL 1 HOUR)) AS dias_abarcados
    FROM hist_orden
    GROUP BY id_cierre
) r ON r.id_cierre = c.id_cierre;


-- ── VERIFICACION (ejecutar por separado) ────────────────────────
-- Ventas por dia, que es como las vera el modulo:
-- SELECT d_dia_negocio, COUNT(*) AS ordenes, SUM(p_total) AS venta
-- FROM v_hist_orden_dia
-- GROUP BY d_dia_negocio
-- ORDER BY d_dia_negocio DESC
-- LIMIT 10;
--
-- Cierres con su rango real:
-- SELECT id_cierre, d_fecha_negocio, d_primer_dia, d_ultimo_dia,
--        dias_abarcados, p_total_general, n_usuario_cierre
-- FROM v_hist_cierre_dia
-- ORDER BY id_cierre DESC
-- LIMIT 10;
