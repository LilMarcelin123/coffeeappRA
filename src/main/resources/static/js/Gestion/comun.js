// ================================================================
// Gestion/comun.js
// Modulo de Gestion — El Rincon en las Arboledas
//
// Lo que las tres pantallas comparten: fechas, formatos, llamadas
// al servidor y la barra de periodo. Si algo se usa en dos
// pantallas, vive aqui; si se usa en una, vive en la suya.
//
// El dia de negocio (01:00 a 01:00) lo calcula el servidor y llega
// en un atributo del <body>. Aqui nunca se deduce de la hora del
// equipo: una tablet con el reloj mal movería todos los reportes.
// ================================================================

/** Dia de negocio en curso, segun el servidor. */
export const HOY = document.body.dataset.hoyNegocio || '';

// ── Fechas ───────────────────────────────────────────────────────
// Se trabaja con cadenas AAAA-MM-DD y con Date en horario local.
// Nunca con Date.parse de la cadena sola, que la interpreta en UTC
// y recorre el dia un paso hacia atras.

export function aFecha(iso) {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d);
}

export function aIso(fecha) {
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${m}-${d}`;
}

export function sumarDias(iso, dias) {
    const f = aFecha(iso);
    f.setDate(f.getDate() + dias);
    return aIso(f);
}

export function primerDiaDelMes(iso) {
    const f = aFecha(iso);
    return aIso(new Date(f.getFullYear(), f.getMonth(), 1));
}

/** Rango de cada atajo de la barra de periodo. */
export function rangoDe(periodo, hoy = HOY) {
    switch (periodo) {
        case 'ayer':  { const d = sumarDias(hoy, -1); return { desde: d, hasta: d }; }
        case '7dias': return { desde: sumarDias(hoy, -6), hasta: hoy };
        case 'mes':   return { desde: primerDiaDelMes(hoy), hasta: hoy };
        case 'hoy':
        default:      return { desde: hoy, hasta: hoy };
    }
}

/** Hora HH:MM de una marca de tiempo, sin depender de zonas. */
export function hora(marca) {
    if (!marca) return '';
    return String(marca).replace('T', ' ').slice(11, 16);
}

// ── Formatos ─────────────────────────────────────────────────────
const _moneda = new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
});
const _monedaCorta = new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
});
const _fechaLarga = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long' });
const _diaSemana  = new Intl.DateTimeFormat('es-MX', { weekday: 'long' });
const _diaCompleto = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const _mesAnio    = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' });

export const fmt = {
    dinero:      (v) => _moneda.format(Number(v || 0)),
    dineroCorto: (v) => _monedaCorta.format(Number(v || 0)),
    fecha:       (iso) => _fechaLarga.format(aFecha(iso)),
    diaSemana:   (iso) => _diaSemana.format(aFecha(iso)),
    diaCompleto: (iso) => _diaCompleto.format(aFecha(iso)),
    mesAnio:     (fecha) => _mesAnio.format(fecha),
    plural:      (n, singular, plural) => `${n} ${Number(n) === 1 ? singular : plural}`,
};

// ── Llamadas al servidor ─────────────────────────────────────────

/**
 * Consulta JSON con dos cuidados: avisa del error en vez de dejar
 * la pantalla en blanco, y descarta respuestas viejas cuando el
 * usuario cambia de periodo mas rapido de lo que tarda la red.
 */
export function crearConsulta() {
    let vigente = null;

    return async function consultar(url) {
        const marca = Symbol('consulta');
        vigente = marca;

        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (vigente !== marca) return null;          // llegó tarde
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const datos = await res.json();
        return vigente === marca ? datos : null;
    };
}

// ── Barra de periodo ─────────────────────────────────────────────

/**
 * Conecta los chips y las fechas sueltas. Avisa del cambio con
 * onCambio(desde, hasta) y guarda el periodo en la direccion, para
 * que la pantalla se pueda recargar y compartir.
 */
export function montarPeriodo({ onCambio, porDefecto = 'hoy' }) {
    const chips   = document.getElementById('periodoChips');
    const rango   = document.getElementById('periodoRango');
    const iDesde  = document.getElementById('inputDesde');
    const iHasta  = document.getElementById('inputHasta');

    if (!chips) return { aplicar: () => {} };

    iDesde.max = HOY;
    iHasta.max = HOY;

    function marcar(periodo) {
        chips.querySelectorAll('.chip').forEach(c => {
            c.classList.toggle('is-activo', c.dataset.periodo === periodo);
        });
        rango.classList.toggle('is-visible', periodo === 'rango');
    }

    function aplicar(desde, hasta, { escribirUrl = true } = {}) {
        if (escribirUrl) {
            const url = new URL(window.location.href);
            url.searchParams.set('desde', desde);
            url.searchParams.set('hasta', hasta);
            window.history.replaceState({}, '', url);
        }
        iDesde.value = desde;
        iHasta.value = hasta;
        onCambio(desde, hasta);
    }

    chips.addEventListener('click', (ev) => {
        const chip = ev.target.closest('.chip');
        if (!chip) return;

        const periodo = chip.dataset.periodo;
        marcar(periodo);

        if (periodo === 'rango') { iDesde.focus(); return; }
        const { desde, hasta } = rangoDe(periodo);
        aplicar(desde, hasta);
    });

    [iDesde, iHasta].forEach(input => {
        input.addEventListener('change', () => {
            let desde = iDesde.value;
            let hasta = iHasta.value;
            if (!desde || !hasta) return;
            if (desde > hasta) [desde, hasta] = [hasta, desde];   // al reves, se corrige solo
            marcar('rango');
            aplicar(desde, hasta);
        });
    });

    // Arranque: lo que diga la direccion, o el atajo por defecto
    const params   = new URLSearchParams(window.location.search);
    const desdeUrl = params.get('desde');
    const hastaUrl = params.get('hasta');

    if (desdeUrl && hastaUrl) {
        const esHoy = desdeUrl === HOY && hastaUrl === HOY;
        marcar(esHoy ? 'hoy' : 'rango');
        aplicar(desdeUrl, hastaUrl, { escribirUrl: false });
    } else {
        marcar(porDefecto);
        const { desde, hasta } = rangoDe(porDefecto);
        aplicar(desde, hasta);
    }

    return { aplicar, marcar };
}

// ── Texto del periodo ────────────────────────────────────────────
export function leyendaPeriodo(desde, hasta) {
    return desde === hasta
        ? fmt.fecha(desde)
        : `${fmt.fecha(desde)} al ${fmt.fecha(hasta)}`;
}

/** Mensaje de una sola linea bajo la barra de periodo. */
export function mostrarLeyenda(texto) {
    const el = document.getElementById('periodoLeyenda');
    if (el) el.textContent = texto;
}
