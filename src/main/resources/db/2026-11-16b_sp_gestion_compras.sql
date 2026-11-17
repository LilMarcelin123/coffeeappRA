-- ═══════════════════════════════════════════════════════════════
-- sp_gestion_compras v1 — El Rincon en las Arboledas
-- Fecha: 2026-11-16
--
-- Compras del dia: alta rapida desde Inicio y el condensado del dia
-- que se ve en Caja (Reportes). Requiere 2026-11-16_compras.sql.
--
-- Una compra de CAJA se anota tambien como SALIDA en caja_movimiento
-- (categoria COMPRA), en la misma transaccion. Asi el arqueo
-- (sp_gestion_caja) la descuenta sin saber que existen las compras,
-- y "cuanto deberia haber" se sigue calculando en un solo lugar.
--
-- Mismas reglas que caja:
--   · Hora de Mexico; el dia de negocio corre de 01:00 a 01:00.
--   · resultado 1 = hecho · 0 = rechazo con motivo · -1 = falla.
--   · Lo que ya entro en un arqueo no se puede deshacer.
--
-- Solo crea el procedimiento. Ejecutar con el cliente de mysql
-- (lleva DELIMITER).
-- ═══════════════════════════════════════════════════════════════


DELIMITER ;;

-- ═══════════════════════════════════════════════════════════════
-- sp_gestion_compras
--
--   1 = registrar compra
--   2 = compras de un dia de negocio (pa_dia; sin dia, hoy)
--   3 = cancelar compra (pa_id)
--   4 = condensado del dia: venta, compras y resultado (pa_dia)
-- ═══════════════════════════════════════════════════════════════
DROP PROCEDURE IF EXISTS sp_gestion_compras;;

