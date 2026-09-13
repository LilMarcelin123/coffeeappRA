-- ═══════════════════════════════════════════════════════════════
-- sp_cierre_dia v3 — El Rincon en las Arboledas
-- Fecha: 2026-09-13 (v3: el archivo conserva el folio del dia)
--
-- Cambios respecto a la version anterior:
--   · Recibe el dia de negocio. Ya no archiva "todo lo que encuentre":
--     solo las ordenes creadas entre las 01:00 de ese dia y las 01:00
--     del siguiente. Si un dia no se cierra, no se revuelve con el otro.
--   · Repetible: archiva solo lo que aun no esta archivado de ese dia.
--     En El Rincon cortan varias veces al dia, asi que un dia puede
--     tener varios cierres; el de la 01:00 recoge lo que quedo.
--   · El archivo conserva nombre del cliente, canal y tipo de consumo.
--   · Las ordenes PENDIENTES no se archivan ni se borran: siguen vivas.
--   · Ya no reinicia los AUTO_INCREMENT (era un ALTER dentro de una
--     transaccion, que en MySQL la cierra a medias sin avisar).
--
-- Procesos:
--   1 = ejecutar cierre       (Vd_fecha_negocio, Vusername, Vobservaciones)
--       Archiva las ordenes CERRADAS de ese dia que sigan vivas.
--       Si no queda ninguna, no genera cierre y avisa.
--   2 = listar cierres
--   3 = detalle por id_cierre (Vid_cierre)
--   4 = detalle por fecha     (Vd_fecha_negocio)
--
-- Ejecutar con el cliente de mysql, NO en la consola web de Railway:
-- lleva DELIMITER y la consola no lo entiende.
--   railway run --service MySQL -- sh -c 'mysql -h $RAILWAY_TCP_PROXY_DOMAIN \
--     -P $RAILWAY_TCP_PROXY_PORT -u $MYSQLUSER -p$MYSQLPASSWORD \
--     $MYSQLDATABASE < src/main/resources/db/2026-09-12_sp_cierre_dia_v2.sql'
-- ═══════════════════════════════════════════════════════════════

DROP PROCEDURE IF EXISTS sp_cierre_dia;

DELIMITER ;;

