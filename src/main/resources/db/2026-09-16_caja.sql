-- ═══════════════════════════════════════════════════════════════
-- Caja: movimientos y arqueos — El Rincon en las Arboledas
-- Fecha: 2026-09-16
--
-- Que resuelve:
--   El cierre del dia ya es automatico, asi que la pantalla de
--   Reportes deja de servir para archivar y pasa a servir para lo
--   que de verdad hacen a mano: contar la caja.
--
--   Hoy las salidas de efectivo (proveedores, banco, gastos chicos)
--   se anotan en una libreta. Mientras vivan ahi, cualquier arqueo
--   va a salir faltante y nadie va a saber si falto dinero o si
--   alguien pago las servilletas.
--
-- Como queda:
--   caja_movimiento → la libreta, con quien, cuando y de que
--   arqueo_caja     → el conteo fisico contra lo que dice el sistema
--
--   Lo esperado en caja = fondo + ventas en efectivo + entradas
--                         − salidas
--   La diferencia = contado − esperado. Positiva sobra, negativa
--   falta.
--
-- Nota honesta sobre las ventas en efectivo:
--   Se toman por la hora en que se tomo la orden, no por la hora del
--   cobro, porque el sistema no guarda la segunda. En una cafeteria
--   la diferencia es de minutos, pero si un dia dejan una cuenta
--   abierta varias horas, esa venta cae en el turno equivocado.
--
-- Ejecutar con el cliente de mysql (lleva DELIMITER).
-- ═══════════════════════════════════════════════════════════════


