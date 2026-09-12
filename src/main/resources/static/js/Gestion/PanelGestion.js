// ================================================================
// PanelGestion.js — Modulo de Gestion
// El Rincon en las Arboledas
//
// El dia de negocio va de las 01:00 a las 01:00. La fecha de "hoy"
// la manda el servidor (window.__HOY_NEGOCIO__): si la calculara el
// navegador, una tablet con la hora mal movería todos los reportes.
//
// El periodo vive en la direccion (?desde=&hasta=), asi la pantalla
// se puede recargar y compartir sin perder lo que se estaba viendo.
// ================================================================

const ENDPOINTS = {
    kpis: '/admin/gestion/kpis',
};

const HOY = window.__HOY_NEGOCIO__ || new Date().toISOString().slice(0, 10);

// ── Utilidades de fecha (sin dependencias, en horario local) ─────
function aFecha(iso) {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d);
}
function aIso(fecha) {
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${m}-${d}`;
}
function sumarDias(iso, dias) {
    const f = aFecha(iso);
    f.setDate(f.getDate() + dias);
    return aIso(f);
}
function primerDiaDelMes(iso) {
    const f = aFecha(iso);
    return aIso(new Date(f.getFullYear(), f.getMonth(), 1));
}

const FORMATO_MONEDA = new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
});
const FORMATO_MONEDA_EXACTA = new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
});
const FORMATO_FECHA = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric', month: 'long',
});

// ── Rangos de los chips ──────────────────────────────────────────
function rangoDe(periodo) {
    switch (periodo) {
        case 'ayer':  { const d = sumarDias(HOY, -1); return { desde: d, hasta: d }; }
        case '7dias': return { desde: sumarDias(HOY, -6), hasta: HOY };
        case 'mes':   return { desde: primerDiaDelMes(HOY), hasta: HOY };
        case 'hoy':
        default:      return { desde: HOY, hasta: HOY };
    }
}

// ── Estado ───────────────────────────────────────────────────────
let peticionEnCurso = null;

// ── Render ───────────────────────────────────────────────────────
function pintarComparativo(variacion, etiquetaPrevia) {
    const el = document.getElementById('kpiComparativo');
    el.classList.remove('sube', 'baja', 'plano');

    if (variacion === null || variacion === undefined) {
        el.classList.add('plano');
        el.innerHTML = '<i class="bi bi-dash"></i> sin periodo anterior';
        return;
    }

    const valor = Number(variacion);
    const clase = valor > 0 ? 'sube' : (valor < 0 ? 'baja' : 'plano');
    const icono = valor > 0 ? 'bi-arrow-up-right'
                : (valor < 0 ? 'bi-arrow-down-right' : 'bi-dash');

    el.classList.add(clase);
    el.innerHTML = `<i class="bi ${icono}"></i> ${Math.abs(valor)}% vs ${etiquetaPrevia}`;
}

function pintarKpis(k) {
    document.getElementById('kpiVenta').textContent   = FORMATO_MONEDA_EXACTA.format(k.p_venta || 0);
    document.getElementById('kpiOrdenes').textContent = k.n_ordenes || 0;
    document.getElementById('kpiTicket').textContent  = FORMATO_MONEDA.format(k.p_ticket_promedio || 0);
    document.getElementById('kpiDias').textContent    = k.n_dias_con_venta || 0;

    const dias = Number(k.n_dias || 1);
    pintarComparativo(k.p_var_venta, dias === 1 ? 'el día anterior' : `los ${dias} días previos`);

    // Aviso honesto: lo del dia en curso todavia puede moverse.
    const vivas = Number(k.n_ordenes_vivas || 0);
    const aviso = document.getElementById('nucleoAviso');
    aviso.textContent = vivas > 0
        ? `${vivas} ${vivas === 1 ? 'orden aún no archivada' : 'órdenes aún no archivadas'}: el corte del día se hace a la 1 am.`
        : '';

    document.getElementById('nucleo').classList.remove('is-cargando');
}

function pintarLeyenda(desde, hasta, diasConVenta) {
    const el = document.getElementById('periodoLeyenda');
    const texto = (desde === hasta)
        ? FORMATO_FECHA.format(aFecha(desde))
        : `${FORMATO_FECHA.format(aFecha(desde))} al ${FORMATO_FECHA.format(aFecha(hasta))}`;

    // Los dias cerrados (lunes) no cuentan como venta cero, por eso
    // se dice cuantos dias del rango tuvieron movimiento.
    const detalle = (diasConVenta === null)
        ? ''
        : ` · ${diasConVenta} ${diasConVenta === 1 ? 'día con ventas' : 'días con ventas'}`;

    el.textContent = texto + detalle;
}

function pintarError(mensaje) {
    document.getElementById('nucleo').classList.remove('is-cargando');
    document.getElementById('periodoLeyenda').textContent = mensaje;
}

// ── Carga ────────────────────────────────────────────────────────
async function cargar(desde, hasta) {
    document.getElementById('nucleo').classList.add('is-cargando');
    pintarLeyenda(desde, hasta, null);

    // Si el usuario cambia de periodo rapido, la respuesta vieja no
    // debe pisar a la nueva.
    const miPeticion = Symbol('peticion');
    peticionEnCurso = miPeticion;

    try {
        const url = `${ENDPOINTS.kpis}?desde=${desde}&hasta=${hasta}`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const datos = await res.json();
        if (peticionEnCurso !== miPeticion) return;

        pintarKpis(datos);
        pintarLeyenda(desde, hasta, Number(datos.n_dias_con_venta || 0));

    } catch (e) {
        if (peticionEnCurso !== miPeticion) return;
        console.error('Error cargando KPIs:', e);
        pintarError('No se pudieron cargar los números. Revisa la conexión e intenta de nuevo.');
    }
}

// ── Navegacion: el periodo viaja en la direccion ─────────────────
function aplicar(desde, hasta, { escribirUrl = true } = {}) {
    if (escribirUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set('desde', desde);
        url.searchParams.set('hasta', hasta);
        window.history.replaceState({}, '', url);
    }

    // Las secciones heredan el periodo elegido.
    document.querySelectorAll('.reloj-satelite[href]').forEach(a => {
        const base = a.getAttribute('href').split('?')[0];
        a.setAttribute('href', `${base}?desde=${desde}&hasta=${hasta}`);
    });

    document.getElementById('inputDesde').value = desde;
    document.getElementById('inputHasta').value = hasta;

    cargar(desde, hasta);
}

function marcarChip(periodo) {
    document.querySelectorAll('.chip-periodo').forEach(c => {
        c.classList.toggle('is-activo', c.dataset.periodo === periodo);
    });
    document.getElementById('periodoRango')
            .classList.toggle('is-visible', periodo === 'rango');
}

function registrarEventos() {
    document.getElementById('periodoChips').addEventListener('click', (ev) => {
        const chip = ev.target.closest('.chip-periodo');
        if (!chip) return;

        const periodo = chip.dataset.periodo;
        marcarChip(periodo);

        if (periodo === 'rango') {
            document.getElementById('inputDesde').focus();
            return;
        }
        const { desde, hasta } = rangoDe(periodo);
        aplicar(desde, hasta);
    });

    ['inputDesde', 'inputHasta'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            let desde = document.getElementById('inputDesde').value;
            let hasta = document.getElementById('inputHasta').value;
            if (!desde || !hasta) return;
            if (desde > hasta) [desde, hasta] = [hasta, desde];
            marcarChip('rango');
            aplicar(desde, hasta);
        });
    });
}

// ── Arranque ─────────────────────────────────────────────────────
(function iniciar() {
    const params = new URLSearchParams(window.location.search);
    const desdeUrl = params.get('desde');
    const hastaUrl = params.get('hasta');

    document.getElementById('inputHasta').max = HOY;
    document.getElementById('inputDesde').max = HOY;

    registrarEventos();

    if (desdeUrl && hastaUrl) {
        marcarChip(desdeUrl === hastaUrl && hastaUrl === HOY ? 'hoy' : 'rango');
        aplicar(desdeUrl, hastaUrl, { escribirUrl: false });
    } else {
        const { desde, hasta } = rangoDe('hoy');
        aplicar(desde, hasta);
    }
})();