CREATE PROCEDURE sp_cierre_dia(
    IN Vp_tipo_proceso   TINYINT,
    IN Vusername         VARCHAR(255),
    IN Vobservaciones    TEXT,
    IN Vid_cierre        INT,
    IN Vd_fecha_negocio  DATE
)
BEGIN
    DECLARE v_id_cierre      INT;
    DECLARE v_fecha          DATE;
    DECLARE v_ini            DATETIME;
    DECLARE v_fin            DATETIME;
    DECLARE v_ahora          DATETIME;
    DECLARE v_total_ordenes  INT           DEFAULT 0;
    DECLARE v_total_general  DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_total_efectivo DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_total_tarjeta  DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_total_otro     DECIMAL(10,2) DEFAULT 0.00;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT -1 AS resultado,
               'Error interno al ejecutar el cierre' AS mensaje,
               NULL AS id_cierre,
               NULL AS d_fecha_negocio;
    END;

    -- ═══════════════════════════════════════════════════════════
    -- 1 · EJECUTAR EL CIERRE DE UN DIA
    -- ═══════════════════════════════════════════════════════════
    IF Vp_tipo_proceso = 1 THEN

        SET v_ahora = CONVERT_TZ(NOW(), 'UTC', 'America/Mexico_City');

        -- Sin fecha explicita, se cierra el dia que acaba de terminar.
        -- A la 01:00 del 04, restar una hora cae en el 03.
        SET v_fecha = COALESCE(Vd_fecha_negocio, DATE(v_ahora - INTERVAL 1 HOUR));

        -- El dia de negocio: de las 01:00 a las 01:00 del siguiente
        SET v_ini = TIMESTAMP(v_fecha, '01:00:00');
        SET v_fin = v_ini + INTERVAL 1 DAY;

        SELECT COUNT(*) INTO v_total_ordenes
        FROM orden
        WHERE n_estatus_orden = 'CERRADA'
          AND t_hora_creacion >= v_ini
          AND t_hora_creacion <  v_fin;

        IF v_total_ordenes = 0 THEN
            -- Dia sin ventas (lunes, por ejemplo): no se registra
            -- cierre, para que no ensucie los promedios con ceros.
            SELECT 0 AS resultado,
                   CONCAT('Sin ordenes cerradas el ',
                          DATE_FORMAT(v_fecha, '%d/%m/%Y'),
                          '. No se genero cierre.') AS mensaje,
                   NULL AS id_cierre,
                   v_fecha AS d_fecha_negocio;
        ELSE
            START TRANSACTION;

            -- Las ordenes del dia, una sola vez, para no repetir
            -- el mismo filtro en cada insercion.
            DROP TEMPORARY TABLE IF EXISTS tmp_ordenes_cierre;
            CREATE TEMPORARY TABLE tmp_ordenes_cierre (
                id_orden INT NOT NULL PRIMARY KEY
            ) ENGINE = MEMORY;

            INSERT INTO tmp_ordenes_cierre (id_orden)
            SELECT id_orden
            FROM orden
            WHERE n_estatus_orden = 'CERRADA'
              AND t_hora_creacion >= v_ini
              AND t_hora_creacion <  v_fin;

            SELECT COALESCE(SUM(o.p_total), 0) INTO v_total_general
            FROM orden o INNER JOIN tmp_ordenes_cierre t ON t.id_orden = o.id_orden;

            SELECT COALESCE(SUM(o.p_total), 0) INTO v_total_efectivo
            FROM orden o INNER JOIN tmp_ordenes_cierre t ON t.id_orden = o.id_orden
            WHERE o.id_tipo_pago = 1;

            SELECT COALESCE(SUM(o.p_total), 0) INTO v_total_tarjeta
            FROM orden o INNER JOIN tmp_ordenes_cierre t ON t.id_orden = o.id_orden
            WHERE o.id_tipo_pago = 2;

            SELECT COALESCE(SUM(o.p_total), 0) INTO v_total_otro
            FROM orden o INNER JOIN tmp_ordenes_cierre t ON t.id_orden = o.id_orden
            WHERE o.id_tipo_pago IS NOT NULL
              AND o.id_tipo_pago NOT IN (1, 2);

            INSERT INTO hist_cierre_dia (
                d_fecha_negocio, t_fecha_cierre, n_total_ordenes,
                p_total_general, p_total_efectivo, p_total_tarjeta,
                p_total_otro, n_usuario_cierre, n_observaciones
            ) VALUES (
                v_fecha, v_ahora, v_total_ordenes,
                v_total_general, v_total_efectivo, v_total_tarjeta,
                v_total_otro, Vusername, Vobservaciones
            );

            SET v_id_cierre = LAST_INSERT_ID();

            -- ── Ordenes ────────────────────────────────────
            INSERT INTO hist_orden (
                id_cierre, id_orden, n_folio_dia, n_nombre_cliente, t_hora_creacion,
                p_total, n_estatus_orden, id_tipo_pago, n_tipo_pago,
                source, n_tipo_consumo, resumen_items, t_fecha_cierre
            )
            SELECT
                v_id_cierre, o.id_orden, o.n_folio_dia, o.n_nombre_cliente, o.t_hora_creacion,
                o.p_total, o.n_estatus_orden, o.id_tipo_pago,
                COALESCE(tp.n_tipo_pago, 'SIN REGISTRO'),
                o.source, o.n_tipo_consumo,
                COALESCE(GROUP_CONCAT(
                    CONCAT(oi.p_cantidad, 'x ', p.n_nombre_producto)
                    ORDER BY oi.id_orden_item SEPARATOR ' | '), ''),
                v_ahora
            FROM orden o
            INNER JOIN tmp_ordenes_cierre t ON t.id_orden = o.id_orden
            LEFT  JOIN tipo_pago  tp ON tp.id_tipo_pago = o.id_tipo_pago
            LEFT  JOIN orden_item oi ON oi.id_orden     = o.id_orden
            LEFT  JOIN producto   p  ON p.id_producto   = oi.id_producto
            GROUP BY o.id_orden, o.n_folio_dia, o.n_nombre_cliente, o.t_hora_creacion,
                     o.p_total, o.n_estatus_orden, o.id_tipo_pago,
                     tp.n_tipo_pago, o.source, o.n_tipo_consumo;

            -- ── Items ──────────────────────────────────────
            INSERT INTO hist_orden_item (
                id_cierre, id_orden_item, id_orden, id_producto,
                n_nombre_producto, p_cantidad, p_precio_base,
                precio_total, n_comentario, t_fecha_cierre
            )
            SELECT v_id_cierre, oi.id_orden_item, oi.id_orden, oi.id_producto,
                   p.n_nombre_producto, oi.p_cantidad, oi.p_precio_base,
                   oi.precio_total, oi.n_comentario, v_ahora
            FROM orden_item oi
            INNER JOIN tmp_ordenes_cierre t ON t.id_orden = oi.id_orden
            LEFT  JOIN producto p ON p.id_producto = oi.id_producto;

            -- ── Extras ─────────────────────────────────────
            INSERT INTO hist_orden_item_opcion (
                id_cierre, id_orden_item_opcion, id_orden_item,
                id_subcategoria_opcion, p_cantidad,
                p_precio_extra, p_total_precio_extra, t_fecha_cierre
            )
            SELECT v_id_cierre, oio.id_orden_item_opcion, oio.id_orden_item,
                   oio.id_subcategoria_opcion, oio.p_cantidad,
                   oio.p_precio_extra, oio.p_total_precio_extra, v_ahora
            FROM orden_item_opcion oio
            INNER JOIN orden_item oi ON oio.id_orden_item = oi.id_orden_item
            INNER JOIN tmp_ordenes_cierre t ON t.id_orden = oi.id_orden;

            -- ── Preparaciones ──────────────────────────────
            INSERT INTO hist_orden_preparacion (
                id_cierre, id_preparacion, id_orden, id_orden_item,
                id_producto, n_nombre_producto, p_cantidad,
                n_extras_descripcion, id_rol_preparacion,
                n_estado_preparacion, t_fecha_registro, t_fecha_cierre
            )
            SELECT v_id_cierre, op.id_preparacion, op.id_orden, op.id_orden_item,
                   op.id_producto, op.n_nombre_producto, op.p_cantidad,
                   op.n_extras_descripcion, op.id_rol_preparacion,
                   op.n_estado_preparacion, op.t_fecha_registro, v_ahora
            FROM orden_preparacion op
            INNER JOIN tmp_ordenes_cierre t ON t.id_orden = op.id_orden;

            -- ── Limpiar SOLO lo archivado ──────────────────
            -- Las ordenes pendientes y las de otros dias se quedan.
            DELETE op FROM orden_preparacion op
            INNER JOIN tmp_ordenes_cierre t ON t.id_orden = op.id_orden;

            DELETE oio FROM orden_item_opcion oio
            INNER JOIN orden_item oi ON oio.id_orden_item = oi.id_orden_item
            INNER JOIN tmp_ordenes_cierre t ON t.id_orden = oi.id_orden;

            DELETE oi FROM orden_item oi
            INNER JOIN tmp_ordenes_cierre t ON t.id_orden = oi.id_orden;

            DELETE o FROM orden o
            INNER JOIN tmp_ordenes_cierre t ON t.id_orden = o.id_orden;

            DROP TEMPORARY TABLE IF EXISTS tmp_ordenes_cierre;

            COMMIT;

            SELECT 1 AS resultado,
                   CONCAT('Cierre del ', DATE_FORMAT(v_fecha, '%d/%m/%Y'),
                          ': ', v_total_ordenes, ' ordenes, $',
                          FORMAT(v_total_general, 2)) AS mensaje,
                   v_id_cierre AS id_cierre,
                   v_fecha     AS d_fecha_negocio;
        END IF;

    -- ═══════════════════════════════════════════════════════════
    -- 2 · LISTAR CIERRES
    -- ═══════════════════════════════════════════════════════════
    ELSEIF Vp_tipo_proceso = 2 THEN
        SELECT id_cierre, d_fecha_negocio, t_fecha_cierre, n_total_ordenes,
               p_total_general, p_total_efectivo, p_total_tarjeta, p_total_otro,
               n_usuario_cierre, n_observaciones
        FROM hist_cierre_dia
        ORDER BY COALESCE(d_fecha_negocio, DATE(t_fecha_cierre)) DESC, id_cierre DESC;

    -- ═══════════════════════════════════════════════════════════
    -- 3 · DETALLE POR ID · 4 · DETALLE POR FECHA
    -- ═══════════════════════════════════════════════════════════
    ELSEIF Vp_tipo_proceso IN (3, 4) THEN

        IF Vp_tipo_proceso = 4 THEN
            SELECT id_cierre INTO v_id_cierre
            FROM hist_cierre_dia
            WHERE d_fecha_negocio = Vd_fecha_negocio
            LIMIT 1;
        ELSE
            SET v_id_cierre = Vid_cierre;
        END IF;

        SELECT * FROM hist_cierre_dia WHERE id_cierre = v_id_cierre;

        SELECT ho.id_orden,
               ho.n_folio_dia,
               ho.t_hora_creacion AS hora_cierre,
               ho.p_total         AS total,
               ho.n_tipo_pago     AS metodo_pago,
               ho.id_tipo_pago,
               ho.n_nombre_cliente,
               ho.source,
               ho.n_tipo_consumo,
               ho.resumen_items   AS resumen
        FROM hist_orden ho
        WHERE ho.id_cierre = v_id_cierre
        ORDER BY ho.t_hora_creacion DESC;

        SELECT COALESCE(n_tipo_pago, 'SIN REGISTRO') AS metodo_pago,
               COUNT(*) AS total_ordenes,
               COALESCE(SUM(p_total), 0) AS total_monto
        FROM hist_orden
        WHERE id_cierre = v_id_cierre
        GROUP BY id_tipo_pago, n_tipo_pago
        UNION ALL
        SELECT 'TOTAL GENERAL', COUNT(*), COALESCE(SUM(p_total), 0)
        FROM hist_orden
        WHERE id_cierre = v_id_cierre
        ORDER BY metodo_pago;

    END IF;
END ;;

DELIMITER ;
