-- ─────────────────────────────────────────────────────────────
--  Semilla del ambiente DEMO (proyecto daedax-demo)
--
--  Se corre UNA vez, despues de cargar la estructura y los
--  catalogos. No lleva ventas, ni arqueos, ni clientes: el demo
--  se llena en vivo frente al prospecto, y asi cada
--  demostracion empieza limpia.
--
--  Todo es idempotente (INSERT ... WHERE NOT EXISTS): correrlo
--  dos veces no duplica nada. Importa, porque TABLE_ROWS de
--  InnoDB es estimado y no sirve para saber que falta.
--
--  NO correr contra produccion ni contra staging.
-- ─────────────────────────────────────────────────────────────

-- ── Red de seguridad ─────────────────────────────────────────
-- Las tres bases de Railway se llaman `railway`, asi que el
-- nombre no distingue nada. El candado de verdad es este: el
-- demo no tiene historial de ventas. Si lo tiene, estamos en la
-- terminal equivocada y el script truena antes de escribir
-- (mysql aborta en el primer error salvo que le pases --force).
SET @ventas := (SELECT COUNT(*) FROM hist_orden);
SET @candado := IF(@ventas = 0,
    'DO 0',
    'SELECT 1 FROM `ALTO__esta_base_tiene_ventas__no_es_el_demo`');
PREPARE candado FROM @candado;
EXECUTE candado;
DEALLOCATE PREPARE candado;


-- ── Usuarios del demo ────────────────────────────────────────
-- Dos cuentas y ya: una de admin para ensenar todo y una de
-- operador para mostrar la pantalla de la barra. La contrasena
-- de las dos es demo2026, con hash BCrypt como las reales.
--
-- Dos detalles del esquema real, que no son obvios:
--
--  · sys_user.id no es AUTO_INCREMENT. Los ids los reparte
--    Hibernate con la tabla sys_user_SEQ, empezando por abajo. Por
--    eso estas dos cuentas se van al 9001 y 9002: asi el contador
--    puede crecer durante anos sin chocar con ellas.
--  · telefono es NOT NULL y no tiene default, asi que va vacio en
--    lugar de omitirse.

INSERT INTO sys_user (id, username, password, id_rol, telefono)
SELECT 9001, 'demo',
       '$2b$10$i3SrNtqYfKE/LzqBVw.8A.Go//Qn7bp3EoXf.ad1nTV4Ma3dxYqK6', 1, ''
FROM   DUAL
WHERE  NOT EXISTS (SELECT 1 FROM sys_user WHERE username = 'demo');

INSERT INTO sys_user (id, username, password, id_rol, telefono)
SELECT 9002, 'barista',
       '$2b$10$1eIlYNuQ8towNU8HKSEI3Om2lcNdqGpQlOsRTa5EZAFUG8JJ4x9hW', 4, ''
FROM   DUAL
WHERE  NOT EXISTS (SELECT 1 FROM sys_user WHERE username = 'barista');


-- ── Configuracion ───────────────────────────────────────────
INSERT INTO sys_config (clave, valor, descripcion)
SELECT 'caja.fondo', '450.00', 'Fondo de caja con el que se abre el turno'
FROM   DUAL
WHERE  NOT EXISTS (SELECT 1 FROM sys_config WHERE clave = 'caja.fondo');


-- ── Lo que queda fuera a proposito ──────────────────────────
-- orden, orden_item, orden_preparacion, hist_*, arqueo_caja,
-- caja_movimiento, log_inventario, wa_*: vacias. El demo se
-- alimenta con lo que se capture enfrente del cliente.


SELECT 'Semilla del demo aplicada.' AS resultado,
       (SELECT COUNT(*) FROM sys_user)  AS usuarios,
       (SELECT COUNT(*) FROM producto)  AS productos,
       (SELECT COUNT(*) FROM hist_orden) AS ventas_historicas;
