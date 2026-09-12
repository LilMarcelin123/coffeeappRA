// ================================================================
// Bitacora.js — Modulo de Gestion
// El Rincon en las Arboledas
//
// Calendario del mes; al picar un dia salen sus ordenes, y al picar
// una orden se abre su detalle. Ese modal es el unico del modulo:
// todo lo demas son pantallas con direccion propia.
//
// El dia de negocio va de las 01:00 a las 01:00, y ese calculo vive
// en la base (v_venta_orden). Aqui solo se pinta lo que llega.
// ================================================================

const ENDPOINT_DATOS  = '/admin/gestion/bitacora/datos';
const ENDPOINT_ORDEN  = '/admin/gestion/orden';
const HOY = window.__HOY_NEGOCIO__ || new Date().toISOString().slice(0, 10);

// ── Fechas ───────────────────────────────────────────────────────
function aFecha(iso) {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d);
}
function aIso(f) {
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

const MONEDA = new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
});
const MONEDA_CORTA = new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
});
const MES_ANIO   = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' });
const DIA_LARGO  = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

// ── Estado ───────────────────────────────────────────────────────
let mesActual   = aFecha(HOY);   // cualquier dia del mes mostrado
let diasDelMes  = [];            // venta por dia
let ordenesMes  = [];            // ordenes del mes
let diaAbierto  = null;
let modalOrden  = null;

function primerDia(f) { return new Date(f.getFullYear(), f.getMonth(), 1); }
function ultimoDia(f) { return new Date(f.getFullYear(), f.getMonth() + 1, 0); }

// ── Calendario ───────────────────────────────────────────────────
function pintarCalendario() {
    const cont = document.getElementById('calendario');
    cont.innerHTML = '';

    const ini = primerDia(mesActual);
    const fin = ultimoDia(mesActual);

    // Lunes primero: getDay() da 0 en domingo.
    const huecos = (ini.getDay() + 6) % 7;
    for (let i = 0; i < huecos; i++) {
        const vacio = document.createElement('div');
        vacio.className = 'celda celda-vacia';
        cont.appendChild(vacio);
    }

    // La venta mas alta del mes marca la intensidad del resto.
    const maximo = diasDelMes.reduce((m, d) => Math.max(m, Number(d.p_venta || 0)), 0);

    for (let dia = 1; dia <= fin.getDate(); dia++) {
        const fecha = new Date(mesActual.getFullYear(), mesActual.getMonth(), dia);
        const iso   = aIso(fecha);
        const datos = diasDelMes.find(d => d.d_dia_negocio === iso);

        const celda = document.createElement('button');
        celda.type = 'button';
        celda.className = 'celda';
        celda.dataset.fecha = iso;

        if (iso === HOY)       celda.classList.add('celda-hoy');
        if (iso > HOY)         celda.classList.add('celda-futura');
        if (!datos)            celda.classList.add('celda-sin-venta');

        const venta = Number(datos?.p_venta || 0);

        // Barra de intensidad: comparar dias de un vistazo sin leer
        // cada cifra.
        const proporcion = maximo > 0 ? venta / maximo : 0;

        celda.innerHTML = `
            <span class="celda-dia">${dia}</span>
            ${datos ? `
                <span class="celda-venta">${MONEDA_CORTA.format(venta)}</span>
                <span class="celda-ordenes">${datos.n_ordenes} ${Number(datos.n_ordenes) === 1 ? 'orden' : 'órdenes'}</span>
                <span class="celda-barra"><i style="width:${Math.round(proporcion * 100)}%"></i></span>
            ` : '<span class="celda-nada">—</span>'}
        `;

        if (datos) celda.addEventListener('click', () => abrirDia(iso));
        else celda.disabled = true;

        cont.appendChild(celda);
    }

    document.getElementById('mesTitulo').textContent = MES_ANIO.format(mesActual);

    const totalMes  = diasDelMes.reduce((s, d) => s + Number(d.p_venta || 0), 0);
    const totalOrds = diasDelMes.reduce((s, d) => s + Number(d.n_ordenes || 0), 0);
    document.getElementById('periodoLeyenda').textContent =
        diasDelMes.length
            ? `${MONEDA.format(totalMes)} en ${totalOrds} órdenes · ${diasDelMes.length} ${diasDelMes.length === 1 ? 'día' : 'días'} con venta`
            : 'Sin ventas registradas en este mes.';

    // El mes siguiente al actual no tiene nada que mostrar.
    document.getElementById('btnMesSiguiente').disabled =
        primerDia(mesActual) >= primerDia(aFecha(HOY));
}

// ── Dia seleccionado ─────────────────────────────────────────────
function etiquetasDe(orden) {
    const etiquetas = [];
    if (orden.source === 'WHATSAPP') etiquetas.push('<span class="tag tag-wa"><i class="bi bi-whatsapp"></i> WhatsApp</span>');
    if (orden.n_tipo_consumo === 'AQUI')   etiquetas.push('<span class="tag">Aquí</span>');
    if (orden.n_tipo_consumo === 'LLEVAR') etiquetas.push('<span class="tag">Llevar</span>');
    if (orden.n_tipo_pago) etiquetas.push(`<span class="tag tag-pago">${orden.n_tipo_pago}</span>`);
    if (orden.origen === 'VIVO') etiquetas.push('<span class="tag tag-vivo">Sin archivar</span>');
    return etiquetas.join('');
}

