#!/usr/bin/env bash
#
# Arma la base del ambiente DEMO (proyecto daedax-demo en Railway).
#
# Que copia de produccion:
#   · La estructura completa: tablas, vistas, procedimientos,
#     triggers. Sin esto la aplicacion no arranca, porque corre con
#     ddl-auto=validate.
#   · Los catalogos: roles, tipos de pago, unidades, categorias,
#     subcategorias y el catalogo de productos. Un POS sin menu no
#     se puede ensenar.
#
# Que NO copia:
#   · Ni una venta. Ordenes, historial, cierres, arqueos y
#     movimientos de caja se quedan vacios: cada demostracion
#     empieza limpia y se llena enfrente del prospecto.
#   · Usuarios del Rincon. El demo trae sus propias dos cuentas,
#     creadas por demo_seed.sql. Las contrasenas del personal de un
#     cliente no viajan a una vitrina.
#   · Clientes de WhatsApp (wa_*). Solo la estructura.
#
# Uso:
#   1. En Railway, servicio MySQL del proyecto daedax-demo, pestana
#      Variables: copia el valor de MYSQL_PUBLIC_URL.
#   2. export DEMO_URL='mysql://root:...@...proxy.rlwy.net:12345/railway'
#   3. ./scripts/sembrar-demo.sh
#
# Se corre desde el repo con la CLI de Railway apuntando a
# outstanding-love (produccion): de ahi solo LEE. Lo unico que
# escribe va a la URL del demo, que es otro proyecto.
#
# Para dejar tambien el menu fuera:  SIN_PRODUCTOS=1 ./scripts/sembrar-demo.sh
#
set -euo pipefail

: "${DEMO_URL:?Falta DEMO_URL. Copiala de MYSQL_PUBLIC_URL del MySQL de daedax-demo.}"

VOLCADO="/tmp/daedax_demo_$(date +%Y%m%d_%H%M).sql"

# Catalogos: su contenido si viaja.
CATALOGOS=(sys_roles_usuario tipo_pago unidad_medida
           categoria subcategoria subcategoria_opcion
           categoria_insumo)

if [[ "${SIN_PRODUCTOS:-0}" != "1" ]]; then
    CATALOGOS+=(producto)
fi

# ── Desarmar la URL del demo ─────────────────────────────────────
# mysql no come URLs, asi que se parte aqui. Ojo: la contrasena
# puede traer caracteres raros, por eso sale por --password en el
# entorno y no en la linea de comandos.
leer() { python3 -c "
import sys, urllib.parse as u
p = u.urlparse(sys.argv[1])
print({'h': p.hostname, 'p': p.port, 'u': p.username,
       'w': u.unquote(p.password or ''), 'd': p.path.lstrip('/')}[sys.argv[2]])
" "$DEMO_URL" "$1"; }

D_HOST="$(leer h)"; D_PORT="$(leer p)"; D_USER="$(leer u)"
D_PASS="$(leer w)"; D_BASE="$(leer d)"

# Si DEMO_URL no es una URL de mysql, urlparse devuelve None en todo
# y mysql lo recibe como si fuera un puerto. Eso ya paso una vez: el
# script alcanzo a volcar produccion antes de tronar. Que se detenga
# aqui, antes de tocar nada.
for campo in D_HOST D_PORT D_USER D_BASE; do
    valor="${!campo}"
    if [[ -z "$valor" || "$valor" == "None" ]]; then
        echo "DEMO_URL no es una URL de MySQL valida (falta $campo)."
        echo
        echo "Se espera algo asi:"
        echo "  export DEMO_URL='mysql://root:CONTRASENA@HOST.proxy.rlwy.net:12345/railway'"
        echo
        echo "Copialo de MYSQL_PUBLIC_URL, en la pestana Variables del"
        echo "servicio MySQL del proyecto daedax-demo. Con comillas"
        echo "simples: la contrasena suele traer caracteres que el"
        echo "shell interpreta."
        exit 1
    fi
done

if ! [[ "$D_PORT" =~ ^[0-9]+$ ]]; then
    echo "El puerto de DEMO_URL no es un numero: $D_PORT"
    exit 1
fi

echo "▸ Destino: $D_USER@$D_HOST:$D_PORT/$D_BASE"

# ── Candado: el destino no puede ser produccion ──────────────────
# Un paso en falso aqui vacia la base del Rincon. Si del otro lado
# hay historial de ventas, nos detenemos.
VENTAS="$(MYSQL_PWD="$D_PASS" mysql -h "$D_HOST" -P "$D_PORT" -u "$D_USER" \
            "$D_BASE" -N -B -e \
            "SELECT COUNT(*) FROM hist_orden" 2>/dev/null || echo 0)"

VENTAS="${VENTAS:-0}"
[[ "$VENTAS" =~ ^[0-9]+$ ]] || VENTAS=0

if [[ "$VENTAS" -gt 0 ]]; then
    echo "ALTO: la base de destino tiene $VENTAS ventas en el historial."
    echo "Eso no es el demo. Revisa DEMO_URL."
    exit 1
fi

echo "▸ 1/4 · Estructura de produccion (sin datos)…"

railway run --environment production --service MySQL -- sh -c '
    mysqldump -h $RAILWAY_TCP_PROXY_DOMAIN -P $RAILWAY_TCP_PROXY_PORT \
              -u $MYSQLUSER -p$MYSQLPASSWORD \
              --no-data --routines --triggers --events \
              --single-transaction --set-gtid-purged=OFF \
              --column-statistics=0 \
              $MYSQLDATABASE
' > "$VOLCADO"

echo "▸ 2/4 · Catalogos (${#CATALOGOS[@]} tablas)…"

railway run --environment production --service MySQL -- sh -c "
    mysqldump -h \$RAILWAY_TCP_PROXY_DOMAIN -P \$RAILWAY_TCP_PROXY_PORT \
              -u \$MYSQLUSER -p\$MYSQLPASSWORD \
              --no-create-info --skip-triggers \
              --single-transaction --set-gtid-purged=OFF \
              --column-statistics=0 \
              \$MYSQLDATABASE ${CATALOGOS[*]}
" >> "$VOLCADO"

echo "▸ 3/4 · Cargando en el demo…"

MYSQL_PWD="$D_PASS" mysql -h "$D_HOST" -P "$D_PORT" -u "$D_USER" "$D_BASE" < "$VOLCADO"

echo "▸ 4/4 · Semilla (usuarios del demo y configuracion)…"

MYSQL_PWD="$D_PASS" mysql -h "$D_HOST" -P "$D_PORT" -u "$D_USER" "$D_BASE" \
    < src/main/resources/db/demo_seed.sql

rm -f "$VOLCADO"

echo
echo "Listo. La base del demo quedo con el esquema y el menu, sin una sola venta."
echo "Cuentas:  demo / demo2026   ·   barista / demo2026"
