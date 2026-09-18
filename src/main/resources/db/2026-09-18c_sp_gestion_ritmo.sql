-- ═══════════════════════════════════════════════════════════════
-- sp_gestion_ritmo — Modulo de Gestion, pantalla de Ritmo
-- Fecha: 2026-09-18
--
-- Procesos:
--   1 = ordenes por dia de la semana y hora
--   2 = cuantos dias abiertos hubo de cada dia de la semana
--
-- Por que son dos y no uno:
--   El mapa se lee como promedio, no como total. Si el periodo trae
--   tres jueves y dos viernes, el total pinta al jueves mas cargado
--   solo porque hubo mas jueves. El proceso 2 da el divisor.
--
--   Y cuenta dias ABIERTOS, no dias del calendario: el Rincon cierra
--   los lunes, y meter esos lunes en el promedio diria que el lunes
--   vende poco cuando en realidad no vende nada porque no abre.
--
-- Sobre las horas:
--   n_hora es la hora del reloj (0 a 23). Como el dia de negocio va
--   de las 01:00 a las 01:00, la madrugada pertenece al dia anterior
--   y la pantalla la acomoda al final del renglon. Aqui solo se
--   devuelve el numero.
--
-- Ejecutar con el cliente de mysql (lleva DELIMITER).
-- ═══════════════════════════════════════════════════════════════

DELIMITER ;;

DROP PROCEDURE IF EXISTS sp_gestion_ritmo;;

CREATE PROCEDURE sp_gestion_ritmo(
    IN pa_tipo_proceso TINYINT,
    IN pa_desde        DATE,
    IN pa_hasta        DATE
)
BEGIN
    DECLARE v_desde DATE;
    DECLARE v_hasta DATE;

    SET v_hasta = COALESCE(pa_hasta, DATE(CONVERT_TZ(NOW(), 'UTC', 'America/Mexico_City') - INTERVAL 1 HOUR));
    SET v_desde = COALESCE(pa_desde, v_hasta);

    -- ═══════════════════════════════════════════════════════════
    -- 1 · EL MAPA
    --     WEEKDAY: 0 lunes … 6 domingo.
    -- ═══════════════════════════════════════════════════════════
    IF pa_tipo_proceso = 1 THEN

        SELECT
            WEEKDAY(v.d_dia_negocio) AS n_dia_semana,
            v.n_hora,
            COUNT(*)                 AS n_ordenes,
            SUM(v.p_total)           AS p_importe
        FROM v_venta_orden v
        WHERE v.d_dia_negocio BETWEEN v_desde AND v_hasta
        GROUP BY WEEKDAY(v.d_dia_negocio), v.n_hora
        ORDER BY n_dia_semana, v.n_hora;

    -- ═══════════════════════════════════════════════════════════
    -- 2 · DIAS ABIERTOS DE CADA DIA DE LA SEMANA
    -- ═══════════════════════════════════════════════════════════
    ELSEIF pa_tipo_proceso = 2 THEN

        SELECT n_dia_semana, COUNT(*) AS n_dias
        FROM (
            SELECT DISTINCT
                   v.d_dia_negocio,
                   WEEKDAY(v.d_dia_negocio) AS n_dia_semana
            FROM v_venta_orden v
            WHERE v.d_dia_negocio BETWEEN v_desde AND v_hasta
        ) AS abiertos
        GROUP BY n_dia_semana
        ORDER BY n_dia_semana;

    END IF;
END ;;

DELIMITER ;


-- ── VERIFICACION (ejecutar por separado) ────────────────────────
-- CALL sp_gestion_ritmo(1, '2026-09-01', '2026-09-18');
-- CALL sp_gestion_ritmo(2, '2026-09-01', '2026-09-18');
