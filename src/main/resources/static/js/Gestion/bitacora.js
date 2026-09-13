// ================================================================
// Gestion/bitacora.js
// Calendario del mes; al picar un dia salen sus ordenes, y al picar
// una orden se abre su detalle.
//
// Ese modal es el unico del modulo: lo demas son pantallas con su
// propia direccion.
// ================================================================

import { HOY, aFecha, aIso, fmt, hora, crearConsulta } from './comun.js';

const API_MES   = '/admin/gestion/bitacora/datos';
const API_ORDEN = '/admin/gestion/orden';

const consultarMes   = crearConsulta();
const consultarOrden = crearConsulta();

const tplCelda = document.getElementById('tplCelda');
const tplOrden = document.getElementById('tplOrden');
const tplItem  = document.getElementById('tplItem');

// ── Estado ───────────────────────────────────────────────────────
let mes      = aFecha(HOY);   // cualquier dia del mes mostrado
let dias     = [];
let ordenes  = [];
let modal    = null;

const primerDia = (f) => new Date(f.getFullYear(), f.getMonth(), 1);
const ultimoDia = (f) => new Date(f.getFullYear(), f.getMonth() + 1, 0);

// ── Calendario ───────────────────────────────────────────────────
function pintarCalendario() {
    const cont = document.getElementById('calendario');
    cont.replaceChildren();

    const inicio = primerDia(mes);
    const fin    = ultimoDia(mes);

    // La semana empieza en lunes; getDay() da 0 en domingo.
    const huecos = (inicio.getDay() + 6) % 7;
    for (let i = 0; i < huecos; i++) {
        const vacio = document.createElement('div');
        vacio.className = 'celda celda--hueco';
        cont.appendChild(vacio);
    }

    // El mejor dia del mes marca la escala de las barras.
    const maximo = dias.reduce((m, d) => Math.max(m, Number(d.p_venta || 0)), 0);

    for (let numero = 1; numero <= fin.getDate(); numero++) {
        const iso   = aIso(new Date(mes.getFullYear(), mes.getMonth(), numero));
        const datos = dias.find(d => d.d_dia_negocio === iso);

        const nodo  = tplCelda.content.cloneNode(true);
        const celda = nodo.querySelector('.celda');
        celda.dataset.fecha = iso;
        celda.querySelector('.celda__dia').textContent = numero;

        if (iso === HOY) celda.classList.add('celda--hoy');
        if (iso > HOY)   celda.classList.add('celda--futura');

        if (datos) {
            const venta = Number(datos.p_venta || 0);
            celda.querySelector('.celda__venta').textContent   = fmt.dineroCorto(venta);
            celda.querySelector('.celda__ordenes').textContent = fmt.plural(datos.n_ordenes, 'orden', 'órdenes');
            celda.querySelector('.celda__barra i').style.width =
                `${maximo > 0 ? Math.round(venta / maximo * 100) : 0}%`;
            celda.querySelector('.celda__nada').remove();
            celda.addEventListener('click', () => abrirDia(iso));
        } else {
            // Dia sin venta: se deja vacio, no en cero. El negocio
            // cierra los lunes y un cero falso tuerce los promedios.
            celda.classList.add('celda--sin-venta');
            celda.disabled = true;
            celda.querySelector('.celda__venta').remove();
            celda.querySelector('.celda__ordenes').remove();
            celda.querySelector('.celda__barra').remove();
        }

        cont.appendChild(nodo);
    }

    document.getElementById('mesTitulo').textContent = fmt.mesAnio(mes);
    document.getElementById('btnMesSiguiente').disabled = primerDia(mes) >= primerDia(aFecha(HOY));

    const totalVenta   = dias.reduce((s, d) => s + Number(d.p_venta || 0), 0);
    const totalOrdenes = dias.reduce((s, d) => s + Number(d.n_ordenes || 0), 0);

    document.getElementById('periodoLeyenda').textContent = dias.length
        ? `${fmt.dinero(totalVenta)} en ${fmt.plural(totalOrdenes, 'orden', 'órdenes')} · ${fmt.plural(dias.length, 'día con venta', 'días con venta')}`
        : 'Sin ventas registradas en este mes.';
}

