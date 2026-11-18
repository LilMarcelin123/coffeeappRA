-- ═══════════════════════════════════════════════════════════════
-- sp_inicia_orden v2 — El Rincon en las Arboledas
-- Fecha: 2026-11-18
--
-- El problema:
--   Para no dejar ordenes vacias regadas, al iniciar una orden se
--   reusa la ultima ABIERTA que no haya llegado a cocina. Pero no se
--   miraba de que dia era. El cierre de la 01:00 solo archiva lo
--   cerrado, asi que una orden que quedo ABIERTA la noche anterior
--   seguia viva y la primera orden del dia nuevo la reusaba: salia
--   con el folio de ayer (el 18/11 arranco en 14 en vez de 1).
--
-- La solucion:
--   Solo se reusa una orden ABIERTA del dia de negocio en curso
--   (01:00 a 01:00). Las de dias anteriores ya no se tocan: la
--   orden nueva nace con folio 1 del dia.
--
-- El resto queda igual que en 2026-09-13_folio_dia.sql.
-- Solo reemplaza el procedimiento: no toca tablas ni datos.
-- Se puede correr en cualquier momento, sin subir codigo.
-- Ejecutar con el cliente de mysql (lleva DELIMITER).
-- ═══════════════════════════════════════════════════════════════


DELIMITER ;;

DROP PROCEDURE IF EXISTS sp_inicia_orden;;

CREATE PROCEDURE sp_inicia_orden(IN VtipoProceso INT)
BEGIN
    DECLARE v_id_orden_reutilizar INT DEFAULT NULL;
    DECLARE v_tiene_pendientes    INT DEFAULT 0;
    DECLARE v_ahora               DATETIME;
    DECLARE v_dia                 DATE;

    IF VtipoProceso = 1 THEN

        SET v_ahora = CONVERT_TZ(NOW(), 'UTC', 'America/Mexico_City');
        SET v_dia   = DATE(v_ahora - INTERVAL 1 HOUR);

        -- Reusar la ultima orden abierta DE HOY que no haya llegado a
        -- cocina: evita dejar ordenes vacias regadas sin arrastrar
        -- el folio de un dia anterior.
        SELECT id_orden
        INTO   v_id_orden_reutilizar
        FROM   orden
        WHERE  n_estatus_orden = 'ABIERTA'
          AND  t_hora_creacion >= TIMESTAMP(v_dia, '01:00:00')
          AND  t_hora_creacion <  TIMESTAMP(v_dia + INTERVAL 1 DAY, '01:00:00')
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

DELIMITER ;


-- ── VERIFICACION (ejecutar por separado) ────────────────────────
-- Ordenes abiertas que quedaron de dias anteriores:
-- SELECT id_orden, n_folio_dia, t_hora_creacion, p_total
-- FROM orden
-- WHERE n_estatus_orden = 'ABIERTA'
--   AND t_hora_creacion < TIMESTAMP(DATE(CONVERT_TZ(NOW(),'UTC','America/Mexico_City') - INTERVAL 1 HOUR), '01:00:00');
