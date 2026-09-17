#!/usr/bin/env bash
#
# Copia la base de produccion al ambiente de staging.
#
# Que copia:  estructura completa (tablas, vistas, procedimientos,
#             triggers) mas catalogo, productos, recetas, insumos,
#             usuarios e historial de ventas.
# Que NO copia: los datos de los clientes de WhatsApp (wa_sessions,
#             wa_numeros_bloqueados) y los nombres que la gente deja
#             al pedir. Staging es para probar, no para pasear
#             telefonos de la gente del Rincon.
#
# Uso:
#   ./scripts/clonar-a-staging.sh
#
# Necesita la CLI de Railway con sesion iniciada. No escribe en
# produccion: solo lee de ahi.
#
set -euo pipefail

VOLCADO="/tmp/rincon_prod_$(date +%Y%m%d_%H%M).sql"

# Tablas cuyo contenido NO viaja. La estructura si, para que la
# aplicacion arranque; lo que se queda fuera son las filas.
SIN_DATOS=(wa_sessions wa_numeros_bloqueados)

echo "▸ 1/4 · Leyendo produccion…"

ignorar=""
for t in "${SIN_DATOS[@]}"; do
    ignorar="$ignorar --ignore-table=\$MYSQLDATABASE.$t"
done

railway run --environment production --service MySQL -- sh -c "
    mysqldump -h \$RAILWAY_TCP_PROXY_DOMAIN -P \$RAILWAY_TCP_PROXY_PORT \
              -u \$MYSQLUSER -p\$MYSQLPASSWORD \
              --routines --triggers --events \
              --single-transaction --set-gtid-purged=OFF \
              --column-statistics=0 \
              $ignorar \
              \$MYSQLDATABASE
" > "$VOLCADO"

echo "▸ 2/4 · Agregando la estructura vacia de las tablas de WhatsApp…"

railway run --environment production --service MySQL -- sh -c "
    mysqldump -h \$RAILWAY_TCP_PROXY_DOMAIN -P \$RAILWAY_TCP_PROXY_PORT \
              -u \$MYSQLUSER -p\$MYSQLPASSWORD \
              --no-data --set-gtid-purged=OFF --column-statistics=0 \
              \$MYSQLDATABASE ${SIN_DATOS[*]}
" >> "$VOLCADO"

echo "▸ 3/4 · Cargando en staging…"

railway run --environment staging --service MySQL -- sh -c "
    mysql -h \$RAILWAY_TCP_PROXY_DOMAIN -P \$RAILWAY_TCP_PROXY_PORT \
          -u \$MYSQLUSER -p\$MYSQLPASSWORD \$MYSQLDATABASE
" < "$VOLCADO"

echo "▸ 4/4 · Borrando los nombres de clientes en staging…"

railway run --environment staging --service MySQL -- sh -c "
    mysql -h \$RAILWAY_TCP_PROXY_DOMAIN -P \$RAILWAY_TCP_PROXY_PORT \
          -u \$MYSQLUSER -p\$MYSQLPASSWORD \$MYSQLDATABASE -e \"
        UPDATE orden      SET n_nombre_cliente = CONCAT('Cliente ', id_orden) WHERE n_nombre_cliente IS NOT NULL;
        UPDATE hist_orden SET n_nombre_cliente = CONCAT('Cliente ', id_orden) WHERE n_nombre_cliente IS NOT NULL;
    \"
"

rm -f "$VOLCADO"

echo
echo "Listo. Staging quedo con los datos de produccion de hoy, sin datos de clientes."
echo "El volcado temporal se borro."
