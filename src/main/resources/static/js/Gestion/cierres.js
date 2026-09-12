// ================================================================
// Gestion/cierres.js
// Cierres de caja: dias que se despliegan para ver sus cortes.
//
// Cada dia trae dos cifras que no siempre coinciden, y se muestran
// las dos: lo vendido (las ordenes) y lo arqueado (los cortes).
// Durante el dia la diferencia es normal, porque la venta se
// archiva hasta la 1 am; despues deja de serlo y se marca.
// ================================================================

import { HOY, fmt, crearConsulta, montarPeriodo,
         leyendaPeriodo, mostrarLeyenda, hora } from './comun.js';

const API = '/admin/gestion/cierres/datos';
const consultar = crearConsulta();

const tplDia   = document.getElementById('tplDia');
const tplCorte = document.getElementById('tplCorte');

// Menos de un peso es redondeo, no un faltante.
const UMBRAL_DIFERENCIA = 1;

// ── Resumen del periodo ──────────────────────────────────────────
function pintarResumen(dias) {
    const vendido  = dias.reduce((s, d) => s + Number(d.p_venta || 0), 0);
    const arqueado = dias.reduce((s, d) => s + Number(d.p_arqueado || 0), 0);
    const falta    = vendido - arqueado;

    document.getElementById('totVendido').textContent  = fmt.dinero(vendido);
    document.getElementById('totArqueado').textContent = fmt.dinero(arqueado);

    const tira = document.getElementById('tiraDiferencia');
    tira.hidden = Math.abs(falta) < UMBRAL_DIFERENCIA;
    if (!tira.hidden) document.getElementById('totDiferencia').textContent = fmt.dinero(falta);

    document.getElementById('resumenPeriodo').hidden = dias.length === 0;
}

// ── Estado del dia ───────────────────────────────────────────────
function estadoDe(dia) {
    const falta  = Math.abs(Number(dia.p_por_arquear || 0));
    const cortes = Number(dia.n_cortes || 0);
    const vivas  = Number(dia.n_ordenes_vivas || 0);

    if (dia.d_dia_negocio === HOY) {
        return vivas > 0
            ? { texto: 'Día en curso', modo: 'curso' }
            : { texto: 'Arqueado', modo: 'ok' };
    }
    if (cortes === 0)                 return { texto: 'Sin corte',     modo: 'falta' };
    if (falta >= UMBRAL_DIFERENCIA)   return { texto: 'Falta arquear', modo: 'falta' };
    return { texto: 'Arqueado', modo: 'ok' };
}

// ── Cortes de un dia ─────────────────────────────────────────────
function pintarCortes(contenedor, cortes) {
    contenedor.replaceChildren();

    if (!cortes.length) {
        const aviso = document.createElement('p');
        aviso.className = 'mensaje-vacio';
        aviso.textContent = 'Este día no tiene cortes registrados. Sus ventas siguen sin arquear.';
        contenedor.appendChild(aviso);
        return;
    }

    cortes.forEach(corte => {
        const nodo = tplCorte.content.cloneNode(true);

        nodo.querySelector('.corte__hora-txt').textContent = hora(corte.t_fecha_cierre);
        nodo.querySelector('.corte__usuario').textContent  = corte.n_usuario_cierre || 'sin usuario';
        nodo.querySelector('.corte__ordenes').textContent  =
            fmt.plural(corte.n_total_ordenes, 'orden', 'órdenes');
        nodo.querySelector('.corte__total').textContent    = fmt.dinero(corte.p_total_general);

        // Los cortes viejos juntaron varios dias: decirlo, en vez de
        // atribuirle a un dia dinero que fue de otro.
        const notas = [];
        if (Number(corte.dias_abarcados) > 1) {
            notas.push(`Incluye ventas del ${fmt.fecha(corte.d_primer_dia)} al ${fmt.fecha(corte.d_ultimo_dia)}`);
        }
        if (corte.n_observaciones) notas.push(corte.n_observaciones);

        const nota = nodo.querySelector('.corte__nota');
        if (notas.length) nota.textContent = notas.join(' · ');
        else nota.remove();

        contenedor.appendChild(nodo);
    });
}

// ── Lista de dias ────────────────────────────────────────────────
function pintarDias(dias, cortes) {
    const lista = document.getElementById('listaDias');
    lista.replaceChildren();

    if (!dias.length) {
        const aviso = document.createElement('p');
        aviso.className = 'mensaje-vacio';
        aviso.textContent = 'No hubo ventas ni cortes en este periodo.';
        lista.appendChild(aviso);
        return;
    }

    dias.forEach(dia => {
        const nodo = tplDia.content.cloneNode(true);

        nodo.querySelector('.dia__titulo').textContent  = fmt.fecha(dia.d_dia_negocio);
        nodo.querySelector('.dia__semana').textContent  = fmt.diaSemana(dia.d_dia_negocio);
        nodo.querySelector('.dia__venta').textContent   = fmt.dineroCorto(dia.p_venta);
        nodo.querySelector('.dia__ordenes').textContent = dia.n_ordenes || 0;
        nodo.querySelector('.dia__cortes').textContent  = dia.n_cortes || 0;

        const estado   = estadoDe(dia);
        const pastilla = nodo.querySelector('.pastilla');
        pastilla.textContent = estado.texto;
        pastilla.classList.add(`pastilla--${estado.modo}`);

        nodo.querySelector('.pago-efectivo').textContent = fmt.dineroCorto(dia.p_efectivo);
        nodo.querySelector('.pago-tarjeta').textContent  = fmt.dineroCorto(dia.p_tarjeta);
        nodo.querySelector('.pago-otro').textContent     = fmt.dineroCorto(dia.p_otro);

        const detalle = nodo.querySelector('.dia__detalle');
        pintarCortes(detalle.querySelector('.cortes'),
                     cortes.filter(c => c.d_fecha_negocio === dia.d_dia_negocio));

        const boton = nodo.querySelector('.dia__cabecera');
        boton.addEventListener('click', () => {
            const abierto = boton.getAttribute('aria-expanded') === 'true';
            boton.setAttribute('aria-expanded', String(!abierto));
            detalle.hidden = abierto;
        });

        lista.appendChild(nodo);
    });
}

// ── Carga ────────────────────────────────────────────────────────
async function cargar(desde, hasta) {
    mostrarLeyenda('Cargando…');

    try {
        const datos = await consultar(`${API}?desde=${desde}&hasta=${hasta}`);
        if (!datos) return;

        const dias   = datos.dias   || [];
        const cortes = datos.cortes || [];

        pintarResumen(dias);
        pintarDias(dias, cortes);
        mostrarLeyenda(`${leyendaPeriodo(desde, hasta)} · ${fmt.plural(dias.length, 'día con movimiento', 'días con movimiento')}`);

    } catch (error) {
        console.error('Cierres:', error);
        mostrarLeyenda('No se pudieron cargar los cierres. Revisa la conexión e intenta de nuevo.');
    }
}

montarPeriodo({ onCambio: cargar, porDefecto: 'mes' });
