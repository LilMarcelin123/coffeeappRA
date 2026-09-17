-- ═══════════════════════════════════════════════════════════════
-- sp_gestion_caja v2 — El Rincon en las Arboledas
-- Fecha: 2026-09-17
--
-- Por que existe esta version:
--   En MySQL el nombre de un parametro de un procedimiento TAPA a la
--   columna que se llama igual. El parametro se llamaba `p_monto` y
--   la columna de caja_movimiento tambien, asi que en el listado de
--   movimientos y en la suma de salidas `p_monto` leia el parametro
--   (NULL en esos procesos) en vez de la columna. El movimiento se
--   guardaba bien con sus $15 y la pantalla lo mostraba en $0.00.
--
--   Los parametros ahora llevan prefijo `pa_`, que no choca con
--   ninguna columna. Java los pasa por posicion, asi que el codigo
--   de la aplicacion no cambia.
--
-- El proceso 3 tambien devuelve n_ordenes_abiertas, para que la
-- pantalla no deje arquear a ciegas con ordenes sin cobrar: ese
-- dinero ya esta fisicamente en la caja pero aun no cuenta como
-- venta, y el arqueo saldria sobrado.
--
-- Las horas y el dia salen ya formateados (n_hora_desde, n_dia):
-- las columnas DATETIME viajan a JSON como milisegundos y el
-- navegador no debe andar recortando ese numero a mano.
--
-- Solo reemplaza el procedimiento: las tablas y los datos no se tocan.
-- Ejecutar con el cliente de mysql (lleva DELIMITER).
-- ═══════════════════════════════════════════════════════════════


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
    IN pa_tipo_proceso TINYINT,
    IN pa_tipo         VARCHAR(10),
    IN pa_categoria    VARCHAR(30),
    IN pa_monto        DECIMAL(10,2),
    IN pa_concepto     VARCHAR(200),
    IN pa_usuario      VARCHAR(150),
    IN pa_desde        DATE,
    IN pa_hasta        DATE,
    IN pa_id           INT
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
    IF pa_tipo_proceso = 1 THEN

        IF pa_monto IS NULL OR pa_monto <= 0 THEN
            SELECT 0 AS resultado, 'El monto debe ser mayor a cero.' AS mensaje;

        ELSEIF pa_tipo NOT IN ('SALIDA', 'ENTRADA') THEN
            SELECT 0 AS resultado, 'Tipo de movimiento invalido.' AS mensaje;

        ELSE
            INSERT INTO caja_movimiento (
                t_fecha, d_dia_negocio, n_tipo, n_categoria,
                p_monto, n_concepto, n_usuario
            ) VALUES (
                v_ahora, v_dia, pa_tipo, COALESCE(pa_categoria, 'OTRO'),
                pa_monto, pa_concepto, pa_usuario
            );

            SELECT 1 AS resultado,
                   CONCAT('Movimiento registrado: ', pa_tipo, ' de $', FORMAT(pa_monto, 2)) AS mensaje,
                   LAST_INSERT_ID() AS id_movimiento;
        END IF;

    -- ═══════════════════════════════════════════════════════════
    -- 2 · MOVIMIENTOS DEL TURNO EN CURSO
    -- ═══════════════════════════════════════════════════════════
    ELSEIF pa_tipo_proceso = 2 THEN

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
    ELSEIF pa_tipo_proceso = 3 THEN

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
               TIME_FORMAT(v_desde, '%H:%i') AS n_hora_desde,
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
                 WHERE d_dia_negocio = v_dia) AS n_arqueos_hoy,
               -- Ordenes sin cobrar. Su dinero ya esta en la caja pero
               -- todavia no cuenta como venta, asi que si se arquea con
               -- ordenes abiertas el conteo sale sobrado. La pantalla
               -- avisa antes de dejar arquear. Solo las del dia en
               -- curso: una orden vieja abandonada dejaria el aviso
               -- prendido siempre y acabarian ignorandolo.
               (SELECT COUNT(*) FROM orden
                 WHERE n_estatus_orden IN ('ABIERTA', 'PENDIENTE')
                   AND DATE(t_hora_creacion - INTERVAL 1 HOUR) = v_dia) AS n_ordenes_abiertas;

    -- ═══════════════════════════════════════════════════════════
    -- 4 · REGISTRAR ARQUEO
    --     pa_monto trae lo contado en caja
    -- ═══════════════════════════════════════════════════════════
    ELSEIF pa_tipo_proceso = 4 THEN

        IF pa_monto IS NULL OR pa_monto < 0 THEN
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
                v_esperado, pa_monto, pa_monto - v_esperado,
                pa_usuario, pa_concepto
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
                       WHEN ABS(pa_monto - v_esperado) < 1 THEN 'Arqueo cuadrado.'
                       WHEN pa_monto > v_esperado THEN CONCAT('Arqueo registrado. Sobran $', FORMAT(pa_monto - v_esperado, 2))
                       ELSE CONCAT('Arqueo registrado. Faltan $', FORMAT(v_esperado - pa_monto, 2))
                   END AS mensaje,
                   v_id_arqueo  AS id_arqueo,
                   v_esperado   AS p_esperado,
                   pa_monto      AS p_contado,
                   pa_monto - v_esperado AS p_diferencia;
        END IF;

    -- ═══════════════════════════════════════════════════════════
    -- 5 · HISTORIAL DE ARQUEOS
    -- ═══════════════════════════════════════════════════════════
    ELSEIF pa_tipo_proceso = 5 THEN

        SELECT id_arqueo, d_dia_negocio, t_fecha_arqueo, t_desde,
               DATE_FORMAT(d_dia_negocio, '%d/%m/%Y')   AS n_dia,
               TIME_FORMAT(t_fecha_arqueo, '%H:%i')     AS n_hora,
               p_fondo, p_venta_efectivo, p_entradas, p_salidas,
               p_esperado, p_contado, p_diferencia,
               n_usuario, n_observaciones
        FROM arqueo_caja
        WHERE d_dia_negocio BETWEEN COALESCE(pa_desde, v_dia) AND COALESCE(pa_hasta, v_dia)
        ORDER BY t_fecha_arqueo DESC;

    -- ═══════════════════════════════════════════════════════════
    -- 6 · MOVIMIENTOS DE UN ARQUEO
    -- ═══════════════════════════════════════════════════════════
    ELSEIF pa_tipo_proceso = 6 THEN

        SELECT id_movimiento, t_fecha,
               TIME_FORMAT(t_fecha, '%H:%i') AS n_hora,
               n_tipo, n_categoria, p_monto, n_concepto, n_usuario
        FROM caja_movimiento
        WHERE id_arqueo = pa_id
        ORDER BY t_fecha;

    -- ═══════════════════════════════════════════════════════════
    -- 7 · BORRAR UN MOVIMIENTO NO ARQUEADO
    --     Lo ya arqueado no se toca: seria alterar un conteo firmado.
    -- ═══════════════════════════════════════════════════════════
    ELSEIF pa_tipo_proceso = 7 THEN

        IF EXISTS (SELECT 1 FROM caja_movimiento WHERE id_movimiento = pa_id AND id_arqueo IS NOT NULL) THEN
            SELECT 0 AS resultado,
                   'Ese movimiento ya entro en un arqueo y no se puede borrar.' AS mensaje;
        ELSE
            DELETE FROM caja_movimiento WHERE id_movimiento = pa_id AND id_arqueo IS NULL;
            SELECT IF(ROW_COUNT() > 0, 1, 0) AS resultado,
                   IF(ROW_COUNT() > 0, 'Movimiento borrado.', 'No se encontro el movimiento.') AS mensaje;
        END IF;

    END IF;
END ;;

DELIMITER ;



-- ── VERIFICACION (ejecutar por separado) ────────────────────────
-- CALL sp_gestion_caja(2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
