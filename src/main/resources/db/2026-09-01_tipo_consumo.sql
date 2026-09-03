-- ═══════════════════════════════════════════════════════════════
-- Tipo de consumo de la orden — El Rincón en las Arboledas
-- Fecha: 2026-09-01
--
-- Agrega la columna n_tipo_consumo a la tabla `orden`.
-- Valores: 'AQUI' (para comer aquí) | 'LLEVAR' (para llevar) | NULL (órdenes previas)
--
-- Ejecutar en AMBAS bases: MariaDB local y MySQL de Railway.
-- ═══════════════════════════════════════════════════════════════

-- ── PASO 1 · La migración ───────────────────────────────────────
-- Una sola sentencia, a propósito: la consola de datos de Railway
-- ejecuta un statement a la vez y no admite variables de sesión ni
-- PREPARE. Si ya se corrió antes, MySQL responde
-- "Duplicate column name 'n_tipo_consumo'" y no pasa nada más.

ALTER TABLE orden ADD COLUMN n_tipo_consumo VARCHAR(10) NULL DEFAULT NULL;


-- ── PASO 2 · Verificación (ejecutar por separado) ───────────────
-- SELECT id_orden, n_estatus_orden, n_tipo_consumo
-- FROM orden
-- ORDER BY id_orden DESC
-- LIMIT 10;


-- ── Comprobar antes de migrar, si se prefiere (por separado) ────
-- SELECT COUNT(*) AS existe
-- FROM information_schema.COLUMNS
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME   = 'orden'
--   AND COLUMN_NAME  = 'n_tipo_consumo';
-- 0 = falta migrar · 1 = ya está


-- ── Nota sobre MariaDB local ────────────────────────────────────
-- MariaDB acepta la forma idempotente en una sola línea:
-- ALTER TABLE orden ADD COLUMN IF NOT EXISTS n_tipo_consumo VARCHAR(10) NULL DEFAULT NULL;
-- MySQL (Railway) NO soporta IF NOT EXISTS en ADD COLUMN: ahí va la de arriba.
