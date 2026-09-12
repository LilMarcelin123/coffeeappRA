// ================================================================
// Cierres.js — Modulo de Gestion
// El Rincon en las Arboledas
//
// Un dia tiene dos cifras que no siempre coinciden:
//   · lo vendido  → las ordenes del dia
//   · lo arqueado → los cortes de caja
// Durante el dia la diferencia es normal (lo que aun no se archiva).
// Despues de la 1 am deja de serlo, y por eso se marca.
//
// En El Rincon cortan varias veces al dia, asi que cada dia puede
// traer varios cortes y se ven al desplegarlo.
// ================================================================

const ENDPOINT = '/admin/gestion/cierres/datos';
const HOY = window.__HOY_NEGOCIO__ || new Date().toISOString().slice(0, 10);

// ── Fechas ───────────────────────────────────────────────────────
function aFecha(iso) {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d);
}
function aIso(f) {
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
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

const MONEDA = new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
});
const MONEDA_CORTA = new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
});
const FECHA_LARGA = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long' });
const DIA_SEMANA  = new Intl.DateTimeFormat('es-MX', { weekday: 'long' });

function horaDe(textoFecha) {
    if (!textoFecha) return '';
    const t = String(textoFecha).replace('T', ' ');
    return t.slice(11, 16);
}

function rangoDe(periodo) {
    switch (periodo) {
        case 'hoy':   return { desde: HOY, hasta: HOY };
        case '7dias': return { desde: sumarDias(HOY, -6), hasta: HOY };
        case 'mes':
        default:      return { desde: primerDiaDelMes(HOY), hasta: HOY };
    }
}

// ── Render ───────────────────────────────────────────────────────
function pintarResumen(dias) {
    const vendido  = dias.reduce((s, d) => s + Number(d.p_venta || 0), 0);
    const arqueado = dias.reduce((s, d) => s + Number(d.p_arqueado || 0), 0);
    const falta    = vendido - arqueado;

    document.getElementById('totVendido').textContent  = MONEDA.format(vendido);
    document.getElementById('totArqueado').textContent = MONEDA.format(arqueado);

    const tira = document.getElementById('tiraDiferencia');
    // Menos de un peso es redondeo, no un faltante real.
    if (Math.abs(falta) >= 1) {
        document.getElementById('totDiferencia').textContent = MONEDA.format(falta);
        tira.hidden = false;
    } else {
        tira.hidden = true;
    }

    document.getElementById('resumenPeriodo').hidden = dias.length === 0;
}

function estadoDelDia(dia) {
    const falta  = Number(dia.p_por_arquear || 0);
    const vivas  = Number(dia.n_ordenes_vivas || 0);
    const cortes = Number(dia.n_cortes || 0);

    if (dia.d_dia_negocio === HOY) {
        return vivas > 0
            ? { texto: 'Día en curso', clase: 'pastilla-curso' }
            : { texto: 'Arqueado', clase: 'pastilla-ok' };
    }
    if (cortes === 0) return { texto: 'Sin corte', clase: 'pastilla-falta' };
    if (Math.abs(falta) >= 1) return { texto: 'Falta arquear', clase: 'pastilla-falta' };
    return { texto: 'Arqueado', clase: 'pastilla-ok' };
}

function pintarCortes(contenedor, cortes) {
    const tpl = document.getElementById('tplCorte');
    contenedor.innerHTML = '';

    if (!cortes.length) {
        contenedor.innerHTML = '<p class="corte-vacio">Este día no tiene cortes registrados. Sus ventas siguen sin arquear.</p>';
        return;
    }

    cortes.forEach(c => {
        const nodo = tpl.content.cloneNode(true);
        nodo.querySelector('.corte-hora-txt').textContent = horaDe(c.t_fecha_cierre);
        nodo.querySelector('.corte-usuario').textContent  = c.n_usuario_cierre || 'sin usuario';
        nodo.querySelector('.corte-ordenes').textContent  =
            `${c.n_total_ordenes} ${Number(c.n_total_ordenes) === 1 ? 'orden' : 'órdenes'}`;
        nodo.querySelector('.corte-total').textContent    = MONEDA.format(c.p_total_general || 0);

        const nota = nodo.querySelector('.corte-nota');
        const partes = [];

        // Los cortes viejos juntaron varios dias: decirlo en vez de
        // fingir que ese dinero es de un solo dia.
        if (Number(c.dias_abarcados) > 1) {
            partes.push(`Incluye ventas del ${FECHA_LARGA.format(aFecha(c.d_primer_dia))} al ${FECHA_LARGA.format(aFecha(c.d_ultimo_dia))}`);
        }
        if (c.n_observaciones) partes.push(c.n_observaciones);

        if (partes.length) nota.textContent = partes.join(' · ');
        else nota.remove();

        contenedor.appendChild(nodo);
    });
}

