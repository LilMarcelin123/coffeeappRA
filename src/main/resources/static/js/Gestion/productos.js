// ================================================================
// Gestion/productos.js
// Productos — Modulo de Gestion
//
// El servidor manda las tres listas en una sola respuesta. El
// interruptor de unidades/dinero reordena lo que ya esta en memoria:
// cambiar de criterio no vuelve a pedir nada.
// ================================================================

import { fmt, crearConsulta, montarPeriodo, leyendaPeriodo, mostrarLeyenda }
    from './comun.js';

const consultar = crearConsulta();

const estado = {
    ranking    : [],
    categorias : [],
    sinVenta   : [],
    orden      : 'unidades',
};

const dom = {
    resumen     : document.getElementById('resumen'),
    totUnidades : document.getElementById('totUnidades'),
    totProductos: document.getElementById('totProductos'),
    totLlevar   : document.getElementById('totLlevar'),

    bloqueRanking   : document.getElementById('bloqueRanking'),
    ranking         : document.getElementById('ranking'),
    rankingBajada   : document.getElementById('rankingBajada'),

    bloqueCategorias: document.getElementById('bloqueCategorias'),
    categorias      : document.getElementById('categorias'),

    bloqueSinVenta  : document.getElementById('bloqueSinVenta'),
    sinVenta        : document.getElementById('sinVenta'),
    sinVentaBajada  : document.getElementById('sinVentaBajada'),

    vacio       : document.getElementById('vacio'),
    tplFila     : document.getElementById('tplFila'),
    tplCategoria: document.getElementById('tplCategoria'),
};

// ── Arranque ─────────────────────────────────────────────────────
montarPeriodo({ onCambio: cargar, porDefecto: 'hoy' });

document.querySelectorAll('.interruptor__btn').forEach(btn => {
    btn.addEventListener('click', () => cambiarOrden(btn.dataset.orden));
});

// ── Datos ────────────────────────────────────────────────────────
async function cargar(desde, hasta) {
    mostrarLeyenda('Consultando…');

    try {
        const datos = await consultar(
            `/admin/gestion/productos/datos?desde=${desde}&hasta=${hasta}`);
        if (!datos) return;                       // respuesta vieja

        estado.ranking    = datos.ranking    ?? [];
        estado.categorias = datos.categorias ?? [];
        estado.sinVenta   = datos.sinVenta   ?? [];

        mostrarLeyenda(leyendaPeriodo(desde, hasta));
        pintar();

    } catch (error) {
        console.error('productos:', error);
        mostrarLeyenda('No se pudieron cargar los productos.');
    }
}

// ── Pintado ──────────────────────────────────────────────────────
function pintar() {
    const hayVentas = estado.ranking.length > 0;

    dom.vacio.hidden           = hayVentas;
    dom.resumen.hidden         = !hayVentas;
    dom.bloqueRanking.hidden   = !hayVentas;
    dom.bloqueCategorias.hidden = !hayVentas;
    dom.bloqueSinVenta.hidden  = false;          // interesa aunque no haya ventas

    if (hayVentas) {
        pintarResumen();
        pintarRanking();
        pintarCategorias();
    }
    pintarSinVenta();
}

function pintarResumen() {
    const unidades = suma(estado.ranking, 'n_unidades');
    const aqui     = suma(estado.ranking, 'n_aqui');
    const llevar   = suma(estado.ranking, 'n_llevar');
    const conDato  = aqui + llevar;

    dom.totUnidades.textContent  = unidades.toLocaleString('es-MX');
    dom.totProductos.textContent = estado.ranking.length;

    // El porcentaje se saca solo de lo que tiene dato: el sistema
    // empezo a guardar el tipo de consumo hace poco, y meter lo
    // viejo en el denominador diria que casi nada se va para llevar.
    dom.totLlevar.textContent = conDato > 0
        ? `${Math.round((llevar / conDato) * 100)}%`
        : 'sin dato';
}

