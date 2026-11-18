-- ═══════════════════════════════════════════════════════════════
-- Apertura de caja — El Rincon en las Arboledas
-- Fecha: 2026-11-18
--
-- Que resuelve:
--   El fondo de caja (el cambio con el que se abre) estaba fijo en
--   sys_config ('caja.fondo' = 450). El 17/11 se abrio con $320 y el
--   arqueo salio $130 mal sin que nadie hubiera tocado nada.
--
--   Desde ahora el fondo lo captura el negocio cada dia, al entrar
--   al sistema despues del corte de la 01:00, junto con el nombre de
--   quien lo registra. Mientras no exista la apertura del dia, el
--   administrador no puede tomar ordenes ni entrar a los modulos.
--
--   La apertura no se edita desde el sistema: el monto es lo que el
--   negocio declaro y queda firmado con nombre, usuario y hora.
--
-- Como queda:
--   apertura_caja → una fila por dia de negocio (UNIQUE)
--   sp_gestion_apertura
--       1 = registrar la apertura del dia en curso
--       2 = consultar la apertura del dia en curso
--
-- sp_gestion_caja v4 (2026-11-18b) toma el fondo de aqui.
-- 'caja.fondo' en sys_config ya no se usa; se deja por si hay que
-- volver atras (rollback/2026-11-18_revertir_apertura_caja.sql).
--
-- Ejecutar con el cliente de mysql (lleva DELIMITER).
-- ═══════════════════════════════════════════════════════════════


CREATE TABLE IF NOT EXISTS apertura_caja (
    id_apertura    INT            NOT NULL AUTO_INCREMENT,
    d_dia_negocio  DATE           NOT NULL,
    p_fondo        DECIMAL(10,2)  NOT NULL,
    n_responsable  VARCHAR(120)   COLLATE utf8mb4_unicode_ci NOT NULL,   -- nombre que escribieron
    n_usuario      VARCHAR(150)   COLLATE utf8mb4_unicode_ci NOT NULL,   -- usuario con sesion
    t_fecha        DATETIME       NOT NULL,                              -- hora de Mexico
    PRIMARY KEY (id_apertura),
    UNIQUE KEY uq_apertura_dia (d_dia_negocio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DELIMITER ;;

DROP PROCEDURE IF EXISTS sp_gestion_apertura;;

CREATE PROCEDURE sp_gestion_apertura(
    IN pa_tipo_proceso TINYINT,
    IN pa_fondo        DECIMAL(10,2),
    IN pa_responsable  VARCHAR(120),
    IN pa_usuario      VARCHAR(150)
)
BEGIN
    DECLARE v_ahora DATETIME;
    DECLARE v_dia   DATE;
    DECLARE v_resp  VARCHAR(120);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        SELECT -1 AS resultado, 'Error interno al registrar la apertura' AS mensaje;
    END;

    -- Mismo dia de negocio que caja y el cierre: de 01:00 a 01:00.
    SET v_ahora = CONVERT_TZ(NOW(), 'UTC', 'America/Mexico_City');
    SET v_dia   = DATE(v_ahora - INTERVAL 1 HOUR);

    -- ═══════════════════════════════════════════════════════════
    -- 1 · REGISTRAR APERTURA DEL DIA
    -- ═══════════════════════════════════════════════════════════
    IF pa_tipo_proceso = 1 THEN

        SET v_resp = TRIM(COALESCE(pa_responsable, ''));

        IF pa_fondo IS NULL OR pa_fondo < 0 THEN
            SELECT 0 AS resultado, 'Captura el fondo de caja (puede ser 0).' AS mensaje;

        ELSEIF pa_fondo > 20000 THEN
            SELECT 0 AS resultado, 'Ese fondo es demasiado alto. Revisa el monto.' AS mensaje;

        ELSEIF CHAR_LENGTH(v_resp) < 3 THEN
            SELECT 0 AS resultado, 'Escribe el nombre de quien registra el fondo.' AS mensaje;

        ELSEIF EXISTS (SELECT 1 FROM apertura_caja WHERE d_dia_negocio = v_dia) THEN
            SELECT 0 AS resultado, 'La caja de hoy ya se abrio.' AS mensaje;

        ELSE
            INSERT INTO apertura_caja (d_dia_negocio, p_fondo, n_responsable, n_usuario, t_fecha)
            VALUES (v_dia, pa_fondo, v_resp, COALESCE(pa_usuario, 'desconocido'), v_ahora);

            SELECT 1 AS resultado,
                   CONCAT('Caja abierta con $', FORMAT(pa_fondo, 2)) AS mensaje,
                   LAST_INSERT_ID() AS id_apertura;
        END IF;

    -- ═══════════════════════════════════════════════════════════
    -- 2 · APERTURA DEL DIA EN CURSO
    --     Siempre devuelve una fila: f_abierta dice si ya hay.
    -- ═══════════════════════════════════════════════════════════
    ELSEIF pa_tipo_proceso = 2 THEN

        SELECT v_dia                                        AS d_dia_negocio,
               DATE_FORMAT(v_dia, '%d/%m/%Y')               AS n_dia,
               IF(a.id_apertura IS NULL, 0, 1)              AS f_abierta,
               a.p_fondo, a.n_responsable, a.n_usuario, a.t_fecha,
               TIME_FORMAT(a.t_fecha, '%H:%i')              AS n_hora
        FROM (SELECT 1) uno
        LEFT JOIN apertura_caja a ON a.d_dia_negocio = v_dia;

    END IF;
END ;;

DELIMITER ;


-- ── VERIFICACION (ejecutar por separado) ────────────────────────
-- CALL sp_gestion_apertura(2, NULL, NULL, NULL);
