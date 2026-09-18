-- ═══════════════════════════════════════════════════════════════
-- sp_gestion_productos — Modulo de Gestion, pantalla de Productos
-- Fecha: 2026-09-18
--
-- Procesos:
--   1 = ranking de productos del periodo
--   2 = peso de cada categoria
--   3 = productos del catalogo sin una sola venta en el periodo
--
-- Por que va en su propio procedimiento y no dentro de
-- sp_gestion_modulo: ese ya carga cuatro procesos de dos pantallas
-- distintas y cada vez que se toca hay que volver a probar todo. Los
-- de productos viven aparte y se pueden cambiar sin arriesgar los
-- cierres.
--
-- El ranking trae unidades y dinero en la misma fila: la pantalla
-- ordena por la que le pidan sin volver a consultar. Casi nunca
-- coinciden, y cada lista lleva a una decision distinta.
--
-- Las fechas son dias de negocio (de 01:00 a 01:00), no dias
-- naturales; v_venta_item ya viene con esa cuenta hecha.
--
-- Ejecutar con el cliente de mysql (lleva DELIMITER).
-- ═══════════════════════════════════════════════════════════════

DELIMITER ;;

DROP PROCEDURE IF EXISTS sp_gestion_productos;;

CREATE PROCEDURE sp_gestion_productos(
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
    -- 1 · RANKING DE PRODUCTOS
    --     Unidades y dinero juntos, mas el cruce aqui/llevar.
    -- ═══════════════════════════════════════════════════════════
    IF pa_tipo_proceso = 1 THEN

        SELECT
            v.n_nombre_producto,
            COALESCE(c.n_nombre_categoria, 'Sin categoria') AS n_categoria,
            SUM(v.p_cantidad)                               AS n_unidades,
            SUM(v.precio_total)                             AS p_importe,
            -- El tipo de consumo se guarda desde hace poco: lo viejo
            -- viene en NULL y no se reparte a ningun lado.
            SUM(CASE WHEN v.n_tipo_consumo = 'AQUI'   THEN v.p_cantidad ELSE 0 END) AS n_aqui,
            SUM(CASE WHEN v.n_tipo_consumo = 'LLEVAR' THEN v.p_cantidad ELSE 0 END) AS n_llevar,
            SUM(CASE WHEN v.n_tipo_consumo IS NULL    THEN v.p_cantidad ELSE 0 END) AS n_sin_dato,
            COUNT(DISTINCT v.id_orden)                      AS n_ordenes
        FROM v_venta_item v
        LEFT JOIN producto  p ON p.id_producto  = v.id_producto
        LEFT JOIN categoria c ON c.id_categoria = p.id_categoria
        WHERE v.d_dia_negocio BETWEEN v_desde AND v_hasta
        GROUP BY v.n_nombre_producto, c.n_nombre_categoria
        ORDER BY n_unidades DESC, p_importe DESC;

    -- ═══════════════════════════════════════════════════════════
    -- 2 · PESO DE CADA CATEGORIA
    -- ═══════════════════════════════════════════════════════════
    ELSEIF pa_tipo_proceso = 2 THEN

        SELECT
            COALESCE(c.n_nombre_categoria, 'Sin categoria') AS n_categoria,
            SUM(v.p_cantidad)                               AS n_unidades,
            SUM(v.precio_total)                             AS p_importe,
            COUNT(DISTINCT v.n_nombre_producto)             AS n_productos
        FROM v_venta_item v
        LEFT JOIN producto  p ON p.id_producto  = v.id_producto
        LEFT JOIN categoria c ON c.id_categoria = p.id_categoria
        WHERE v.d_dia_negocio BETWEEN v_desde AND v_hasta
        GROUP BY c.n_nombre_categoria
        ORDER BY p_importe DESC;

    -- ═══════════════════════════════════════════════════════════
    -- 3 · LO QUE NO SE VENDIO
    --     Solo productos activos: los dados de baja ya no son
    --     noticia. Si uno lleva semanas aqui, sobra en el menu.
    -- ═══════════════════════════════════════════════════════════
    ELSEIF pa_tipo_proceso = 3 THEN

        SELECT
            p.id_producto,
            p.n_nombre_producto,
            COALESCE(c.n_nombre_categoria, 'Sin categoria') AS n_categoria,
            p.p_precio_base
        FROM producto p
        LEFT JOIN categoria c ON c.id_categoria = p.id_categoria
        WHERE p.f_producto_activo = 1
          AND NOT EXISTS (
              SELECT 1 FROM v_venta_item v
              WHERE v.id_producto = p.id_producto
                AND v.d_dia_negocio BETWEEN v_desde AND v_hasta
          )
        ORDER BY c.n_nombre_categoria, p.n_nombre_producto;

    END IF;
END ;;

DELIMITER ;


-- ── VERIFICACION (ejecutar por separado) ────────────────────────
-- CALL sp_gestion_productos(1, '2026-09-01', '2026-09-18');
-- CALL sp_gestion_productos(2, '2026-09-01', '2026-09-18');
-- CALL sp_gestion_productos(3, '2026-09-01', '2026-09-18');
