-- ═══════════════════════════════════════════════════════════════
-- sp_gestion_modulo — Modulo de Gestion
-- Fecha: 2026-09-12
--
-- Procesos:
--   1 = KPIs del periodo, con comparativo contra el periodo anterior
--       de la misma duracion (7 dias contra los 7 previos, etc.)
--   2 = venta por dia del periodo (para la grafica y la Bitacora)
--
-- Todo sale de v_venta_orden, que ya junta lo archivado con lo del
-- dia en curso y calcula el dia de negocio (01:00 a 01:00).
--
-- Los dias sin ventas no aparecen: el negocio cierra los lunes y un
-- cero falso tuerce los promedios. Quien pinte la grafica decide si
-- dibuja el hueco.
--
-- Ejecutar con el cliente de mysql (lleva DELIMITER).
-- ═══════════════════════════════════════════════════════════════

DROP PROCEDURE IF EXISTS sp_gestion_modulo;

DELIMITER ;;

CREATE PROCEDURE sp_gestion_modulo(
    IN Vp_tipo_proceso TINYINT,
    IN Vd_desde        DATE,
    IN Vd_hasta        DATE
)
BEGIN
    DECLARE v_dias        INT;
    DECLARE v_desde_prev  DATE;
    DECLARE v_hasta_prev  DATE;

    -- Periodo anterior: misma cantidad de dias, pegado al actual.
    SET v_dias       = DATEDIFF(Vd_hasta, Vd_desde) + 1;
    SET v_hasta_prev = DATE_SUB(Vd_desde, INTERVAL 1 DAY);
    SET v_desde_prev = DATE_SUB(v_hasta_prev, INTERVAL (v_dias - 1) DAY);

    -- ═══════════════════════════════════════════════════════════
    -- 1 · KPIs DEL PERIODO
    -- ═══════════════════════════════════════════════════════════
    IF Vp_tipo_proceso = 1 THEN

        SELECT
            Vd_desde AS d_desde,
            Vd_hasta AS d_hasta,
            v_dias   AS n_dias,

            -- Periodo actual
            COALESCE(act.ordenes, 0)        AS n_ordenes,
            COALESCE(act.venta, 0)          AS p_venta,
            COALESCE(act.ticket, 0)         AS p_ticket_promedio,
            COALESCE(act.dias_con_venta, 0) AS n_dias_con_venta,

            -- Periodo anterior de la misma duracion
            v_desde_prev                     AS d_desde_prev,
            v_hasta_prev                     AS d_hasta_prev,
            COALESCE(ant.ordenes, 0)         AS n_ordenes_prev,
            COALESCE(ant.venta, 0)           AS p_venta_prev,
            COALESCE(ant.ticket, 0)          AS p_ticket_promedio_prev,

            -- Variacion porcentual. NULL solo cuando el periodo
            -- anterior no tuvo ventas: ahi no hay con que comparar y
            -- es mas honesto que pintar un 100%. Si el anterior vendio
            -- y el actual no, la caida si se reporta (-100%).
            CASE WHEN COALESCE(ant.venta, 0) = 0 THEN NULL
                 ELSE ROUND((COALESCE(act.venta, 0) - ant.venta) / ant.venta * 100, 1)
            END AS p_var_venta,
            CASE WHEN COALESCE(ant.ordenes, 0) = 0 THEN NULL
                 ELSE ROUND((COALESCE(act.ordenes, 0) - ant.ordenes) / ant.ordenes * 100, 1)
            END AS p_var_ordenes,
            CASE WHEN COALESCE(ant.ticket, 0) = 0 THEN NULL
                 ELSE ROUND((COALESCE(act.ticket, 0) - ant.ticket) / ant.ticket * 100, 1)
            END AS p_var_ticket,

            -- Cuanto de lo mostrado aun puede cambiar (ordenes del
            -- dia en curso, que todavia se pueden reabrir)
            COALESCE(act.ordenes_vivas, 0) AS n_ordenes_vivas

        FROM (SELECT 1) x
        LEFT JOIN (
            SELECT COUNT(*)                         AS ordenes,
                   SUM(p_total)                     AS venta,
                   ROUND(AVG(p_total), 2)           AS ticket,
                   COUNT(DISTINCT d_dia_negocio)    AS dias_con_venta,
                   SUM(origen = 'VIVO')             AS ordenes_vivas
            FROM v_venta_orden
            WHERE d_dia_negocio BETWEEN Vd_desde AND Vd_hasta
        ) act ON 1 = 1
        LEFT JOIN (
            SELECT COUNT(*)               AS ordenes,
                   SUM(p_total)           AS venta,
                   ROUND(AVG(p_total), 2) AS ticket
            FROM v_venta_orden
            WHERE d_dia_negocio BETWEEN v_desde_prev AND v_hasta_prev
        ) ant ON 1 = 1;

    -- ═══════════════════════════════════════════════════════════
    -- 2 · VENTA POR DIA
    -- ═══════════════════════════════════════════════════════════
    ELSEIF Vp_tipo_proceso = 2 THEN

        SELECT
            d_dia_negocio,
            DAYOFWEEK(d_dia_negocio)      AS n_dia_semana,
            COUNT(*)                      AS n_ordenes,
            SUM(p_total)                  AS p_venta,
            ROUND(AVG(p_total), 2)        AS p_ticket_promedio,
            SUM(origen = 'VIVO')          AS n_ordenes_vivas
        FROM v_venta_orden
        WHERE d_dia_negocio BETWEEN Vd_desde AND Vd_hasta
        GROUP BY d_dia_negocio
        ORDER BY d_dia_negocio;

    END IF;
END ;;

DELIMITER ;