CREATE PROCEDURE sp_gestion_compras(
    IN pa_tipo_proceso   TINYINT,
    IN pa_concepto       VARCHAR(200),
    IN pa_monto          DECIMAL(10,2),
    IN pa_origen         VARCHAR(10),
    IN pa_origen_detalle VARCHAR(100),
    IN pa_usuario        VARCHAR(150),
    IN pa_dia            DATE,
    IN pa_id             INT
)
BEGIN
    DECLARE v_ahora       DATETIME;
    DECLARE v_hoy         DATE;
    DECLARE v_dia         DATE;
    DECLARE v_concepto    VARCHAR(200);
    DECLARE v_origen      VARCHAR(10);
    DECLARE v_detalle     VARCHAR(100);
    DECLARE v_id_mov      INT;
    DECLARE v_id_compra   INT;
    DECLARE v_activo      INT;
    DECLARE v_arqueada    INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT -1 AS resultado, 'Error interno en compras' AS mensaje;
    END;

    SET v_ahora = CONVERT_TZ(NOW(), 'UTC', 'America/Mexico_City');
    SET v_hoy   = DATE(v_ahora - INTERVAL 1 HOUR);
    SET v_dia   = COALESCE(pa_dia, v_hoy);

    -- ═══════════════════════════════════════════════════════════
    -- 1 · REGISTRAR COMPRA
    -- ═══════════════════════════════════════════════════════════
    IF pa_tipo_proceso = 1 THEN

        SET v_concepto = NULLIF(TRIM(pa_concepto), '');
        SET v_origen   = UPPER(TRIM(COALESCE(pa_origen, '')));
        SET v_detalle  = NULLIF(TRIM(pa_origen_detalle), '');

        IF pa_monto IS NULL OR pa_monto <= 0 THEN
            SELECT 0 AS resultado, 'El monto debe ser mayor a cero.' AS mensaje;

        ELSEIF v_concepto IS NULL THEN
            SELECT 0 AS resultado, 'Escribe qué se compró.' AS mensaje;

        ELSEIF v_origen NOT IN ('CAJA', 'FUERA') THEN
            SELECT 0 AS resultado, 'Indica con qué se pagó la compra.' AS mensaje;

        ELSEIF v_origen = 'FUERA' AND v_detalle IS NULL THEN
            SELECT 0 AS resultado, 'Escribe de dónde salió el dinero.' AS mensaje;

        ELSE
            START TRANSACTION;

            SET v_id_mov = NULL;

            IF v_origen = 'CAJA' THEN
                INSERT INTO caja_movimiento (
                    t_fecha, d_dia_negocio, n_tipo, n_categoria,
                    p_monto, n_concepto, n_usuario
                ) VALUES (
                    v_ahora, v_hoy, 'SALIDA', 'COMPRA',
                    pa_monto, v_concepto, pa_usuario
                );
                SET v_id_mov = LAST_INSERT_ID();
                -- El detalle solo aplica a lo pagado fuera de caja.
                SET v_detalle = NULL;
            END IF;

            INSERT INTO compra (
                t_fecha, d_dia_negocio, n_concepto, p_monto,
                n_origen_pago, n_origen_detalle, id_movimiento, n_usuario
            ) VALUES (
                v_ahora, v_hoy, v_concepto, pa_monto,
                v_origen, v_detalle, v_id_mov, pa_usuario
            );
            SET v_id_compra = LAST_INSERT_ID();

            COMMIT;

            SELECT 1 AS resultado,
                   CONCAT('Compra anotada: $', FORMAT(pa_monto, 2),
                          IF(v_origen = 'CAJA', ' (salió de caja)', ' (fuera de caja)')) AS mensaje,
                   v_id_compra AS id_compra;
        END IF;

    -- ═══════════════════════════════════════════════════════════
    -- 2 · COMPRAS DE UN DIA
    --     f_arqueada: su salida ya entro en un arqueo; ya no se
    --     puede cancelar.
    -- ═══════════════════════════════════════════════════════════
    ELSEIF pa_tipo_proceso = 2 THEN

        SELECT c.id_compra,
               c.d_dia_negocio,
               TIME_FORMAT(c.t_fecha, '%H:%i')               AS n_hora,
               c.n_concepto,
               c.p_monto,
               c.n_origen_pago,
               c.n_origen_detalle,
               c.n_usuario,
               IF(m.id_arqueo IS NULL, 0, 1)                 AS f_arqueada
        FROM compra c
        LEFT JOIN caja_movimiento m ON m.id_movimiento = c.id_movimiento
        WHERE c.d_dia_negocio = v_dia
          AND c.f_activo = 1
        ORDER BY c.t_fecha DESC, c.id_compra DESC;

    -- ═══════════════════════════════════════════════════════════
    -- 3 · CANCELAR COMPRA
    --     Se marca inactiva (no se borra) y, si salio de caja, se
    --     borra su salida para que el arqueo deje de descontarla.
    -- ═══════════════════════════════════════════════════════════
    ELSEIF pa_tipo_proceso = 3 THEN

        SET v_activo   = NULL;
        SET v_arqueada = 0;

        SELECT c.f_activo, c.id_movimiento, IF(m.id_arqueo IS NULL, 0, 1)
        INTO   v_activo, v_id_mov, v_arqueada
        FROM compra c
        LEFT JOIN caja_movimiento m ON m.id_movimiento = c.id_movimiento
        WHERE c.id_compra = pa_id;

        IF v_activo IS NULL THEN
            SELECT 0 AS resultado, 'No se encontró la compra.' AS mensaje;

        ELSEIF v_activo = 0 THEN
            SELECT 0 AS resultado, 'Esa compra ya estaba cancelada.' AS mensaje;

        ELSEIF v_arqueada = 1 THEN
            SELECT 0 AS resultado,
                   'Esa compra ya entró en un arqueo y no se puede cancelar.' AS mensaje;

        ELSE
            START TRANSACTION;

            UPDATE compra
            SET    f_activo          = 0,
                   t_cancelada       = v_ahora,
                   n_usuario_cancela = pa_usuario,
                   id_movimiento     = NULL
            WHERE  id_compra = pa_id;

            IF v_id_mov IS NOT NULL THEN
                DELETE FROM caja_movimiento
                WHERE id_movimiento = v_id_mov
                  AND id_arqueo IS NULL;
            END IF;

            COMMIT;

            SELECT 1 AS resultado, 'Compra cancelada.' AS mensaje;
        END IF;

    -- ═══════════════════════════════════════════════════════════
    -- 4 · CONDENSADO DEL DIA
    --     Lo vendido contra lo comprado. "Cuanto deberia haber en
    --     caja" NO se calcula aqui: vive en sp_gestion_caja (3),
    --     que sabe de turnos y arqueos.
    -- ═══════════════════════════════════════════════════════════
    ELSEIF pa_tipo_proceso = 4 THEN

        SELECT
            v_dia                                            AS d_dia_negocio,
            DATE_FORMAT(v_dia, '%d/%m/%Y')                   AS n_dia,

            COALESCE(v.ordenes, 0)                           AS n_ordenes,
            COALESCE(v.venta, 0)                             AS p_venta_total,
            COALESCE(v.efectivo, 0)                          AS p_venta_efectivo,
            COALESCE(v.tarjeta, 0)                           AS p_venta_tarjeta,
            COALESCE(v.otro, 0)                              AS p_venta_otro,

            COALESCE(c.n, 0)                                 AS n_compras,
            COALESCE(c.caja, 0)                              AS p_compras_caja,
            COALESCE(c.fuera, 0)                             AS p_compras_fuera,
            COALESCE(c.caja, 0) + COALESCE(c.fuera, 0)       AS p_compras_total,

            COALESCE(m.entradas, 0)                          AS p_otras_entradas,
            COALESCE(m.salidas, 0)                           AS p_otras_salidas,

            COALESCE(v.venta, 0)
              - (COALESCE(c.caja, 0) + COALESCE(c.fuera, 0)) AS p_resultado

        FROM (SELECT 1) x
        LEFT JOIN (
            SELECT COUNT(*)                                                     AS ordenes,
                   SUM(p_total)                                                 AS venta,
                   SUM(CASE WHEN id_tipo_pago = 1 THEN p_total ELSE 0 END)      AS efectivo,
                   SUM(CASE WHEN id_tipo_pago = 2 THEN p_total ELSE 0 END)      AS tarjeta,
                   SUM(CASE WHEN id_tipo_pago IS NULL OR id_tipo_pago NOT IN (1, 2)
                            THEN p_total ELSE 0 END)                            AS otro
            FROM v_venta_orden
            WHERE d_dia_negocio = v_dia
        ) v ON 1 = 1
        LEFT JOIN (
            SELECT COUNT(*)                                                         AS n,
                   SUM(CASE WHEN n_origen_pago = 'CAJA'  THEN p_monto ELSE 0 END)   AS caja,
                   SUM(CASE WHEN n_origen_pago = 'FUERA' THEN p_monto ELSE 0 END)   AS fuera
            FROM compra
            WHERE d_dia_negocio = v_dia
              AND f_activo = 1
        ) c ON 1 = 1
        LEFT JOIN (
            SELECT SUM(CASE WHEN n_tipo = 'ENTRADA' THEN p_monto ELSE 0 END)        AS entradas,
                   SUM(CASE WHEN n_tipo = 'SALIDA'  THEN p_monto ELSE 0 END)        AS salidas
            FROM caja_movimiento
            WHERE d_dia_negocio = v_dia
              AND n_categoria <> 'COMPRA'
        ) m ON 1 = 1;

    ELSE
        SELECT 0 AS resultado, 'Proceso de compras inválido.' AS mensaje;
    END IF;
END ;;

DELIMITER ;



-- ── VERIFICACION (ejecutar por separado) ────────────────────────
-- CALL sp_gestion_compras(1, 'Plátano y pechuga', 234, 'CAJA',  NULL, 'prueba', NULL, NULL);
-- CALL sp_gestion_compras(1, 'Servilletas',       80,  'FUERA', 'Bolsa de Natalia', 'prueba', NULL, NULL);
-- CALL sp_gestion_compras(2, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
-- CALL sp_gestion_compras(4, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
