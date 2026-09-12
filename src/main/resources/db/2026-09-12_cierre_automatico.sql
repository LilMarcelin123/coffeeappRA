-- ═══════════════════════════════════════════════════════════════
-- Cierre automatico por dia de negocio — El Rincon en las Arboledas
-- Fecha: 2026-09-12
--
-- Que hace:
--   1. Agrega `d_fecha_negocio` a hist_cierre_dia: el dia AL QUE
--      PERTENECE el corte, no el momento en que se ejecuto.
--      El cierre que corre el 04 a la 1 am guarda '2026-09-03'.
--   2. (cancelado, ver PASO 4)
--   3. Agrega al archivo el canal y el tipo de consumo, que hoy se
--      pierden en cuanto se cierra el dia.
--
-- El dia de negocio va de las 01:00 a las 01:00 del dia siguiente.
--
-- Ejecutar en AMBAS bases: MariaDB local y MySQL de Railway.
-- Una sentencia a la vez: la consola de Railway no admite varias.
-- ═══════════════════════════════════════════════════════════════


-- ── PASO 1 · Columna del dia de negocio ─────────────────────────
ALTER TABLE hist_cierre_dia ADD COLUMN d_fecha_negocio DATE NULL DEFAULT NULL;


-- ── PASO 2 · Rellenar los cierres que ya existen ────────────────
-- Se les asigna el dia en que corrieron, restando una hora para
-- respetar la regla de que el dia termina a la 1 am.
UPDATE hist_cierre_dia
SET d_fecha_negocio = DATE(t_fecha_cierre - INTERVAL 1 HOUR)
WHERE d_fecha_negocio IS NULL;


-- ── PASO 3 · Revisar duplicados ANTES del indice unico ──────────
-- Si devuelve filas, hubo dos cierres manuales el mismo dia y hay
-- que decidir con cual quedarse antes de seguir. Si no devuelve
-- nada, continua al paso 4.
SELECT d_fecha_negocio, COUNT(*) AS cierres, GROUP_CONCAT(id_cierre) AS ids
FROM hist_cierre_dia
GROUP BY d_fecha_negocio
HAVING COUNT(*) > 1;


-- ── PASO 4 · CANCELADO ──────────────────────────────────────────
-- Aqui iba un indice unico por dia. Se descarto: en El Rincon cortan
-- varias veces al dia (29 dias del historico tienen dos o tres cortes),
-- asi que un dia SI puede tener varios cierres. El control de no
-- duplicar ordenes vive en sp_cierre_dia, que archiva por ventana de
-- tiempo. Los pasos 5 y 6 se movieron a 2026-09-12b.


-- ── PASO 5 · Canal y tipo de consumo en el archivo ──────────────
ALTER TABLE hist_orden ADD COLUMN source VARCHAR(20) NULL DEFAULT NULL;

ALTER TABLE hist_orden ADD COLUMN n_tipo_consumo VARCHAR(10) NULL DEFAULT NULL;


-- ── PASO 6 · Busqueda por dia en la Bitacora ────────────────────
-- Sin esto, consultar un dia recorre toda la tabla.
CREATE INDEX idx_hist_orden_creacion ON hist_orden (t_hora_creacion);

CREATE INDEX idx_hist_orden_item_cierre ON hist_orden_item (id_cierre);


-- ── VERIFICACION (ejecutar por separado) ────────────────────────
-- SELECT id_cierre, d_fecha_negocio, t_fecha_cierre, n_total_ordenes, p_total_general
-- FROM hist_cierre_dia
-- ORDER BY d_fecha_negocio DESC
-- LIMIT 10;
