-- ═══════════════════════════════════════════════════════════════
-- Folio del dia — El Rincon en las Arboledas
-- Fecha: 2026-09-13
--
-- El problema:
--   Antes, el cierre borraba TODAS las ordenes y reiniciaba el
--   contador, asi que cada corte volvia a empezar en la orden 1. Ese
--   borrado tambien se llevaba las ordenes pendientes, y por eso se
--   quito. Al quitarlo se fue tambien el reinicio, y el 12 de
--   septiembre la barra empezo a cantar "orden 26".
--
-- La solucion:
--   Separar dos cosas que hoy son la misma. `id_orden` sigue siendo
--   el identificador interno, unico para siempre, con el que la base
--   y los reportes amarran todo. `n_folio_dia` es lo que se ve en
--   pantalla y se le canta al cliente: empieza en 1 cada dia de
--   negocio (de 01:00 a 01:00).
--
--   Reiniciar el identificador interno seria volver a reusar numeros,
--   que es justo como se pierden ordenes y se cruzan los historicos.
--
-- Ejecutar con el cliente de mysql (lleva DELIMITER).
-- ═══════════════════════════════════════════════════════════════


-- ── PASO 1 · La columna, en operacion y en el archivo ───────────
ALTER TABLE orden      ADD COLUMN n_folio_dia INT NULL DEFAULT NULL;
ALTER TABLE hist_orden ADD COLUMN n_folio_dia INT NULL DEFAULT NULL;


-- ── PASO 2 · Rellenar el historico ──────────────────────────────
-- Se numera cada dia por hora de creacion, que es el orden en que
-- realmente se tomaron. Asi la Bitacora de meses pasados tambien
-- muestra folios coherentes.
UPDATE hist_orden ho
JOIN (
    SELECT id_hist_orden,
           ROW_NUMBER() OVER (
               PARTITION BY DATE(t_hora_creacion - INTERVAL 1 HOUR)
               ORDER BY t_hora_creacion, id_orden
           ) AS folio
    FROM hist_orden
) x ON x.id_hist_orden = ho.id_hist_orden
SET ho.n_folio_dia = x.folio;


-- ── PASO 3 · Rellenar lo que sigue vivo ─────────────────────────
-- Continuan despues del ultimo folio que ya tenga ese dia en el
-- archivo, para que no se repitan numeros dentro del mismo dia.
UPDATE orden o
JOIN (
    SELECT o2.id_orden,
           COALESCE(h.tope, 0) + ROW_NUMBER() OVER (
               PARTITION BY DATE(o2.t_hora_creacion - INTERVAL 1 HOUR)
               ORDER BY o2.t_hora_creacion, o2.id_orden
           ) AS folio
    FROM orden o2
    LEFT JOIN (
        SELECT DATE(t_hora_creacion - INTERVAL 1 HOUR) AS dia,
               MAX(n_folio_dia) AS tope
        FROM hist_orden
        GROUP BY DATE(t_hora_creacion - INTERVAL 1 HOUR)
    ) h ON h.dia = DATE(o2.t_hora_creacion - INTERVAL 1 HOUR)
) x ON x.id_orden = o.id_orden
SET o.n_folio_dia = x.folio;


-- ── PASO 4 · Busqueda por folio ─────────────────────────────────
CREATE INDEX idx_orden_folio ON orden (n_folio_dia);


DELIMITER ;;

-- ═══════════════════════════════════════════════════════════════
-- sp_inicia_orden: la orden nace con su folio
--
-- El folio sale del mayor del dia, mirando tanto lo vivo como lo ya
-- archivado: en El Rincon cortan varias veces al dia, asi que la
-- mitad del dia puede estar en el archivo cuando se toma la orden
-- siguiente.
-- ═══════════════════════════════════════════════════════════════
DROP PROCEDURE IF EXISTS sp_inicia_orden;;

CREATE PROCEDURE sp_inicia_orden(IN VtipoProceso INT)
BEGIN
    DECLARE v_id_orden_reutilizar INT DEFAULT NULL;
    DECLARE v_tiene_pendientes    INT DEFAULT 0;
    DECLARE v_ahora               DATETIME;
    DECLARE v_dia                 DATE;

    IF VtipoProceso = 1 THEN

        -- Reusar la ultima orden abierta que no haya llegado a cocina,
        -- igual que antes: evita dejar ordenes vacias regadas.
        SELECT id_orden
        INTO   v_id_orden_reutilizar
        FROM   orden
        WHERE  n_estatus_orden = 'ABIERTA'
        ORDER  BY t_hora_creacion DESC
        LIMIT  1;

        IF v_id_orden_reutilizar IS NOT NULL THEN
            SELECT COUNT(*)
            INTO   v_tiene_pendientes
            FROM   orden_preparacion
            WHERE  id_orden             = v_id_orden_reutilizar
              AND  n_estado_preparacion = 'PENDIENTE';

            IF v_tiene_pendientes > 0 THEN
                SET v_id_orden_reutilizar = NULL;
            END IF;
        END IF;

        IF v_id_orden_reutilizar IS NOT NULL THEN
            SELECT v_id_orden_reutilizar AS id_orden;
        ELSE
            SET v_ahora = CONVERT_TZ(NOW(), 'UTC', 'America/Mexico_City');
            SET v_dia   = DATE(v_ahora - INTERVAL 1 HOUR);

            INSERT INTO orden (t_hora_creacion, p_total, n_estatus_orden, n_folio_dia)
            SELECT v_ahora, 0.00, 'ABIERTA', COALESCE(MAX(f), 0) + 1
            FROM (
                SELECT MAX(n_folio_dia) AS f
                FROM orden
                WHERE DATE(t_hora_creacion - INTERVAL 1 HOUR) = v_dia
                UNION ALL
                SELECT MAX(n_folio_dia)
                FROM hist_orden
                WHERE DATE(t_hora_creacion - INTERVAL 1 HOUR) = v_dia
            ) tope;

            SELECT LAST_INSERT_ID() AS id_orden;
        END IF;
    END IF;
END ;;


-- ═══════════════════════════════════════════════════════════════
-- sp_gestionar_orden: el folio viaja a las pantallas
--   proceso 3 → cocina
--   proceso 4 → ordenes pendientes
-- El resto del procedimiento queda igual.
-- ═══════════════════════════════════════════════════════════════
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
        SELECT o.id_orden, o.t_hora_creacion, o.n_estatus_orden, o.source, o.wa_tipo_entrega, o.n_nombre_cliente
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
-- Folios del dia en curso, que deben ir de 1 en adelante:
-- SELECT id_orden, n_folio_dia, t_hora_creacion, n_estatus_orden
-- FROM orden
-- ORDER BY n_folio_dia;
--
-- Que ningun dia tenga folios repetidos:
-- SELECT dia, n_folio_dia, COUNT(*) FROM (
--     SELECT DATE(t_hora_creacion - INTERVAL 1 HOUR) dia, n_folio_dia FROM orden
--     UNION ALL
--     SELECT DATE(t_hora_creacion - INTERVAL 1 HOUR), n_folio_dia FROM hist_orden
-- ) t GROUP BY dia, n_folio_dia HAVING COUNT(*) > 1;
