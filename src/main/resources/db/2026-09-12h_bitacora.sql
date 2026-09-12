-- ═══════════════════════════════════════════════════════════════
-- sp_gestion_modulo v3 — Modulo de Gestion
-- Fecha: 2026-09-12
--
-- Agrega el proceso 5, que alimenta la Bitacora. Los procesos 1 a 4
-- no cambian.
--
-- Procesos:
--   1 = KPIs del periodo con comparativo
--   2 = venta por dia
--   3 = cierres por dia: lo vendido contra lo arqueado
--   4 = cortes individuales del periodo
--   5 = ordenes del periodo, para la Bitacora
--
-- Sobre el proceso 3:
--   Un dia tiene dos verdades que no siempre coinciden, y conviene
--   verlas juntas en vez de fingir que son una sola:
--     · lo vendido  → sale de las ordenes (v_venta_orden)
--     · lo arqueado → sale de los cortes de caja
--   La diferencia es normal durante el dia (lo que aun no se archiva)
--   y deja de serlo despues de la 1 am: ahi significa que algo quedo
--   fuera del corte y hay que revisarlo.
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


-- ═══════════════════════════════════════════════════════════════
-- DETALLE DE UNA ORDEN — para el modal de la Bitacora
--   Resultado 1: la cabecera
--   Resultado 2: los productos, con extras y comentarios
--
-- Sirve igual para una orden archivada que para una viva: busca en
-- el archivo y en operacion, y solo una de las dos tiene filas.
-- ═══════════════════════════════════════════════════════════════

DROP PROCEDURE IF EXISTS sp_gestion_detalle_orden;

DELIMITER ;;

CREATE PROCEDURE sp_gestion_detalle_orden(IN p_id_orden INT)
BEGIN
    SELECT
        id_orden,
        t_hora_creacion,
        d_dia_negocio,
        n_nombre_cliente,
        p_total,
        n_tipo_pago,
        source,
        n_tipo_consumo,
        origen
    FROM v_venta_orden
    WHERE id_orden = p_id_orden
    LIMIT 1;

    SELECT
        hoi.n_nombre_producto COLLATE utf8mb4_unicode_ci AS n_nombre_producto,
        hoi.p_cantidad,
        hoi.p_precio_base,
        hoi.precio_total,
        hoi.n_comentario      COLLATE utf8mb4_unicode_ci AS n_comentario,
        COALESCE((
            SELECT SUM(hoio.p_total_precio_extra)
            FROM hist_orden_item_opcion hoio
            WHERE hoio.id_orden_item = hoi.id_orden_item
              AND hoio.id_cierre     = hoi.id_cierre
        ), 0) AS p_extras
    FROM hist_orden_item hoi
    WHERE hoi.id_orden = p_id_orden

    UNION ALL

    SELECT
        p.n_nombre_producto COLLATE utf8mb4_unicode_ci AS n_nombre_producto,
        oi.p_cantidad,
        oi.p_precio_base,
        oi.precio_total,
        oi.n_comentario     COLLATE utf8mb4_unicode_ci AS n_comentario,
        COALESCE((
            SELECT SUM(oio.p_total_precio_extra)
            FROM orden_item_opcion oio
            WHERE oio.id_orden_item = oi.id_orden_item
        ), 0) AS p_extras
    FROM orden_item oi
    LEFT JOIN producto p ON p.id_producto = oi.id_producto
    WHERE oi.id_orden = p_id_orden;
END ;;

DELIMITER ;
