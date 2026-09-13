-- ═══════════════════════════════════════════════════════════════
-- sp_reportes v2 — pantalla de Reportes y Corte
-- Fecha: 2026-09-13
--
-- El problema:
--   Los dos procesos leian solo la tabla `orden`, o sea unicamente lo
--   que aun no se ha archivado. Cuando el cierre corria una vez al
--   dia eso equivalia al dia entero, pero hoy se archiva varias veces
--   al dia y despues de cada corte la pantalla se queda casi vacia:
--   con dos cortes hechos, mostraba "1 registro" de un dia con seis
--   ordenes, y el corte de caja salia incompleto.
--
-- La solucion:
--   Leer de v_venta_orden, que junta lo archivado con lo vivo, y
--   acotar al dia de negocio en curso (de 01:00 a 01:00). Asi la
--   pantalla dice lo que de verdad se vendio hoy, sin importar
--   cuantos cortes lleven.
--
--   De paso viaja n_folio_dia, para que el numero que se ve aqui sea
--   el mismo que se ve en las demas pantallas.
--
-- Ejecutar con el cliente de mysql (lleva DELIMITER).
-- ═══════════════════════════════════════════════════════════════

DROP PROCEDURE IF EXISTS sp_reportes;

DELIMITER ;;

CREATE PROCEDURE sp_reportes(
    IN p_tipo_proceso TINYINT,
    IN p_id_tipo_pago INT
)
BEGIN
    DECLARE v_dia DATE;

    -- El dia de negocio en curso: antes de la 01:00 seguimos en el
    -- dia anterior, que es como trabaja la cafeteria.
    SET v_dia = DATE(CONVERT_TZ(NOW(), 'UTC', 'America/Mexico_City') - INTERVAL 1 HOUR);

    -- ═══════════════════════════════════════════════════════════
    -- 1 · DETALLE DE ORDENES DEL DIA
    -- ═══════════════════════════════════════════════════════════
    IF p_tipo_proceso = 1 THEN

        SELECT
            v.id_orden,
            v.n_folio_dia,
            v.t_hora_creacion                    AS hora_cierre,
            v.p_total                            AS total,
            v.n_tipo_pago                        AS metodo_pago,
            v.id_tipo_pago,
            v.origen,
            COALESCE(
                GROUP_CONCAT(
                    CONCAT(i.p_cantidad, 'x ', i.n_nombre_producto)
                    ORDER BY i.n_nombre_producto
                    SEPARATOR ' | '
                ), ''
            )                                    AS resumen
        FROM v_venta_orden v
        LEFT JOIN v_venta_item i ON i.id_orden = v.id_orden
        WHERE v.d_dia_negocio = v_dia
          AND (p_id_tipo_pago IS NULL OR v.id_tipo_pago = p_id_tipo_pago)
        GROUP BY
            v.id_orden, v.n_folio_dia, v.t_hora_creacion,
            v.p_total, v.n_tipo_pago, v.id_tipo_pago, v.origen
        ORDER BY v.t_hora_creacion DESC;

    -- ═══════════════════════════════════════════════════════════
    -- 2 · CORTE DE CAJA DEL DIA
    -- ═══════════════════════════════════════════════════════════
    ELSEIF p_tipo_proceso = 2 THEN

        SELECT
            COALESCE(n_tipo_pago, 'SIN REGISTRO') AS metodo_pago,
            COUNT(*)                              AS total_ordenes,
            COALESCE(SUM(p_total), 0)             AS total_monto,
            1                                     AS orden_fila
        FROM v_venta_orden
        WHERE d_dia_negocio = v_dia
        GROUP BY id_tipo_pago, n_tipo_pago

        UNION ALL

        SELECT
            'TOTAL GENERAL',
            COUNT(*),
            COALESCE(SUM(p_total), 0),
            2
        FROM v_venta_orden
        WHERE d_dia_negocio = v_dia

        ORDER BY orden_fila ASC, metodo_pago ASC;

    ELSE
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Tipo de proceso invalido. Use 1=DETALLE, 2=CORTE.';
    END IF;
END ;;

DELIMITER ;
