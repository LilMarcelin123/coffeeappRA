-- ═══════════════════════════════════════════════════════════════
-- Revertir apertura de caja (2026-11-18)
--
-- Vuelve a sp_gestion_caja v3 (fondo fijo de sys_config). La tabla
-- apertura_caja NO se borra: guarda lo que el negocio declaro.
--
-- 1. Regresar el codigo a la version anterior a la apertura.
-- 2. Ejecutar 2026-11-16c_sp_gestion_caja_v3.sql
-- 3. Ejecutar lo de abajo.
-- ═══════════════════════════════════════════════════════════════

DROP PROCEDURE IF EXISTS sp_gestion_apertura;