function pintarDias(dias, cortes) {
    const lista = document.getElementById('listaDias');
    const tpl   = document.getElementById('tplDia');
    lista.innerHTML = '';

    if (!dias.length) {
        lista.innerHTML = '<p class="lista-vacia">No hubo ventas ni cortes en este periodo.</p>';
        return;
    }

    dias.forEach(dia => {
        const nodo  = tpl.content.cloneNode(true);
        const fecha = aFecha(dia.d_dia_negocio);

        nodo.querySelector('.dia-titulo').textContent  = FECHA_LARGA.format(fecha);
        nodo.querySelector('.dia-semana').textContent  = DIA_SEMANA.format(fecha);
        nodo.querySelector('.dia-venta').textContent   = MONEDA_CORTA.format(dia.p_venta || 0);
        nodo.querySelector('.dia-ordenes').textContent = dia.n_ordenes || 0;
        nodo.querySelector('.dia-cortes').textContent  = dia.n_cortes || 0;

        const estado = estadoDelDia(dia);
        const past   = nodo.querySelector('.pastilla');
        past.textContent = estado.texto;
        past.classList.add(estado.clase);

        nodo.querySelector('.pago-efectivo').textContent = MONEDA_CORTA.format(dia.p_efectivo || 0);
        nodo.querySelector('.pago-tarjeta').textContent  = MONEDA_CORTA.format(dia.p_tarjeta || 0);
        nodo.querySelector('.pago-otro').textContent     = MONEDA_CORTA.format(dia.p_otro || 0);

        const detalle = nodo.querySelector('.dia-detalle');
        pintarCortes(detalle.querySelector('.dia-cortes-lista'),
                     cortes.filter(c => c.d_fecha_negocio === dia.d_dia_negocio));

        const boton = nodo.querySelector('.dia-header');
        boton.addEventListener('click', () => {
            const abierto = boton.getAttribute('aria-expanded') === 'true';
            boton.setAttribute('aria-expanded', String(!abierto));
            detalle.hidden = abierto;
        });

        lista.appendChild(nodo);
    });
}

// ── Carga ────────────────────────────────────────────────────────
let peticionEnCurso = null;

async function cargar(desde, hasta) {
    const leyenda = document.getElementById('periodoLeyenda');
    leyenda.textContent = 'Cargando…';

    const miPeticion = Symbol('peticion');
    peticionEnCurso = miPeticion;

    try {
        const res = await fetch(`${ENDPOINT}?desde=${desde}&hasta=${hasta}`,
                                { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const datos = await res.json();
        if (peticionEnCurso !== miPeticion) return;

        const dias   = datos.dias   || [];
        const cortes = datos.cortes || [];

        pintarResumen(dias);
        pintarDias(dias, cortes);

        const texto = (desde === hasta)
            ? FECHA_LARGA.format(aFecha(desde))
            : `${FECHA_LARGA.format(aFecha(desde))} al ${FECHA_LARGA.format(aFecha(hasta))}`;
        leyenda.textContent = `${texto} · ${dias.length} ${dias.length === 1 ? 'día' : 'días'} con movimiento`;

    } catch (e) {
        if (peticionEnCurso !== miPeticion) return;
        console.error('Error cargando cierres:', e);
        leyenda.textContent = 'No se pudieron cargar los cierres. Revisa la conexión e intenta de nuevo.';
    }
}

// ── Navegacion ───────────────────────────────────────────────────
function aplicar(desde, hasta, { escribirUrl = true } = {}) {
    if (escribirUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set('desde', desde);
        url.searchParams.set('hasta', hasta);
        window.history.replaceState({}, '', url);
    }
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
        if (periodo === 'rango') { document.getElementById('inputDesde').focus(); return; }
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

(function iniciar() {
    const params = new URLSearchParams(window.location.search);
    document.getElementById('inputDesde').max = HOY;
    document.getElementById('inputHasta').max = HOY;

    registrarEventos();

    const desdeUrl = params.get('desde');
    const hastaUrl = params.get('hasta');

    if (desdeUrl && hastaUrl) {
        marcarChip('rango');
        aplicar(desdeUrl, hastaUrl, { escribirUrl: false });
    } else {
        const { desde, hasta } = rangoDe('mes');
        aplicar(desde, hasta);
    }
})();