-- ── Tabla: la libreta ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caja_movimiento (
    id_movimiento  INT            NOT NULL AUTO_INCREMENT,
    t_fecha        DATETIME       NOT NULL,
    d_dia_negocio  DATE           NOT NULL,
    n_tipo         VARCHAR(10)    NOT NULL,          -- SALIDA | ENTRADA
    n_categoria    VARCHAR(30)    NOT NULL,          -- PROVEEDOR | BANCO | GASTO | CAMBIO | OTRO
    p_monto        DECIMAL(10,2)  NOT NULL,
    n_concepto     VARCHAR(200)   DEFAULT NULL,
    n_usuario      VARCHAR(150)   NOT NULL,
    id_arqueo      INT            DEFAULT NULL,      -- se sella al arquear
    PRIMARY KEY (id_movimiento),
    KEY idx_mov_dia (d_dia_negocio),
    KEY idx_mov_arqueo (id_arqueo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── Tabla: el conteo ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS arqueo_caja (
    id_arqueo         INT            NOT NULL AUTO_INCREMENT,
    t_fecha_arqueo    DATETIME       NOT NULL,
    d_dia_negocio     DATE           NOT NULL,
    t_desde           DATETIME       NOT NULL,       -- desde el arqueo anterior
    p_fondo           DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    p_venta_efectivo  DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    p_entradas        DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    p_salidas         DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    p_esperado        DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    p_contado         DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    p_diferencia      DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    n_usuario         VARCHAR(150)   NOT NULL,
    n_observaciones   TEXT,
    PRIMARY KEY (id_arqueo),
    KEY idx_arqueo_dia (d_dia_negocio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── Fondo de caja, configurable ─────────────────────────────────
-- Vive en sys_config y no en el codigo: el dia que abran con otro
-- monto se cambia aqui y ya.
INSERT INTO sys_config (clave, valor, descripcion)
SELECT 'caja.fondo', '450.00', 'Fondo de caja con el que se abre el turno'
FROM   DUAL
WHERE  NOT EXISTS (SELECT 1 FROM sys_config WHERE clave = 'caja.fondo');


DELIMITER ;;

-- ═══════════════════════════════════════════════════════════════
-- sp_gestion_caja
--
--   1 = registrar movimiento
--   2 = movimientos del turno en curso
--   3 = resumen del turno en curso (lo que deberia haber)
--   4 = registrar arqueo
--   5 = historial de arqueos
--   6 = movimientos de un arqueo
--   7 = borrar un movimiento que aun no se arquea
-- ═══════════════════════════════════════════════════════════════
DROP PROCEDURE IF EXISTS sp_gestion_caja;;

CREATE PROCEDURE sp_gestion_caja(
    IN p_tipo_proceso TINYINT,
    IN p_tipo         VARCHAR(10),
    IN p_categoria    VARCHAR(30),
    IN p_monto        DECIMAL(10,2),
    IN p_concepto     VARCHAR(200),
    IN p_usuario      VARCHAR(150),
    IN p_desde        DATE,
    IN p_hasta        DATE,
    IN p_id           INT
)
BEGIN
    DECLARE v_ahora     DATETIME;
    DECLARE v_dia       DATE;
    DECLARE v_desde     DATETIME;
    DECLARE v_fondo     DECIMAL(10,2);
    DECLARE v_venta     DECIMAL(10,2);
    DECLARE v_entradas  DECIMAL(10,2);
    DECLARE v_salidas   DECIMAL(10,2);
    DECLARE v_esperado  DECIMAL(10,2);
    DECLARE v_id_arqueo INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT -1 AS resultado, 'Error interno en caja' AS mensaje;
    END;

    SET v_ahora = CONVERT_TZ(NOW(), 'UTC', 'America/Mexico_City');
    SET v_dia   = DATE(v_ahora - INTERVAL 1 HOUR);

    -- El turno en curso empieza donde termino el ultimo arqueo; si no
    -- hay ninguno hoy, empieza con el dia de negocio, a la 01:00.
    SELECT COALESCE(MAX(t_fecha_arqueo), TIMESTAMP(v_dia, '01:00:00'))
    INTO   v_desde
    FROM   arqueo_caja
    WHERE  d_dia_negocio = v_dia;

    SELECT COALESCE(MAX(CAST(valor AS DECIMAL(10,2))), 0)
    INTO   v_fondo
    FROM   sys_config
    WHERE  clave = 'caja.fondo';

    -- ═══════════════════════════════════════════════════════════
    -- 1 · REGISTRAR MOVIMIENTO
    -- ═══════════════════════════════════════════════════════════
    IF p_tipo_proceso = 1 THEN

        IF p_monto IS NULL OR p_monto <= 0 THEN
            SELECT 0 AS resultado, 'El monto debe ser mayor a cero.' AS mensaje;

        ELSEIF p_tipo NOT IN ('SALIDA', 'ENTRADA') THEN
            SELECT 0 AS resultado, 'Tipo de movimiento invalido.' AS mensaje;

        ELSE
            INSERT INTO caja_movimiento (
                t_fecha, d_dia_negocio, n_tipo, n_categoria,
                p_monto, n_concepto, n_usuario
            ) VALUES (
                v_ahora, v_dia, p_tipo, COALESCE(p_categoria, 'OTRO'),
                p_monto, p_concepto, p_usuario
            );

            SELECT 1 AS resultado,
                   CONCAT('Movimiento registrado: ', p_tipo, ' de $', FORMAT(p_monto, 2)) AS mensaje,
                   LAST_INSERT_ID() AS id_movimiento;
        END IF;

    -- ═══════════════════════════════════════════════════════════
    -- 2 · MOVIMIENTOS DEL TURNO EN CURSO
    -- ═══════════════════════════════════════════════════════════
    ELSEIF p_tipo_proceso = 2 THEN

        SELECT id_movimiento, t_fecha,
               TIME_FORMAT(t_fecha, '%H:%i') AS n_hora,
               n_tipo, n_categoria, p_monto, n_concepto, n_usuario
        FROM caja_movimiento
        WHERE id_arqueo IS NULL
          AND t_fecha >= v_desde
        ORDER BY t_fecha DESC;

    -- ═══════════════════════════════════════════════════════════
    -- 3 · RESUMEN DEL TURNO EN CURSO
    -- ═══════════════════════════════════════════════════════════
    ELSEIF p_tipo_proceso = 3 THEN

        SELECT COALESCE(SUM(p_total), 0) INTO v_venta
        FROM v_venta_orden
        WHERE id_tipo_pago = 1
          AND t_hora_creacion >= v_desde;

        SELECT COALESCE(SUM(CASE WHEN n_tipo = 'ENTRADA' THEN p_monto END), 0),
               COALESCE(SUM(CASE WHEN n_tipo = 'SALIDA'  THEN p_monto END), 0)
        INTO   v_entradas, v_salidas
        FROM   caja_movimiento
        WHERE  id_arqueo IS NULL
          AND  t_fecha >= v_desde;

        SET v_esperado = v_fondo + v_venta + v_entradas - v_salidas;

        SELECT v_desde     AS t_desde,
               v_ahora     AS t_ahora,
               v_dia       AS d_dia_negocio,
               v_fondo     AS p_fondo,
               v_venta     AS p_venta_efectivo,
               v_entradas  AS p_entradas,
               v_salidas   AS p_salidas,
               v_esperado  AS p_esperado,
               (SELECT COUNT(*) FROM caja_movimiento
                 WHERE id_arqueo IS NULL AND t_fecha >= v_desde) AS n_movimientos,
               (SELECT COUNT(*) FROM arqueo_caja
                 WHERE d_dia_negocio = v_dia) AS n_arqueos_hoy;

    -- ═══════════════════════════════════════════════════════════
    -- 4 · REGISTRAR ARQUEO
    --     p_monto trae lo contado en caja
    -- ═══════════════════════════════════════════════════════════
    ELSEIF p_tipo_proceso = 4 THEN

        IF p_monto IS NULL OR p_monto < 0 THEN
            SELECT 0 AS resultado, 'Captura cuanto dinero hay en caja.' AS mensaje, NULL AS id_arqueo;
        ELSE
            START TRANSACTION;

            SELECT COALESCE(SUM(p_total), 0) INTO v_venta
            FROM v_venta_orden
            WHERE id_tipo_pago = 1
              AND t_hora_creacion >= v_desde;

            SELECT COALESCE(SUM(CASE WHEN n_tipo = 'ENTRADA' THEN p_monto END), 0),
                   COALESCE(SUM(CASE WHEN n_tipo = 'SALIDA'  THEN p_monto END), 0)
            INTO   v_entradas, v_salidas
            FROM   caja_movimiento
            WHERE  id_arqueo IS NULL
              AND  t_fecha >= v_desde;

            SET v_esperado = v_fondo + v_venta + v_entradas - v_salidas;

            INSERT INTO arqueo_caja (
                t_fecha_arqueo, d_dia_negocio, t_desde,
                p_fondo, p_venta_efectivo, p_entradas, p_salidas,
                p_esperado, p_contado, p_diferencia,
                n_usuario, n_observaciones
            ) VALUES (
                v_ahora, v_dia, v_desde,
                v_fondo, v_venta, v_entradas, v_salidas,
                v_esperado, p_monto, p_monto - v_esperado,
                p_usuario, p_concepto
            );

            SET v_id_arqueo = LAST_INSERT_ID();

            -- Sellar los movimientos: ya quedaron dentro de este arqueo
            -- y no pueden volver a contarse ni editarse.
            UPDATE caja_movimiento
            SET    id_arqueo = v_id_arqueo
            WHERE  id_arqueo IS NULL
              AND  t_fecha >= v_desde;

            COMMIT;

            SELECT 1 AS resultado,
                   CASE
                       WHEN ABS(p_monto - v_esperado) < 1 THEN 'Arqueo cuadrado.'
                       WHEN p_monto > v_esperado THEN CONCAT('Arqueo registrado. Sobran $', FORMAT(p_monto - v_esperado, 2))
                       ELSE CONCAT('Arqueo registrado. Faltan $', FORMAT(v_esperado - p_monto, 2))
                   END AS mensaje,
                   v_id_arqueo  AS id_arqueo,
                   v_esperado   AS p_esperado,
                   p_monto      AS p_contado,
                   p_monto - v_esperado AS p_diferencia;
        END IF;

    -- ═══════════════════════════════════════════════════════════
    -- 5 · HISTORIAL DE ARQUEOS
    -- ═══════════════════════════════════════════════════════════
    ELSEIF p_tipo_proceso = 5 THEN

        SELECT id_arqueo, d_dia_negocio, t_fecha_arqueo, t_desde,
               TIME_FORMAT(t_fecha_arqueo, '%H:%i') AS n_hora,
               p_fondo, p_venta_efectivo, p_entradas, p_salidas,
               p_esperado, p_contado, p_diferencia,
               n_usuario, n_observaciones
        FROM arqueo_caja
        WHERE d_dia_negocio BETWEEN COALESCE(p_desde, v_dia) AND COALESCE(p_hasta, v_dia)
        ORDER BY t_fecha_arqueo DESC;

    -- ═══════════════════════════════════════════════════════════
    -- 6 · MOVIMIENTOS DE UN ARQUEO
    -- ═══════════════════════════════════════════════════════════
    ELSEIF p_tipo_proceso = 6 THEN

        SELECT id_movimiento, t_fecha,
               TIME_FORMAT(t_fecha, '%H:%i') AS n_hora,
               n_tipo, n_categoria, p_monto, n_concepto, n_usuario
        FROM caja_movimiento
        WHERE id_arqueo = p_id
        ORDER BY t_fecha;

    -- ═══════════════════════════════════════════════════════════
    -- 7 · BORRAR UN MOVIMIENTO NO ARQUEADO
    --     Lo ya arqueado no se toca: seria alterar un conteo firmado.
    -- ═══════════════════════════════════════════════════════════
    ELSEIF p_tipo_proceso = 7 THEN

        IF EXISTS (SELECT 1 FROM caja_movimiento WHERE id_movimiento = p_id AND id_arqueo IS NOT NULL) THEN
            SELECT 0 AS resultado,
                   'Ese movimiento ya entro en un arqueo y no se puede borrar.' AS mensaje;
        ELSE
            DELETE FROM caja_movimiento WHERE id_movimiento = p_id AND id_arqueo IS NULL;
            SELECT IF(ROW_COUNT() > 0, 1, 0) AS resultado,
                   IF(ROW_COUNT() > 0, 'Movimiento borrado.', 'No se encontro el movimiento.') AS mensaje;
        END IF;

    END IF;
END ;;

DELIMITER ;


-- ── VERIFICACION (ejecutar por separado) ────────────────────────
-- CALL sp_gestion_caja(3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