function abrirDia(iso) {
    diaAbierto = iso;
    const ordenes = ordenesMes.filter(o => o.d_dia_negocio === iso);

    document.querySelectorAll('.celda').forEach(c => {
        c.classList.toggle('celda-activa', c.dataset.fecha === iso);
    });

    const total = ordenes.reduce((s, o) => s + Number(o.p_total || 0), 0);
    document.getElementById('diaPanelTitulo').textContent = DIA_LARGO.format(aFecha(iso));
    document.getElementById('diaPanelResumen').textContent =
        `${ordenes.length} ${ordenes.length === 1 ? 'orden' : 'órdenes'} · ${MONEDA.format(total)}`;

    const lista = document.getElementById('ordenesLista');
    const tpl   = document.getElementById('tplOrdenRow');
    lista.innerHTML = '';

    ordenes.forEach(o => {
        const nodo = tpl.content.cloneNode(true);
        const fila = nodo.querySelector('.orden-row');
        fila.querySelector('.orden-hora').textContent    = o.n_hora_texto || '';
        fila.querySelector('.orden-cliente').textContent = o.n_nombre_cliente || `Orden ${o.id_orden}`;
        fila.querySelector('.orden-etiquetas').innerHTML = etiquetasDe(o);
        fila.querySelector('.orden-total').textContent   = MONEDA.format(o.p_total || 0);
        fila.addEventListener('click', () => abrirOrden(o.id_orden));
        lista.appendChild(nodo);
    });

    const panel = document.getElementById('diaPanel');
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cerrarDia() {
    diaAbierto = null;
    document.getElementById('diaPanel').hidden = true;
    document.querySelectorAll('.celda').forEach(c => c.classList.remove('celda-activa'));
}

// ── Detalle de la orden ──────────────────────────────────────────
async function abrirOrden(idOrden) {
    const meta  = document.getElementById('ordenMeta');
    const items = document.getElementById('ordenItems');

    document.getElementById('modalOrdenTitulo').textContent = `Orden ${idOrden}`;
    meta.innerHTML  = '';
    items.innerHTML = '<p class="items-cargando">Cargando…</p>';
    document.getElementById('ordenTotalFinal').textContent = '';

    modalOrden.show();

    try {
        const res = await fetch(`${ENDPOINT_ORDEN}/${idOrden}`, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const { orden, items: productos } = await res.json();

        meta.innerHTML = `
            <div><small>Hora</small><b>${String(orden.t_hora_creacion || '').replace('T', ' ').slice(11, 16)}</b></div>
            <div><small>Cliente</small><b>${orden.n_nombre_cliente || 'Sin nombre'}</b></div>
            <div><small>Pago</small><b>${orden.n_tipo_pago || 'Sin registro'}</b></div>
            <div><small>Consumo</small><b>${orden.n_tipo_consumo === 'AQUI' ? 'Para comer aquí'
                                          : orden.n_tipo_consumo === 'LLEVAR' ? 'Para llevar'
                                          : 'Sin clasificar'}</b></div>
            <div><small>Canal</small><b>${orden.source === 'WHATSAPP' ? 'WhatsApp' : 'Mostrador'}</b></div>
        `;

        items.innerHTML = productos.length
            ? productos.map(p => `
                <div class="item-row">
                    <span class="item-cant">${p.p_cantidad}x</span>
                    <div class="item-nombre">
                        ${p.n_nombre_producto || 'Producto eliminado del catálogo'}
                        ${Number(p.p_extras) > 0 ? `<em>Extras ${MONEDA.format(p.p_extras)}</em>` : ''}
                        ${p.n_comentario ? `<em>Nota: ${p.n_comentario}</em>` : ''}
                    </div>
                    <b>${MONEDA.format(p.precio_total || 0)}</b>
                </div>`).join('')
            : '<p class="items-cargando">Esta orden no tiene productos registrados.</p>';

        document.getElementById('ordenTotalFinal').textContent = `Total ${MONEDA.format(orden.p_total || 0)}`;

    } catch (e) {
        console.error('Error cargando la orden:', e);
        items.innerHTML = '<p class="items-cargando">No se pudo cargar el detalle. Intenta de nuevo.</p>';
    }
}

// ── Carga del mes ────────────────────────────────────────────────
let peticionEnCurso = null;

async function cargarMes() {
    const desde = aIso(primerDia(mesActual));
    const hasta = aIso(ultimoDia(mesActual));

    document.getElementById('periodoLeyenda').textContent = 'Cargando…';
    cerrarDia();

    const miPeticion = Symbol('peticion');
    peticionEnCurso = miPeticion;

    try {
        const res = await fetch(`${ENDPOINT_DATOS}?desde=${desde}&hasta=${hasta}`,
                                { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const datos = await res.json();
        if (peticionEnCurso !== miPeticion) return;

        diasDelMes = datos.dias    || [];
        ordenesMes = datos.ordenes || [];
        pintarCalendario();

        const url = new URL(window.location.href);
        url.searchParams.set('mes', desde.slice(0, 7));
        window.history.replaceState({}, '', url);

    } catch (e) {
        if (peticionEnCurso !== miPeticion) return;
        console.error('Error cargando la bitácora:', e);
        document.getElementById('periodoLeyenda').textContent =
            'No se pudo cargar el mes. Revisa la conexión e intenta de nuevo.';
    }
}

function registrarEventos() {
    document.getElementById('btnMesAnterior').addEventListener('click', () => {
        mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth() - 1, 1);
        cargarMes();
    });
    document.getElementById('btnMesSiguiente').addEventListener('click', () => {
        mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 1);
        cargarMes();
    });
    document.getElementById('btnCerrarDia').addEventListener('click', cerrarDia);
}

(function iniciar() {
    modalOrden = new bootstrap.Modal(document.getElementById('modalOrden'));

    const mesUrl = new URLSearchParams(window.location.search).get('mes');
    if (mesUrl && /^\d{4}-\d{2}$/.test(mesUrl)) {
        mesActual = aFecha(`${mesUrl}-01`);
    }

    registrarEventos();
    cargarMes();
})();
