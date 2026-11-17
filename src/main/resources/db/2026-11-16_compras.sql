-- ═══════════════════════════════════════════════════════════════
-- Compras del dia — El Rincon en las Arboledas
-- Fecha: 2026-11-16
--
-- Por que existe:
--   Las compras del dia (fruta, pollo, desechables...) se anotaban en
--   una libreta. Ahora se capturan en el sistema con concepto y monto,
--   y se dice de donde salio el dinero:
--
--     CAJA   el efectivo salio del cajon. Ademas de la compra se
--            anota una SALIDA en caja_movimiento (categoria COMPRA),
--            asi el arqueo la descuenta sin cambiar su logica.
--     FUERA  se pago con otro dinero (la bolsa de la duena, una
--            transferencia...). Cuenta como gasto del dia pero no
--            toca la caja. n_origen_detalle dice de donde salio.
--
--   No se toca el inventario: solo se registra el gasto.
--
-- Que hace este script:
--   1. Crea la tabla compra.
--   2. Agrega a hist_cierre_dia los totales de compras del dia, para
--      que el corte los congele igual que congela la venta.
--   3. Migra las salidas de caja con categoria PROVEEDOR (la forma en
--      que se anotaban compras hasta hoy) a compras de CAJA, y las
--      recategoriza como COMPRA.
--   4. Rellena los totales de compras de los cortes ya existentes.
--
-- Correr UNA sola vez, antes de 2026-11-16b_sp_gestion_compras.sql.
-- No lleva DELIMITER.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · Tabla ──────────────────────────────────────────────────
CREATE TABLE compra (
    id_compra          INT           NOT NULL AUTO_INCREMENT,
    t_fecha            DATETIME      NOT NULL,                 -- hora de Mexico
    d_dia_negocio      DATE          NOT NULL,                 -- DATE(t_fecha - 1 h), igual que caja
    n_concepto         VARCHAR(200)  COLLATE utf8mb4_unicode_ci NOT NULL,
    p_monto            DECIMAL(10,2) NOT NULL,
    n_origen_pago      VARCHAR(10)   COLLATE utf8mb4_unicode_ci NOT NULL,  -- CAJA | FUERA
    n_origen_detalle   VARCHAR(100)  COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    id_movimiento      INT           DEFAULT NULL,             -- su SALIDA en caja_movimiento (solo CAJA)
    n_usuario          VARCHAR(150)  COLLATE utf8mb4_unicode_ci NOT NULL,
    f_activo           INT           NOT NULL DEFAULT 1,       -- 0 = cancelada
    t_cancelada        DATETIME      DEFAULT NULL,
    n_usuario_cancela  VARCHAR(150)  COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    PRIMARY KEY (id_compra),
    KEY idx_compra_dia (d_dia_negocio),
    KEY idx_compra_movimiento (id_movimiento),
    CONSTRAINT fk_compra_movimiento
        FOREIGN KEY (id_movimiento) REFERENCES caja_movimiento (id_movimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 2 · Totales de compras en el corte ─────────────────────────
ALTER TABLE hist_cierre_dia
    ADD COLUMN n_compras       INT           NOT NULL DEFAULT 0,
    ADD COLUMN p_compras_caja  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN p_compras_fuera DECIMAL(10,2) NOT NULL DEFAULT 0.00;


-- ── 3 · Las salidas PROVEEDOR pasan a ser compras de caja ──────
START TRANSACTION;

INSERT INTO compra (t_fecha, d_dia_negocio, n_concepto, p_monto,
                    n_origen_pago, id_movimiento, n_usuario)
SELECT m.t_fecha, m.d_dia_negocio,
       COALESCE(NULLIF(TRIM(m.n_concepto), ''), 'Compra a proveedor'),
       m.p_monto, 'CAJA', m.id_movimiento, m.n_usuario
FROM caja_movimiento m
WHERE m.n_tipo = 'SALIDA'
  AND m.n_categoria = 'PROVEEDOR';

UPDATE caja_movimiento
SET    n_categoria = 'COMPRA'
WHERE  n_tipo = 'SALIDA'
  AND  n_categoria = 'PROVEEDOR';

COMMIT;


-- ── 4 · Rellenar los cortes que ya existen ─────────────────────
-- Algunos dias viejos tienen mas de un corte; las compras se le
-- cargan al ultimo del dia para no contarlas dos veces.
UPDATE hist_cierre_dia h
JOIN (
    SELECT c.d_dia_negocio,
           COUNT(*)                                                   AS n,
           SUM(CASE WHEN c.n_origen_pago = 'CAJA'  THEN c.p_monto ELSE 0 END) AS caja,
           SUM(CASE WHEN c.n_origen_pago = 'FUERA' THEN c.p_monto ELSE 0 END) AS fuera
    FROM compra c
    WHERE c.f_activo = 1
    GROUP BY c.d_dia_negocio
) x ON x.d_dia_negocio = h.d_fecha_negocio
JOIN (
    SELECT d_fecha_negocio, MAX(id_cierre) AS id_cierre
    FROM hist_cierre_dia
    GROUP BY d_fecha_negocio
) u ON u.id_cierre = h.id_cierre
SET h.n_compras       = x.n,
    h.p_compras_caja  = x.caja,
    h.p_compras_fuera = x.fuera;


-- ── VERIFICACION (ejecutar por separado) ────────────────────────
-- SELECT * FROM compra;
-- SELECT id_movimiento, n_categoria, p_monto FROM caja_movimiento WHERE n_categoria IN ('PROVEEDOR','COMPRA');
-- SELECT d_fecha_negocio, n_compras, p_compras_caja, p_compras_fuera FROM hist_cierre_dia WHERE n_compras > 0;