// ── Etiquetas de una orden ───────────────────────────────────────
function etiquetasDe(orden) {
    const etiquetas = [];
    if (orden.source === 'WHATSAPP')       etiquetas.push(['WhatsApp', 'tag--wa']);
    if (orden.n_tipo_consumo === 'AQUI')   etiquetas.push(['Aquí', '']);
    if (orden.n_tipo_consumo === 'LLEVAR') etiquetas.push(['Llevar', '']);
    if (orden.n_tipo_pago)                 etiquetas.push([orden.n_tipo_pago, 'tag--pago']);
    if (orden.origen === 'VIVO')           etiquetas.push(['Sin archivar', 'tag--vivo']);

    return etiquetas.map(([texto, extra]) => {
        const span = document.createElement('span');
        span.className = extra ? `tag ${extra}` : 'tag';
        span.textContent = texto;
        return span;
    });
}

// ── Dia seleccionado ─────────────────────────────────────────────
function abrirDia(iso) {
    const delDia = ordenes.filter(o => o.d_dia_negocio === iso);

    document.querySelectorAll('.celda').forEach(c => {
        c.classList.toggle('celda--activa', c.dataset.fecha === iso);
    });

    const total = delDia.reduce((s, o) => s + Number(o.p_total || 0), 0);
    document.getElementById('diaTitulo').textContent  = fmt.diaCompleto(iso);
    document.getElementById('diaResumen').textContent =
        `${fmt.plural(delDia.length, 'orden', 'órdenes')} · ${fmt.dinero(total)}`;

    const lista = document.getElementById('ordenesLista');
    lista.replaceChildren();

    delDia.forEach(orden => {
        const nodo = tplOrden.content.cloneNode(true);
        const fila = nodo.querySelector('.orden');

        fila.querySelector('.orden__hora').textContent    = orden.n_hora_texto || '';
        const folio = orden.n_folio_dia != null ? orden.n_folio_dia : orden.id_orden;
        fila.querySelector('.orden__cliente').textContent = orden.n_nombre_cliente || `Orden ${folio}`;
        fila.querySelector('.orden__tags').append(...etiquetasDe(orden));
        fila.querySelector('.orden__total').textContent   = fmt.dinero(orden.p_total);

        fila.addEventListener('click', () => abrirOrden(orden.id_orden, folio));
        lista.appendChild(nodo);
    });

    const panel = document.getElementById('diaPanel');
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cerrarDia() {
    document.getElementById('diaPanel').hidden = true;
    document.querySelectorAll('.celda').forEach(c => c.classList.remove('celda--activa'));
}

// ── Detalle de la orden ──────────────────────────────────────────
function pintarMeta(orden) {
    const consumo = orden.n_tipo_consumo === 'AQUI'   ? 'Para comer aquí'
                  : orden.n_tipo_consumo === 'LLEVAR' ? 'Para llevar'
                  : 'Sin clasificar';

    const campos = [
        ['Hora',    hora(orden.t_hora_creacion)],
        ['Cliente', orden.n_nombre_cliente || 'Sin nombre'],
        ['Pago',    orden.n_tipo_pago || 'Sin registro'],
        ['Consumo', consumo],
        ['Canal',   orden.source === 'WHATSAPP' ? 'WhatsApp' : 'Mostrador'],
    ];

    const meta = document.getElementById('ordenMeta');
    meta.replaceChildren();

    campos.forEach(([etiqueta, valor]) => {
        const caja   = document.createElement('div');
        const titulo = document.createElement('small');
        const dato   = document.createElement('b');
        titulo.textContent = etiqueta;
        dato.textContent   = valor;
        caja.append(titulo, dato);
        meta.appendChild(caja);
    });
}

function pintarItems(productos) {
    const cont = document.getElementById('ordenItems');
    cont.replaceChildren();

    if (!productos.length) {
        const aviso = document.createElement('p');
        aviso.className = 'mensaje-vacio';
        aviso.textContent = 'Esta orden no tiene productos registrados.';
        cont.appendChild(aviso);
        return;
    }

    productos.forEach(p => {
        const nodo = tplItem.content.cloneNode(true);
        nodo.querySelector('.item__cant').textContent   = `${p.p_cantidad}x`;
        nodo.querySelector('.item__titulo').textContent =
            p.n_nombre_producto || 'Producto eliminado del catálogo';
        nodo.querySelector('.item__total').textContent  = fmt.dinero(p.precio_total);

        const detalles = [];
        if (Number(p.p_extras) > 0) detalles.push(`Extras ${fmt.dinero(p.p_extras)}`);
        if (p.n_comentario)         detalles.push(`Nota: ${p.n_comentario}`);

        const detalle = nodo.querySelector('.item__detalle');
        if (detalles.length) detalle.textContent = detalles.join(' · ');
        else detalle.remove();

        cont.appendChild(nodo);
    });
}

async function abrirOrden(idOrden, folio) {
    // Se titula con el folio del dia, que es el numero que conocen en la
    // barra; el id interno queda para la consulta.
    document.getElementById('modalOrdenTitulo').textContent = `Orden ${folio ?? idOrden}`;
    document.getElementById('ordenMeta').replaceChildren();
    document.getElementById('ordenTotalFinal').textContent = '';

    const cont = document.getElementById('ordenItems');
    cont.replaceChildren();
    const cargando = document.createElement('p');
    cargando.className = 'mensaje-vacio';
    cargando.textContent = 'Cargando…';
    cont.appendChild(cargando);

    modal.show();

    try {
        const datos = await consultarOrden(`${API_ORDEN}/${idOrden}`);
        if (!datos) return;

        pintarMeta(datos.orden);
        pintarItems(datos.items || []);
        document.getElementById('ordenTotalFinal').textContent = `Total ${fmt.dinero(datos.orden.p_total)}`;

    } catch (error) {
        console.error('Detalle de orden:', error);
        cargando.textContent = 'No se pudo cargar el detalle. Intenta de nuevo.';
    }
}

// ── Carga del mes ────────────────────────────────────────────────
async function cargarMes() {
    const desde = aIso(primerDia(mes));
    const hasta = aIso(ultimoDia(mes));

    document.getElementById('periodoLeyenda').textContent = 'Cargando…';
    cerrarDia();

    try {
        const datos = await consultarMes(`${API_MES}?desde=${desde}&hasta=${hasta}`);
        if (!datos) return;

        dias    = datos.dias    || [];
        ordenes = datos.ordenes || [];
        pintarCalendario();

        const url = new URL(window.location.href);
        url.searchParams.set('mes', desde.slice(0, 7));
        window.history.replaceState({}, '', url);

    } catch (error) {
        console.error('Bitácora:', error);
        document.getElementById('periodoLeyenda').textContent =
            'No se pudo cargar el mes. Revisa la conexión e intenta de nuevo.';
    }
}

function moverMes(pasos) {
    mes = new Date(mes.getFullYear(), mes.getMonth() + pasos, 1);
    cargarMes();
}

// ── Arranque ─────────────────────────────────────────────────────
(function iniciar() {
    modal = new bootstrap.Modal(document.getElementById('modalOrden'));

    const mesUrl = new URLSearchParams(window.location.search).get('mes');
    if (mesUrl && /^\d{4}-\d{2}$/.test(mesUrl)) mes = aFecha(`${mesUrl}-01`);

    document.getElementById('btnMesAnterior').addEventListener('click', () => moverMes(-1));
    document.getElementById('btnMesSiguiente').addEventListener('click', () => moverMes(1));
    document.getElementById('btnCerrarDia').addEventListener('click', cerrarDia);

    cargarMes();
})();
