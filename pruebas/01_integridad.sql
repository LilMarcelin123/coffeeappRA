-- ═══════════════════════════════════════════════════════════════
-- Chequeo de integridad — El Rincon en las Arboledas
--
-- Solo LECTURA. No escribe nada, se puede correr en produccion a
-- cualquier hora y con el negocio abierto.
--
-- Cada bloque comprueba una regla que el sistema deberia cumplir
-- siempre. La columna `estado` dice OK o REVISAR. Si todo sale OK,
-- los datos estan sanos.
--
-- Uso:
--   railway run --service MySQL -- sh -c 'mysql -h $RAILWAY_TCP_PROXY_DOMAIN \
--     -P $RAILWAY_TCP_PROXY_PORT -u $MYSQLUSER -p$MYSQLPASSWORD \
--     $MYSQLDATABASE -t < pruebas/01_integridad.sql'
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · Folios repetidos en un mismo dia ────────────────────────
-- El folio es lo que la barra le canta al cliente. Dos ordenes con
-- el mismo folio el mismo dia significa que dos clientes distintos
-- oyeron el mismo numero.
SELECT '1. Folios repetidos en un dia' AS prueba,
       IF(COUNT(*) = 0, 'OK', CONCAT('REVISAR: ', COUNT(*), ' casos')) AS estado
FROM (
    SELECT d_dia_negocio, n_folio_dia
    FROM v_venta_orden
    WHERE n_folio_dia IS NOT NULL
    GROUP BY d_dia_negocio, n_folio_dia
    HAVING COUNT(*) > 1
) t;


-- ── 2 · Total de la orden contra la suma de sus items ───────────
-- Este es el bug que costo dinero: borrar un item no recalculaba el
-- total y la caja cobraba de mas. Los triggers deberian sostenerlo.
SELECT '2. Total de orden != suma de items' AS prueba,
       IF(COUNT(*) = 0, 'OK', CONCAT('REVISAR: ', COUNT(*), ' ordenes')) AS estado
FROM (
    SELECT o.id_orden, o.p_total, COALESCE(SUM(oi.precio_total), 0) AS suma
    FROM orden o
    LEFT JOIN orden_item oi ON oi.id_orden = o.id_orden
    WHERE o.n_estatus_orden <> 'CANCELADA'
    GROUP BY o.id_orden, o.p_total
    HAVING ABS(o.p_total - suma) > 0.01
) t;


-- ── 3 · Ordenes cerradas sin metodo de pago ─────────────────────
-- Una venta cerrada sin forma de pago no cuadra en ningun corte.
SELECT '3. Ordenes cerradas sin tipo de pago' AS prueba,
       IF(COUNT(*) = 0, 'OK', CONCAT('REVISAR: ', COUNT(*), ' ordenes')) AS estado
FROM orden
WHERE n_estatus_orden = 'CERRADA' AND id_tipo_pago IS NULL;


-- ── 4 · Cierres cuyo total no coincide con lo archivado ─────────
-- hist_cierre_dia guarda un resumen; hist_orden guarda el detalle.
-- Si no coinciden, uno de los dos miente.
SELECT '4. Cierres con total distinto al detalle' AS prueba,
       IF(COUNT(*) = 0, 'OK', CONCAT('REVISAR: ', COUNT(*), ' cierres')) AS estado
FROM (
    SELECT c.id_cierre, c.p_total_general, COALESCE(SUM(h.p_total), 0) AS detalle
    FROM hist_cierre_dia c
    LEFT JOIN hist_orden h ON h.id_cierre = c.id_cierre
    GROUP BY c.id_cierre, c.p_total_general
    HAVING ABS(c.p_total_general - detalle) > 0.01
) t;


-- ── 5 · Items archivados sin su orden ───────────────────────────
SELECT '5. Items archivados huerfanos' AS prueba,
       IF(COUNT(*) = 0, 'OK', CONCAT('REVISAR: ', COUNT(*), ' items')) AS estado
FROM hist_orden_item hoi
LEFT JOIN hist_orden ho
       ON ho.id_orden = hoi.id_orden AND ho.id_cierre = hoi.id_cierre
WHERE ho.id_orden IS NULL;


-- ── 6 · Dias con ventas y sin ningun cierre ─────────────────────
-- Desde que el cierre corre solo a la 01:00, ningun dia terminado
-- deberia quedarse sin corte. El dia de hoy no cuenta.
SELECT '6. Dias vendidos sin cierre' AS prueba,
       IF(COUNT(*) = 0, 'OK', CONCAT('REVISAR: ', COUNT(*), ' dias')) AS estado
FROM (
    SELECT v.d_dia_negocio
    FROM v_venta_orden v
    LEFT JOIN hist_cierre_dia c ON c.d_fecha_negocio = v.d_dia_negocio
    WHERE v.d_dia_negocio < DATE(CONVERT_TZ(NOW(), 'UTC', 'America/Mexico_City') - INTERVAL 1 HOUR)
      AND v.d_dia_negocio >= '2026-09-12'
      AND c.id_cierre IS NULL
    GROUP BY v.d_dia_negocio
) t;


-- ── 7 · Arqueos cuya cuenta no cierra ───────────────────────────
-- esperado tiene que ser fondo + venta + entradas - salidas, y la
-- diferencia tiene que ser contado - esperado. Si no, el
-- procedimiento calculo mal.
SELECT '7. Arqueos con aritmetica rota' AS prueba,
       IF(COUNT(*) = 0, 'OK', CONCAT('REVISAR: ', COUNT(*), ' arqueos')) AS estado
FROM arqueo_caja
WHERE ABS(p_esperado - (p_fondo + p_venta_efectivo + p_entradas - p_salidas)) > 0.01
   OR ABS(p_diferencia - (p_contado - p_esperado)) > 0.01;


-- ── 8 · Movimientos sellados contra un arqueo inexistente ───────
SELECT '8. Movimientos con arqueo fantasma' AS prueba,
       IF(COUNT(*) = 0, 'OK', CONCAT('REVISAR: ', COUNT(*), ' movimientos')) AS estado
FROM caja_movimiento m
LEFT JOIN arqueo_caja a ON a.id_arqueo = m.id_arqueo
WHERE m.id_arqueo IS NOT NULL AND a.id_arqueo IS NULL;


-- ── 9 · Ventas de productos que ya no existen ───────────────────
-- No es un error: un producto borrado del catalogo conserva sus
-- ventas. Pero si el numero es alto, el catalogo se esta editando
-- en vez de desactivarse, y los reportes pierden la categoria.
SELECT '9. Ventas de productos fuera de catalogo' AS prueba,
       CONCAT(COUNT(DISTINCT v.id_producto), ' productos (informativo)') AS estado
FROM v_venta_item v
LEFT JOIN producto p ON p.id_producto = v.id_producto
WHERE p.id_producto IS NULL;


-- ── 10 · Ordenes abiertas de dias anteriores ────────────────────
-- Su dinero ya esta en la caja pero no cuenta como venta, y si se
-- cierran despues caen en el turno equivocado. Deberia ser cero al
-- empezar el dia.
SELECT '10. Ordenes sin cobrar de dias pasados' AS prueba,
       IF(COUNT(*) = 0, 'OK', CONCAT('REVISAR: ', COUNT(*), ' ordenes')) AS estado
FROM orden
WHERE n_estatus_orden IN ('ABIERTA', 'PENDIENTE')
  AND DATE(t_hora_creacion - INTERVAL 1 HOUR)
      < DATE(CONVERT_TZ(NOW(), 'UTC', 'America/Mexico_City') - INTERVAL 1 HOUR);
