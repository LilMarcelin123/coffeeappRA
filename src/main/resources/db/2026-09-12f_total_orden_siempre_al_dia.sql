-- ═══════════════════════════════════════════════════════════════
-- El total de la orden siempre al dia
-- Fecha: 2026-09-12
--
-- El error:
--   `sp_eliminar_item` borra el producto y sus extras, pero nunca
--   recalcula `orden.p_total`. `sp_agregar_item_con_extras` tampoco.
--   El total solo se recalcula al mandar a cocina (proceso 2) o al
--   cerrar (proceso 1), dentro de sp_gestionar_orden.
--
--   Consecuencia real: si se reabre una orden y se le quita un
--   producto, la tarjeta de Ordenes Pendientes sigue mostrando el
--   precio anterior, que es el que lee la cajera para cobrar. Se
--   detecto con la orden 1 del 11 de septiembre: la pantalla decia
--   $340 y la orden valia $275.
--
-- La solucion:
--   Un recalculo automatico cada vez que cambian los items. Asi el
--   total no depende de que cada procedimiento se acuerde de
--   actualizarlo, ni de los que se escriban en el futuro.
--
--   `precio_total` del item ya incluye sus extras: es lo que suma
--   sp_gestionar_orden al cerrar, y se respeta la misma regla para
--   que el cobro y el corte nunca se contradigan.
--
-- Ejecutar con el cliente de mysql (lleva DELIMITER).
-- ═══════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_orden_item_ins;
DROP TRIGGER IF EXISTS trg_orden_item_upd;
DROP TRIGGER IF EXISTS trg_orden_item_del;
DROP PROCEDURE IF EXISTS sp_recalcular_total_orden;

DELIMITER ;;

-- ── Recalculo, en un solo lugar ─────────────────────────────────
CREATE PROCEDURE sp_recalcular_total_orden(IN p_id_orden INT)
BEGIN
    IF p_id_orden IS NOT NULL THEN
        UPDATE orden o
        SET o.p_total = (
            SELECT COALESCE(SUM(oi.precio_total), 0)
            FROM orden_item oi
            WHERE oi.id_orden = p_id_orden
        )
        WHERE o.id_orden = p_id_orden;
    END IF;
END ;;

-- ── Disparadores sobre los items ────────────────────────────────
CREATE TRIGGER trg_orden_item_ins
AFTER INSERT ON orden_item
FOR EACH ROW
BEGIN
    CALL sp_recalcular_total_orden(NEW.id_orden);
END ;;

CREATE TRIGGER trg_orden_item_upd
AFTER UPDATE ON orden_item
FOR EACH ROW
BEGIN
    CALL sp_recalcular_total_orden(NEW.id_orden);
    -- Por si el item cambio de orden (no deberia pasar, pero si pasa
    -- las dos ordenes quedan bien)
    IF OLD.id_orden <> NEW.id_orden THEN
        CALL sp_recalcular_total_orden(OLD.id_orden);
    END IF;
END ;;

CREATE TRIGGER trg_orden_item_del
AFTER DELETE ON orden_item
FOR EACH ROW
BEGIN
    CALL sp_recalcular_total_orden(OLD.id_orden);
END ;;

DELIMITER ;


-- ── Corregir las ordenes vivas que ya traen el total desfasado ──
-- Solo toca las que siguen en operacion. El historico NO se toca:
-- ahi el total es lo que realmente se cobro.
UPDATE orden o
SET o.p_total = (
    SELECT COALESCE(SUM(oi.precio_total), 0)
    FROM orden_item oi
    WHERE oi.id_orden = o.id_orden
)
WHERE o.n_estatus_orden IN ('ABIERTA', 'PENDIENTE');


-- ── VERIFICACION (ejecutar por separado) ────────────────────────
-- No debe devolver ninguna fila:
-- SELECT o.id_orden, o.n_estatus_orden, o.p_total,
--        COALESCE(SUM(oi.precio_total), 0) AS suma_items
-- FROM orden o
-- LEFT JOIN orden_item oi ON oi.id_orden = o.id_orden
-- GROUP BY o.id_orden, o.n_estatus_orden, o.p_total
-- HAVING o.p_total <> suma_items;
