// ================================================================
// Gestion/panel.js
// Pantalla principal: los numeros del periodo al centro del reloj.
//
// Solo comportamiento. Las cifras las calcula la base, la forma la
// pone el CSS, y esta pantalla nada mas las une.
// ================================================================

import { HOY, fmt, crearConsulta, montarPeriodo,
         leyendaPeriodo, mostrarLeyenda } from './comun.js';

const API = '/admin/gestion/kpis';
const consultar = crearConsulta();

// ── Elementos ────────────────────────────────────────────────────
const el = {
    nucleo:      document.getElementById('nucleo'),
    venta:       document.getElementById('kpiVenta'),
    comparativo: document.getElementById('kpiComparativo'),
    ordenes:     document.getElementById('kpiOrdenes'),
    ticket:      document.getElementById('kpiTicket'),
    dias:        document.getElementById('kpiDias'),
    aviso:       document.getElementById('nucleoAviso'),
};

// ── Render ───────────────────────────────────────────────────────
function pintarComparativo(variacion, referencia) {
    const clases = ['nucleo__comparativo--sube', 'nucleo__comparativo--baja', 'nucleo__comparativo--plano'];
    el.comparativo.classList.remove(...clases);

    if (variacion === null || variacion === undefined) {
        el.comparativo.classList.add('nucleo__comparativo--plano');
        el.comparativo.textContent = 'sin periodo anterior';
        return;
    }

    const valor = Number(variacion);
    const modo  = valor > 0 ? 'sube' : valor < 0 ? 'baja' : 'plano';
    const flecha = valor > 0 ? '↑' : valor < 0 ? '↓' : '·';

    el.comparativo.classList.add(`nucleo__comparativo--${modo}`);
    el.comparativo.textContent = `${flecha} ${Math.abs(valor)}% vs ${referencia}`;
}

function pintar(kpis) {
    el.venta.textContent   = fmt.dinero(kpis.p_venta);
    el.ordenes.textContent = kpis.n_ordenes || 0;
    el.ticket.textContent  = fmt.dineroCorto(kpis.p_ticket_promedio);
    el.dias.textContent    = kpis.n_dias_con_venta || 0;

    const dias = Number(kpis.n_dias || 1);
    pintarComparativo(kpis.p_var_venta,
                      dias === 1 ? 'el día anterior' : `los ${dias} días previos`);

    // Aviso honesto: lo del dia en curso todavia puede moverse.
    const vivas = Number(kpis.n_ordenes_vivas || 0);
    el.aviso.textContent = vivas > 0
        ? `${fmt.plural(vivas, 'orden aún no archivada', 'órdenes aún no archivadas')}: el corte se hace a la 1 am.`
        : '';

    el.nucleo.dataset.estado = 'listo';
}

// ── Las secciones heredan el periodo elegido ─────────────────────
function propagarPeriodo(desde, hasta) {
    document.querySelectorAll('.satelite[href]').forEach(enlace => {
        const base = enlace.getAttribute('href').split('?')[0];
        enlace.setAttribute('href', `${base}?desde=${desde}&hasta=${hasta}`);
    });
}

// ── Carga ────────────────────────────────────────────────────────
async function cargar(desde, hasta) {
    el.nucleo.dataset.estado = 'cargando';
    mostrarLeyenda(leyendaPeriodo(desde, hasta));
    propagarPeriodo(desde, hasta);

    try {
        const kpis = await consultar(`${API}?desde=${desde}&hasta=${hasta}`);
        if (!kpis) return;                        // llegó tarde, ya hay otra

        pintar(kpis);
        const dias = Number(kpis.n_dias_con_venta || 0);
        mostrarLeyenda(`${leyendaPeriodo(desde, hasta)} · ${fmt.plural(dias, 'día con ventas', 'días con ventas')}`);

    } catch (error) {
        console.error('Panel de gestión:', error);
        el.nucleo.dataset.estado = 'listo';
        mostrarLeyenda('No se pudieron cargar los números. Revisa la conexión e intenta de nuevo.');
    }
}

montarPeriodo({ onCambio: cargar, porDefecto: 'hoy' });
