-- ═══════════════════════════════════════════════════════════════
-- REVERSION de Compras del dia — El Rincon en las Arboledas
-- Fecha: 2026-11-16
--
-- Deja la base como estaba antes de los scripts 2026-11-16*.sql.
-- Solo usar si hay que dar marcha atras; despues regresar la app a
-- la version anterior (sin CompraController) en Railway.
--
-- ANTES DE CORRERLO
--   Las compras pagadas "de otra manera" (FUERA) solo viven en la
--   tabla compra y se pierden al borrarla. Si hay que conservarlas:
--     SELECT * FROM compra;   -- exportar el resultado
--
-- ORDEN
--   1. Este script (lleva DELIMITER: cliente de mysql).
--   2. 2026-09-17_sp_gestion_caja_v2.sql   (regresa caja a v2)
--   3. 2026-09-13b_sp_cierre_dia_v3.sql    (regresa el cierre a v3)
-- ═══════════════════════════════════════════════════════════════


-- ── Datos ──────────────────────────────────────────────────────
-- Las salidas de las compras de caja se quedan (el dinero si salio
-- de la caja); solo regresan a la categoria con la que se anotaban.
UPDATE caja_movimiento
SET    n_categoria = 'PROVEEDOR'
WHERE  n_categoria = 'COMPRA';

ALTER TABLE hist_cierre_dia
    DROP COLUMN n_compras,
    DROP COLUMN p_compras_caja,
    DROP COLUMN p_compras_fuera;

DROP PROCEDURE IF EXISTS sp_gestion_compras;

DROP TABLE IF EXISTS compra;


-- ── sp_gestion_modulo tal como corria en produccion el 2026-11-16 ─
DELIMITER ;;

DROP PROCEDURE IF EXISTS sp_gestion_modulo;;

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

            COALESCE(act.ordenes, 0)        AS n_ordenes,
            COALESCE(act.venta, 0)          AS p_venta,
            COALESCE(act.ticket, 0)         AS p_ticket_promedio,
            COALESCE(act.dias_con_venta, 0) AS n_dias_con_venta,

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

            COALESCE(act.ordenes_vivas, 0) AS n_ordenes_vivas

        FROM (SELECT 1) x
        LEFT JOIN (
            SELECT COUNT(*)                      AS ordenes,
                   SUM(p_total)                  AS venta,
                   ROUND(AVG(p_total), 2)        AS ticket,
                   COUNT(DISTINCT d_dia_negocio) AS dias_con_venta,
                   SUM(origen = 'VIVO')          AS ordenes_vivas
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

    -- ═══════════════════════════════════════════════════════════
    -- 3 · CIERRES POR DIA: LO VENDIDO CONTRA LO ARQUEADO
    -- ═══════════════════════════════════════════════════════════
    ELSEIF Vp_tipo_proceso = 3 THEN

        SELECT
            d.dia                                   AS d_dia_negocio,
            DAYOFWEEK(d.dia)                        AS n_dia_semana,

            COALESCE(v.ordenes, 0)                  AS n_ordenes,
            COALESCE(v.venta, 0)                    AS p_venta,
            COALESCE(v.ordenes_vivas, 0)            AS n_ordenes_vivas,

            COALESCE(c.cortes, 0)                   AS n_cortes,
            COALESCE(c.arqueado, 0)                 AS p_arqueado,
            COALESCE(c.efectivo, 0)                 AS p_efectivo,
            COALESCE(c.tarjeta, 0)                  AS p_tarjeta,
            COALESCE(c.otro, 0)                     AS p_otro,
            c.usuarios                              AS n_usuarios_cierre,
            c.ultimo_corte                          AS t_ultimo_corte,

            -- Lo que falta arquear. Durante el dia es normal; despues
            -- de la 1 am significa que algo quedo fuera del corte.
            COALESCE(v.venta, 0) - COALESCE(c.arqueado, 0) AS p_por_arquear

        FROM (
            SELECT d_dia_negocio AS dia
            FROM v_venta_orden
            WHERE d_dia_negocio BETWEEN Vd_desde AND Vd_hasta
            GROUP BY d_dia_negocio
            UNION
            SELECT d_fecha_negocio
            FROM hist_cierre_dia
            WHERE d_fecha_negocio BETWEEN Vd_desde AND Vd_hasta
        ) d

        LEFT JOIN (
            SELECT d_dia_negocio,
                   COUNT(*)             AS ordenes,
                   SUM(p_total)         AS venta,
                   SUM(origen = 'VIVO') AS ordenes_vivas
            FROM v_venta_orden
            WHERE d_dia_negocio BETWEEN Vd_desde AND Vd_hasta
            GROUP BY d_dia_negocio
        ) v ON v.d_dia_negocio = d.dia

        LEFT JOIN (
            SELECT d_fecha_negocio,
                   COUNT(*)                            AS cortes,
                   SUM(p_total_general)                AS arqueado,
                   SUM(p_total_efectivo)               AS efectivo,
                   SUM(p_total_tarjeta)                AS tarjeta,
                   SUM(p_total_otro)                   AS otro,
                   GROUP_CONCAT(DISTINCT n_usuario_cierre
                                ORDER BY n_usuario_cierre SEPARATOR ', ') AS usuarios,
                   MAX(t_fecha_cierre)                 AS ultimo_corte
            FROM hist_cierre_dia
            WHERE d_fecha_negocio BETWEEN Vd_desde AND Vd_hasta
            GROUP BY d_fecha_negocio
        ) c ON c.d_fecha_negocio = d.dia

        ORDER BY d.dia DESC;

    -- ═══════════════════════════════════════════════════════════
    -- 4 · CORTES INDIVIDUALES DEL PERIODO
    -- ═══════════════════════════════════════════════════════════
    ELSEIF Vp_tipo_proceso = 4 THEN

        SELECT
            id_cierre,
            d_fecha_negocio,
            t_fecha_cierre,
            n_total_ordenes,
            p_total_general,
            p_total_efectivo,
            p_total_tarjeta,
            p_total_otro,
            n_usuario_cierre,
            n_observaciones,
            d_primer_dia,
            d_ultimo_dia,
            dias_abarcados
        FROM v_hist_cierre_dia
        WHERE d_fecha_negocio BETWEEN Vd_desde AND Vd_hasta
        ORDER BY d_fecha_negocio DESC, t_fecha_cierre DESC;

    -- ═══════════════════════════════════════════════════════════
    -- 5 · ORDENES DEL PERIODO (BITACORA)
    -- ═══════════════════════════════════════════════════════════
    ELSEIF Vp_tipo_proceso = 5 THEN

        SELECT
            id_orden,
            n_folio_dia,
            d_dia_negocio,
            t_hora_creacion,
            TIME_FORMAT(t_hora_creacion, '%H:%i') AS n_hora_texto,
            n_nombre_cliente,
            p_total,
            n_tipo_pago,
            source,
            n_tipo_consumo,
            origen
        FROM v_venta_orden
        WHERE d_dia_negocio BETWEEN Vd_desde AND Vd_hasta
        ORDER BY t_hora_creacion DESC;

    END IF;
END ;;

DELIMITER ;
