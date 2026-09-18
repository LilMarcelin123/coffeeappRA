-- ═══════════════════════════════════════════════════════════════
-- Folio del dia en la pantalla de cocina — El Rincon en las Arboledas
-- Fecha: 2026-09-18
--
-- Que arregla:
--   La barra le canta al cliente el folio del dia (1, 2, 3...), pero
--   las pantallas de operador seguian mostrando el id interno, que no
--   se reinicia nunca. El cliente oia "orden 3" y en cocina decia
--   "orden 412": la misma orden con dos nombres.
--
--   El JS ya prefiere n_folio_dia y solo cae al id_orden cuando no
--   viene; el problema es que el proceso 7 de sp_gestionar_orden
--   nunca lo devolvio. Aqui se agrega esa columna al SELECT.
--
-- Es el mismo procedimiento del 13 de septiembre con un solo cambio.
-- Ejecutar con el cliente de mysql (lleva DELIMITER).
-- ═══════════════════════════════════════════════════════════════


DELIMITER ;;

DROP PROCEDURE IF EXISTS sp_gestionar_orden;;

CREATE PROCEDURE sp_gestionar_orden(
    IN p_id_orden     INT,
    IN p_tipo_proceso TINYINT,
    IN p_id_rol       INT,
    IN p_tipo_pago    INT
)
BEGIN
    DECLARE v_total    DECIMAL(10,2);
    DECLARE v_usuario  VARCHAR(150) DEFAULT 'sistema';

    IF p_tipo_proceso IN (1, 2) THEN
        SELECT COALESCE(SUM(precio_total), 0) INTO v_total FROM orden_item WHERE id_orden = p_id_orden;
    END IF;

    IF p_tipo_proceso = 1 THEN
        UPDATE orden SET p_total = v_total, n_estatus_orden = 'CERRADA', id_tipo_pago = p_tipo_pago WHERE id_orden = p_id_orden;
        UPDATE orden_preparacion SET n_estado_preparacion = 'LISTO' WHERE id_orden = p_id_orden;
        CALL sp_descontar_inventario_orden(p_id_orden, v_usuario);
        SELECT p_id_orden AS id_orden, 'CERRADA' AS estatus, v_total AS total_orden, p_tipo_pago AS tipo_pago;

    ELSEIF p_tipo_proceso = 2 THEN
        UPDATE orden SET p_total = v_total, n_estatus_orden = 'PENDIENTE' WHERE id_orden = p_id_orden;
        DROP TEMPORARY TABLE IF EXISTS tmp_estados_prev;
        CREATE TEMPORARY TABLE tmp_estados_prev AS
            SELECT id_orden_item, n_estado_preparacion
            FROM orden_preparacion WHERE id_orden = p_id_orden;
        DELETE FROM orden_preparacion WHERE id_orden = p_id_orden;
        INSERT INTO orden_preparacion (id_orden, id_orden_item, id_producto, n_nombre_producto, p_cantidad, n_extras_descripcion, id_rol_preparacion, n_estado_preparacion)
        SELECT oi.id_orden, oi.id_orden_item, oi.id_producto, p.n_nombre_producto, oi.p_cantidad,
            CONCAT(COALESCE(GROUP_CONCAT(CONCAT(sco.n_nombre_subcategoria_opciones, ' x', oio.p_cantidad) SEPARATOR ', '), ''),
                CASE WHEN oi.n_comentario IS NOT NULL AND oi.n_comentario != '' THEN CONCAT(' | Nota: ', oi.n_comentario) ELSE '' END),
            p.id_rol_preparacion, COALESCE((SELECT t.n_estado_preparacion FROM tmp_estados_prev t WHERE t.id_orden_item = oi.id_orden_item), 'PENDIENTE')
        FROM orden_item oi
        JOIN producto p ON p.id_producto = oi.id_producto
        LEFT JOIN orden_item_opcion oio ON oio.id_orden_item = oi.id_orden_item
        LEFT JOIN subcategoria_opcion sco ON sco.id_subcategoria_opcion = oio.id_subcategoria_opcion
        WHERE oi.id_orden = p_id_orden
        GROUP BY oi.id_orden, oi.id_orden_item, oi.id_producto, p.n_nombre_producto, oi.p_cantidad, p.id_rol_preparacion, oi.n_comentario;
        SELECT * FROM orden_preparacion WHERE id_orden = p_id_orden;

    ELSEIF p_tipo_proceso = 3 THEN
        SELECT op.id_orden, o.n_folio_dia, op.id_orden_item, op.id_producto, op.n_nombre_producto, op.p_cantidad, op.n_extras_descripcion, op.n_estado_preparacion, op.t_fecha_registro
        FROM orden_preparacion op
        JOIN orden o ON o.id_orden = op.id_orden
        WHERE op.id_orden = p_id_orden AND op.id_rol_preparacion = p_id_rol AND op.n_estado_preparacion = 'PENDIENTE' AND o.n_estatus_orden = 'PENDIENTE'
        ORDER BY op.id_preparacion;

    ELSEIF p_tipo_proceso = 4 THEN
        SELECT o.id_orden, o.n_folio_dia, o.n_nombre_cliente, o.t_hora_creacion, o.p_total, o.n_estatus_orden,
            o.source, o.wa_phone,
            COALESCE(GROUP_CONCAT(CONCAT(oi.p_cantidad, 'x ', p.n_nombre_producto,
                CASE WHEN ex.extras IS NULL OR ex.extras = '' THEN '' ELSE CONCAT(' (', ex.extras, ')') END)
                ORDER BY oi.id_orden_item SEPARATOR ' | '), '') AS resumen
        FROM orden o
        LEFT JOIN orden_item oi ON oi.id_orden = o.id_orden
        LEFT JOIN producto p ON p.id_producto = oi.id_producto
        LEFT JOIN (
            SELECT oio.id_orden_item,
                GROUP_CONCAT(CONCAT(sco.n_nombre_subcategoria_opciones, ' x', oio.p_cantidad) SEPARATOR ', ') AS extras
            FROM orden_item_opcion oio
            JOIN subcategoria_opcion sco ON sco.id_subcategoria_opcion = oio.id_subcategoria_opcion
            GROUP BY oio.id_orden_item
        ) ex ON ex.id_orden_item = oi.id_orden_item
        WHERE o.n_estatus_orden = 'PENDIENTE'
        GROUP BY o.id_orden, o.n_folio_dia, o.n_nombre_cliente, o.t_hora_creacion, o.p_total, o.n_estatus_orden, o.source, o.wa_phone
        ORDER BY o.t_hora_creacion DESC;

    ELSEIF p_tipo_proceso = 5 THEN
        UPDATE orden SET n_estatus_orden = 'CANCELADA' WHERE id_orden = p_id_orden;
        SELECT p_id_orden AS id_orden, 'CANCELADA' AS estatus;

    ELSEIF p_tipo_proceso = 6 THEN
        UPDATE orden SET n_estatus_orden = 'ABIERTA', id_tipo_pago = NULL WHERE id_orden = p_id_orden;
        SELECT p_id_orden AS id_orden, 'ABIERTA' AS estatus;

    ELSEIF p_tipo_proceso = 7 THEN
        SELECT o.id_orden, o.n_folio_dia, o.t_hora_creacion, o.n_estatus_orden,
               o.source, o.wa_tipo_entrega, o.n_nombre_cliente
        FROM orden o WHERE o.n_estatus_orden = 'PENDIENTE' ORDER BY o.t_hora_creacion ASC;
        SELECT op.id_orden, op.id_orden_item, op.id_producto, op.n_nombre_producto, op.p_cantidad, op.n_extras_descripcion, op.id_rol_preparacion, op.n_estado_preparacion, op.t_fecha_registro
        FROM orden_preparacion op
        JOIN orden o ON o.id_orden = op.id_orden
        WHERE o.n_estatus_orden = 'PENDIENTE'
        ORDER BY op.t_fecha_registro ASC;

    END IF;
END ;;
DELIMITER ;


-- ── VERIFICACION (ejecutar por separado) ────────────────────────
-- Debe traer n_folio_dia con numeros chicos, no el id interno:
-- CALL sp_gestionar_orden(NULL, 7, NULL, NULL);
