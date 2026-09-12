-- ═══════════════════════════════════════════════════════════════
-- Cierre automatico — parte 2 (continuacion de 2026-09-12)
-- Fecha: 2026-09-12
--
-- La primera parte se detuvo en el indice unico por dia: resulta
-- que en El Rincon cortan varias veces al dia (29 dias del
-- historico tienen dos o tres cortes). Es su forma de trabajar,
-- asi que el indice unico se elimina del plan y el control de
-- "no cerrar dos veces" queda en el procedimiento, que archiva
-- por ventana de tiempo y no repite ordenes.
--
-- Los pasos 1 y 2 (columna d_fecha_negocio y su relleno) ya se
-- aplicaron. Aqui va lo que falto.
-- ═══════════════════════════════════════════════════════════════


-- ── Canal y tipo de consumo en el archivo ───────────────────────
ALTER TABLE hist_orden ADD COLUMN source VARCHAR(20) NULL DEFAULT NULL;

ALTER TABLE hist_orden ADD COLUMN n_tipo_consumo VARCHAR(10) NULL DEFAULT NULL;


-- ── Indices de consulta ─────────────────────────────────────────
-- NO unico: un dia puede tener varios cortes.
CREATE INDEX idx_hist_cierre_fecha_negocio ON hist_cierre_dia (d_fecha_negocio);

CREATE INDEX idx_hist_orden_creacion ON hist_orden (t_hora_creacion);

CREATE INDEX idx_hist_orden_item_cierre ON hist_orden_item (id_cierre);


-- ── VERIFICACION (ejecutar por separado) ────────────────────────
-- SELECT d_fecha_negocio,
--        COUNT(*)                  AS cortes_del_dia,
--        SUM(n_total_ordenes)      AS ordenes,
--        SUM(p_total_general)      AS venta
-- FROM hist_cierre_dia
-- GROUP BY d_fecha_negocio
-- ORDER BY d_fecha_negocio DESC
-- LIMIT 10;