function pintarRanking() {
    const lista = [...estado.ranking].sort(estado.orden === 'dinero'
        ? (a, b) => num(b.p_importe)  - num(a.p_importe)
        : (a, b) => num(b.n_unidades) - num(a.n_unidades));

    dom.rankingBajada.textContent = estado.orden === 'dinero'
        ? 'Ordenados por lo que dejaron. La barra reparte entre aquí y para llevar.'
        : 'Ordenados por unidades pedidas. La barra reparte entre aquí y para llevar.';

    dom.ranking.replaceChildren();

    lista.forEach((p, i) => {
        const fila = dom.tplFila.content.cloneNode(true);
        const aqui    = num(p.n_aqui);
        const llevar  = num(p.n_llevar);
        const sinDato = num(p.n_sin_dato);
        const conDato = aqui + llevar;

        fila.querySelector('.fila__puesto').textContent    = i + 1;
        fila.querySelector('.fila__nombre').textContent    = p.n_nombre_producto ?? '—';
        fila.querySelector('.fila__categoria').textContent = p.n_categoria ?? '';

        const barra = fila.querySelector('.fila__barra');
        if (conDato > 0) {
            fila.querySelector('.fila__barra-aqui').style.width   = `${(aqui / conDato) * 100}%`;
            fila.querySelector('.fila__barra-llevar').style.width = `${(llevar / conDato) * 100}%`;
            fila.querySelector('.fila__consumo').textContent =
                `${aqui} aquí · ${llevar} para llevar` +
                (sinDato > 0 ? ` · ${sinDato} sin dato` : '');
        } else {
            barra.remove();
            fila.querySelector('.fila__consumo').textContent = 'Sin dato de consumo';
        }

        const principal  = fila.querySelector('.fila__principal');
        const secundaria = fila.querySelector('.fila__secundaria');

        if (estado.orden === 'dinero') {
            principal.textContent  = fmt.dinero(p.p_importe);
            secundaria.textContent = fmt.plural(num(p.n_unidades), 'unidad', 'unidades');
        } else {
            principal.textContent  = num(p.n_unidades).toLocaleString('es-MX');
            secundaria.textContent = fmt.dinero(p.p_importe);
        }

        dom.ranking.appendChild(fila);
    });
}

function pintarCategorias() {
    const total = suma(estado.categorias, 'p_importe');
    dom.categorias.replaceChildren();

    estado.categorias.forEach(c => {
        const el      = dom.tplCategoria.content.cloneNode(true);
        const importe = num(c.p_importe);
        const parte   = total > 0 ? (importe / total) * 100 : 0;

        el.querySelector('.categoria__nombre').textContent = c.n_categoria ?? '—';
        el.querySelector('.categoria__barra > span').style.width = `${parte}%`;
        el.querySelector('.categoria__cifras b').textContent = fmt.dinero(importe);
        el.querySelector('.categoria__cifras small').textContent =
            `${Math.round(parte)}% · ${fmt.plural(num(c.n_unidades), 'unidad', 'unidades')}`;

        dom.categorias.appendChild(el);
    });
}

function pintarSinVenta() {
    dom.sinVenta.replaceChildren();

    if (estado.sinVenta.length === 0) {
        const p = document.createElement('p');
        p.className   = 'sinventa__todo';
        p.textContent = 'Todo el catálogo activo tuvo al menos una venta en el periodo.';
        dom.sinVenta.appendChild(p);
        dom.sinVentaBajada.textContent = 'Nada que revisar.';
        return;
    }

    dom.sinVentaBajada.textContent =
        `${fmt.plural(estado.sinVenta.length, 'producto activo', 'productos activos')} ` +
        'sin una sola venta en el periodo.';

    estado.sinVenta.forEach(p => {
        const item = document.createElement('span');
        item.className = 'sinventa__item';

        const nombre = document.createElement('span');
        nombre.textContent = p.n_nombre_producto ?? '—';

        const meta = document.createElement('small');
        meta.textContent = `${p.n_categoria ?? ''} · ${fmt.dinero(p.p_precio_base)}`;

        item.append(nombre, meta);
        dom.sinVenta.appendChild(item);
    });
}

// ── Interruptor ──────────────────────────────────────────────────
function cambiarOrden(orden) {
    if (orden === estado.orden) return;
    estado.orden = orden;

    document.querySelectorAll('.interruptor__btn').forEach(btn => {
        const activo = btn.dataset.orden === orden;
        btn.classList.toggle('is-activo', activo);
        btn.setAttribute('aria-pressed', String(activo));
    });

    if (estado.ranking.length) pintarRanking();
}

// ── Apoyos ───────────────────────────────────────────────────────
const num  = (v) => Number(v ?? 0);
const suma = (lista, campo) => lista.reduce((t, x) => t + num(x[campo]), 0);
