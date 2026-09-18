// ================================================================
// Gestion/ritmo.js
// Ritmo — Modulo de Gestion
//
// Un mapa de dia de la semana contra hora, medido en ordenes.
//
// Se pinta el PROMEDIO por dia abierto, no el total: si el periodo
// trae tres jueves y dos viernes, el total pintaria al jueves mas
// cargado solo porque hubo mas jueves. Y el divisor cuenta dias
// abiertos, no dias del calendario, porque el Rincon cierra los
// lunes y esos ceros hundirian el promedio de ese renglon.
// ================================================================

import { crearConsulta, montarPeriodo, leyendaPeriodo, mostrarLeyenda, fmt }
    from './comun.js';

const consultar = crearConsulta();

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const dom = {
    resumen      : document.getElementById('resumen'),
    horaPico     : document.getElementById('horaPico'),
    horaPicoPie  : document.getElementById('horaPicoPie'),
    diaPico      : document.getElementById('diaPico'),
    diaPicoPie   : document.getElementById('diaPicoPie'),
    diasAbiertos : document.getElementById('diasAbiertos'),
    bloqueMapa   : document.getElementById('bloqueMapa'),
    mapaHoras    : document.getElementById('mapaHoras'),
    mapaCuerpo   : document.getElementById('mapaCuerpo'),
    mapaNota     : document.getElementById('mapaNota'),
    vacio        : document.getElementById('vacio'),
};

montarPeriodo({ onCambio: cargar, porDefecto: '7dias' });

// ── Datos ────────────────────────────────────────────────────────
async function cargar(desde, hasta) {
    mostrarLeyenda('Consultando…');

    try {
        const datos = await consultar(
            `/admin/gestion/ritmo/datos?desde=${desde}&hasta=${hasta}`);
        if (!datos) return;

        mostrarLeyenda(leyendaPeriodo(desde, hasta));
        pintar(datos.mapa ?? [], datos.dias ?? []);

    } catch (error) {
        console.error('ritmo:', error);
        mostrarLeyenda('No se pudo cargar el ritmo.');
    }
}

// ── Pintado ──────────────────────────────────────────────────────
function pintar(mapa, dias) {
    const hay = mapa.length > 0;
    dom.vacio.hidden      = hay;
    dom.resumen.hidden    = !hay;
    dom.bloqueMapa.hidden = !hay;
    if (!hay) return;

    // Cuantos dias abiertos hubo de cada dia de la semana
    const abiertos = new Map(dias.map(d => [num(d.n_dia_semana), num(d.n_dias)]));

    // Promedio de ordenes por celda
    const celdas = new Map();      // "dia-hora" → promedio
    let tope = 0;

    mapa.forEach(f => {
        const dia   = num(f.n_dia_semana);
        const hora  = num(f.n_hora);
        const veces = abiertos.get(dia) || 1;
        const prom  = num(f.n_ordenes) / veces;

        celdas.set(`${dia}-${hora}`, prom);
        if (prom > tope) tope = prom;
    });

    const horas = ordenarHoras([...new Set(mapa.map(f => num(f.n_hora)))]);
    const filas = [...abiertos.keys()].sort((a, b) => a - b);

    pintarMapa(horas, filas, celdas, abiertos, tope);
    pintarResumen(mapa, abiertos, celdas, horas, filas);
}

/**
 * El dia de negocio empieza a la 01:00, asi que la madrugada es el
 * final de la jornada, no el principio: la 1am va despues de las 11pm.
 */
function ordenarHoras(horas) {
    return horas.sort((a, b) => ((a + 23) % 24) - ((b + 23) % 24));
}

function pintarMapa(horas, filas, celdas, abiertos, tope) {
    // Encabezado
    dom.mapaHoras.replaceChildren(th('', 'col'));
    horas.forEach(h => dom.mapaHoras.appendChild(th(etiquetaHora(h), 'col')));

    // Cuerpo
    dom.mapaCuerpo.replaceChildren();

    const cargaPorDia = filas.map(d => ({
        dia: d,
        carga: horas.reduce((t, h) => t + (celdas.get(`${d}-${h}`) || 0), 0),
    }));
    const diaPico = cargaPorDia.reduce((a, b) => (b.carga > a.carga ? b : a), cargaPorDia[0]);

    filas.forEach(d => {
        const tr = document.createElement('tr');
        if (d === diaPico.dia) tr.dataset.pico = '1';

        const veces = abiertos.get(d) || 0;
        const rotulo = th(DIAS[d], 'row');
        rotulo.title = fmt.plural(veces, 'día abierto', 'días abiertos') + ' en el periodo';
        tr.appendChild(rotulo);

        horas.forEach(h => {
            const prom = celdas.get(`${d}-${h}`) || 0;
            const td   = document.createElement('td');

            td.dataset.nivel  = nivel(prom, tope);
            td.textContent    = prom > 0 ? prom.toFixed(prom < 10 ? 1 : 0) : '0';
            td.title = `${DIAS[d]}, ${etiquetaHora(h)} · ` +
                       `${prom.toFixed(1)} ${prom === 1 ? 'orden' : 'órdenes'} en promedio`;

            tr.appendChild(td);
        });

        dom.mapaCuerpo.appendChild(tr);
    });

    dom.mapaNota.textContent =
        'Cada celda es el promedio de órdenes de esa hora en ese día de la semana, ' +
        'contando solo los días que el negocio abrió.';
}

function pintarResumen(mapa, abiertos, celdas, horas, filas) {
    // Hora mas cargada, sumando todos los dias
    const porHora = new Map();
    horas.forEach(h => {
        const total = filas.reduce((t, d) => t + (celdas.get(`${d}-${h}`) || 0), 0);
        porHora.set(h, total);
    });
    const [horaTope, cargaHora] = [...porHora.entries()]
        .reduce((a, b) => (b[1] > a[1] ? b : a));

    dom.horaPico.textContent    = etiquetaHora(horaTope);
    dom.horaPicoPie.textContent =
        `${(cargaHora / filas.length).toFixed(1)} órdenes por día en promedio`;

    // Dia mas cargado
    const porDia = filas.map(d => [d, horas.reduce((t, h) => t + (celdas.get(`${d}-${h}`) || 0), 0)]);
    const [diaTope, cargaDia] = porDia.reduce((a, b) => (b[1] > a[1] ? b : a));

    dom.diaPico.textContent    = DIAS[diaTope];
    dom.diaPicoPie.textContent = `${cargaDia.toFixed(0)} órdenes en un día típico`;

    dom.diasAbiertos.textContent = [...abiertos.values()].reduce((t, n) => t + n, 0);
}

// ── Apoyos ───────────────────────────────────────────────────────

/** Cuatro escalones: el ojo compara pasos, no rampas continuas. */
function nivel(valor, tope) {
    if (valor <= 0 || tope <= 0) return 0;
    const parte = valor / tope;
    if (parte <= .25) return 1;
    if (parte <= .50) return 2;
    if (parte <= .75) return 3;
    return 4;
}

function etiquetaHora(h) {
    const ampm = h < 12 ? 'am' : 'pm';
    const doce = h % 12 === 0 ? 12 : h % 12;
    return `${doce}${ampm}`;
}

function th(texto, alcance) {
    const el = document.createElement('th');
    el.scope = alcance;
    el.textContent = texto;
    return el;
}

const num = (v) => Number(v ?? 0);
