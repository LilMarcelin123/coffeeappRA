// ═══════════════════════════════════════════════════════════════
// OperadorPantalla.js
// Panel de cocina — Polling cada 10 s + filtro por área + alerta sonora
// ═══════════════════════════════════════════════════════════════

"use strict";

// ── CONSTANTES ────────────────────────────────────────────────

const POLLING_INTERVAL_MS = 10_000;

const AREA_MAP = {
    2: { clase: "area-salados",    icono: "bi bi-egg-fried",    label: "Salados"          },
    3: { clase: "area-crepas",     icono: "bi bi-layers-fill",  label: "Crepas & Waffles" },
    4: { clase: "area-bcalientes", icono: "bi bi-cup-hot-fill", label: "Beb. Calientes"   },
    5: { clase: "area-bfrias",     icono: "bi bi-cup-straw",    label: "Beb. Frías"       },
    6: { clase: "area-fitness",    icono: "bi bi-apple",        label: "Fitness"          },
};

const AREA_DEFAULT = { clase: "area-bcalientes", icono: "bi bi-cup-hot-fill", label: "Sin área" };

// ── ESTADO ────────────────────────────────────────────────────

let primeraVez        = true;
let filtroActivo      = null;   // null = todos, número = id_rol_preparacion
let idsConocidos      = new Set();
let countdownSeg      = POLLING_INTERVAL_MS / 1000;
let audioCtx          = null;

// Cache para re-renderizar al cambiar filtro sin esperar el polling
let ultimosOrdenes       = [];
let ultimosItemsPorOrden = {};

// ── INICIO ────────────────────────────────────────────────────

$(document).ready(() => {
    actualizarHora();
    setInterval(actualizarHora, 1000);

    // Inicializar AudioContext en el primer click del usuario
    // (los navegadores requieren interacción antes de permitir audio)
    document.addEventListener("click", () => obtenerAudioCtx(), { once: true });

    iniciarBotonesFiltro();
    cargarOrdenes();
    iniciarPolling();
});

// ── POLLING ───────────────────────────────────────────────────

function iniciarPolling() {
    setInterval(() => {
        countdownSeg--;
        actualizarCountdownUI(countdownSeg);

        if (countdownSeg <= 0) {
            countdownSeg = POLLING_INTERVAL_MS / 1000;
            cargarOrdenes();
            animarIconoRefresh();
        }
    }, 1000);
}

function actualizarCountdownUI(seg) {
    const texto = `${seg}s`;
    $("#countdownDisplay").text(texto);
    $("#countdownMobile").text(texto);
}

function animarIconoRefresh() {
    const icon = document.getElementById("iconRefresh");
    if (!icon) return;
    icon.classList.add("spinning");
    setTimeout(() => icon.classList.remove("spinning"), 650);
}

// ── FETCH ÓRDENES ─────────────────────────────────────────────

function cargarOrdenes() {
    $.ajax({
        url:  "/operador/ordenes",
        type: "GET",
        success: onOrdenesSuccess,
        error:   onOrdenesError,
    });
}

function onOrdenesSuccess(data) {
    const ordenes = data.ordenes || [];
    const items   = data.items   || [];

    const itemsPorOrden = agruparItemsPorOrden(items);

    detectarYAlertarOrdenesNuevas(ordenes);

    ultimosOrdenes       = ordenes;
    ultimosItemsPorOrden = itemsPorOrden;

    renderOrdenes(ordenes, itemsPorOrden);
}

function onOrdenesError(xhr) {
    console.error("Error al cargar órdenes:", xhr.responseText);
    if (primeraVez) mostrarError();
}

function agruparItemsPorOrden(items) {
    return items.reduce((acc, item) => {
        const id = String(item.id_orden);
        if (!acc[id]) acc[id] = [];
        acc[id].push(item);
        return acc;
    }, {});
}

// ── DETECCIÓN DE ÓRDENES NUEVAS ───────────────────────────────

function detectarYAlertarOrdenesNuevas(ordenes) {
    const idsActuales = new Set(ordenes.map(o => String(o.id_orden)));

    if (!primeraVez) {
        const hayNuevas = [...idsActuales].some(id => !idsConocidos.has(id));
        if (hayNuevas) sonarAlertar();
    }

    idsConocidos = idsActuales;
}

// ── ALERTA SONORA ─────────────────────────────────────────────

function obtenerAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // El navegador suspende el contexto si no hubo interacción — lo reanudamos
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    return audioCtx;
}

function sonarAlertar() {
    try {
        const ctx = obtenerAudioCtx();

        // Primera campanada — tono principal + armónicos (timbre metálico)
        reproducirCampana(ctx, 880,  0.00, 1.8, 0.5);
        reproducirCampana(ctx, 1760, 0.00, 1.2, 0.2);
        reproducirCampana(ctx, 2640, 0.00, 0.8, 0.1);

        // Segunda campanada
        reproducirCampana(ctx, 880,  0.55, 1.8, 0.5);
        reproducirCampana(ctx, 1760, 0.55, 1.2, 0.2);
        reproducirCampana(ctx, 2640, 0.55, 0.8, 0.1);

        // Tercera campanada (más suave, efecto eco)
        reproducirCampana(ctx, 880,  1.10, 1.8, 0.3);
        reproducirCampana(ctx, 1760, 1.10, 1.2, 0.12);
        reproducirCampana(ctx, 2640, 1.10, 0.8, 0.06);

    } catch (e) {
        console.warn("Audio no disponible:", e);
    }
}

function reproducirCampana(ctx, frecuencia, inicioSeg, duracionSeg, volumen = 0.4) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type            = "sine";
    osc.frequency.value = frecuencia;

    // Ataque instantáneo (5 ms) + decaimiento exponencial largo → timbre de campana
    gain.gain.setValueAtTime(0, ctx.currentTime + inicioSeg);
    gain.gain.linearRampToValueAtTime(volumen, ctx.currentTime + inicioSeg + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicioSeg + duracionSeg);

    osc.start(ctx.currentTime + inicioSeg);
    osc.stop(ctx.currentTime  + inicioSeg + duracionSeg + 0.05);
}

// ── FILTRO POR ÁREA ───────────────────────────────────────────

function iniciarBotonesFiltro() {
    document.querySelectorAll(".leyenda-chip[data-rol]").forEach(chip => {
        chip.style.cursor = "pointer";
        chip.addEventListener("click", onClickFiltro);
    });
}

function onClickFiltro() {
    const rol = parseInt(this.dataset.rol);

    filtroActivo = filtroActivo === rol ? null : rol;

    document.querySelectorAll(".leyenda-chip[data-rol]").forEach(c => {
        c.classList.toggle("filtro-activo", parseInt(c.dataset.rol) === filtroActivo);
    });

    // Re-renderizar con datos en cache sin esperar el polling
    renderOrdenes(ultimosOrdenes, ultimosItemsPorOrden);
}

// ── RENDER PRINCIPAL ──────────────────────────────────────────

function renderOrdenes(ordenes, itemsPorOrden) {
    primeraVez = false;

    const grid = document.getElementById("ordenesGrid");

    const { ordenesFiltradas, itemsFiltrados } = aplicarFiltro(ordenes, itemsPorOrden);

    actualizarStats(ordenes, itemsPorOrden);

    if (ordenesFiltradas.length === 0) {
        mostrarEstadoVacio(grid);
        return;
    }

    sincronizarCards(grid, ordenesFiltradas, itemsFiltrados);
}

function aplicarFiltro(ordenes, itemsPorOrden) {
    const ordenesFiltradas = [];
    const itemsFiltrados   = {};

    ordenes.forEach(orden => {
        const idStr = String(orden.id_orden);
        const items = itemsPorOrden[idStr] || [];

        const itemsVisibles = filtroActivo
            ? items.filter(i => i.id_rol_preparacion === filtroActivo)
            : items;

        if (itemsVisibles.length > 0) {
            ordenesFiltradas.push(orden);
            itemsFiltrados[idStr] = itemsVisibles;
        }
    });

    return { ordenesFiltradas, itemsFiltrados };
}

function actualizarStats(ordenes, itemsPorOrden) {
    const totalItems = Object.values(itemsPorOrden).reduce((acc, arr) => acc + arr.length, 0);
    animarNum("numOrdenes", ordenes.length);
    animarNum("numItems",   totalItems);
}

function mostrarEstadoVacio(grid) {
    const msg = filtroActivo
        ? `Sin órdenes con ítems de <strong>${AREA_MAP[filtroActivo]?.label || "esta área"}</strong>.`
        : "Sin órdenes pendientes. Todo al día.";

    grid.innerHTML = `
        <div class="op-empty-state">
            <div class="op-empty-icon"><i class="bi bi-check2-circle"></i></div>
            <p>${msg}</p>
        </div>`;
}

// ── SINCRONIZACIÓN DE CARDS ───────────────────────────────────

function sincronizarCards(grid, ordenesFiltradas, itemsFiltrados) {
    const idsActivos = new Set(ordenesFiltradas.map(o => String(o.id_orden)));

    // Eliminar cards que ya no aplican
    grid.querySelectorAll(".orden-card").forEach(el => {
        if (!idsActivos.has(el.dataset.id)) el.remove();
    });

    grid.querySelectorAll(".op-empty-state").forEach(el => el.remove());

    ordenesFiltradas.forEach((orden, idx) => {
        const idStr = String(orden.id_orden);
        const card  = obtenerOCrearCard(grid, idStr, idx);

        actualizarCabeceraCard(card, orden);
        actualizarItemsCard(card, itemsFiltrados[idStr] || []);
    });
}

function obtenerOCrearCard(grid, idStr, idx) {
    let card = grid.querySelector(`.orden-card[data-id="${idStr}"]`);

    if (!card) {
        const tpl   = document.getElementById("tplOrdenCard");
        const clone = tpl.content.cloneNode(true);
        card = clone.querySelector(".orden-card");
        card.dataset.id           = idStr;
        card.style.animationDelay = `${idx * 0.06}s`;
        grid.appendChild(card);
    }

    return card;
}

function actualizarCabeceraCard(card, orden) {
    card.querySelector(".orden-id-val").textContent = `Orden #${orden.id_orden}`;

    const hora = orden.t_hora_creacion
        ? String(orden.t_hora_creacion).replace("T", " ").substring(11, 16)
        : "—";

    card.querySelector(".orden-hora-val").innerHTML = `<i class="bi bi-clock"></i> ${hora}`;
}

function actualizarItemsCard(card, items) {
    const tpl     = document.getElementById("tplItem");
    const itemsEl = card.querySelector(".orden-items-list");
    itemsEl.innerHTML = "";

    items.forEach(item => {
        const cloneItem = tpl.content.cloneNode(true);
        const itemEl    = cloneItem.querySelector(".orden-item");
        const area      = AREA_MAP[item.id_rol_preparacion] || AREA_DEFAULT;

        itemEl.classList.add(area.clase);
        itemEl.querySelector(".item-icono").innerHTML            = `<i class="${area.icono}"></i>`;
        itemEl.querySelector(".item-nombre").textContent         = item.n_nombre_producto || "—";
        itemEl.querySelector(".item-badge-cantidad").textContent = `×${item.p_cantidad}`;

        const extrasEl = itemEl.querySelector(".item-extras");
        if (item.n_extras_descripcion) {
            extrasEl.textContent = item.n_extras_descripcion;
        } else {
            extrasEl.style.display = "none";
        }

        itemsEl.appendChild(cloneItem);
    });

    card.querySelector(".orden-items-count").textContent =
        `${items.length} ítem${items.length !== 1 ? "s" : ""}`;
}

// ── HELPERS ───────────────────────────────────────────────────

function actualizarHora() {
    const ahora = new Date();
    const h = String(ahora.getHours()).padStart(2, "0");
    const m = String(ahora.getMinutes()).padStart(2, "0");
    $("#horaActual").text(`${h}:${m}`);
}

function animarNum(id, valor) {
    const el = document.getElementById(id);
    if (!el) return;

    el.style.opacity   = "0";
    el.style.transform = "translateY(4px)";

    setTimeout(() => {
        el.textContent      = valor;
        el.style.transition = "opacity .3s ease, transform .3s ease";
        el.style.opacity    = "1";
        el.style.transform  = "translateY(0)";
    }, 120);
}

function mostrarError() {
    document.getElementById("ordenesGrid").innerHTML = `
        <div class="op-empty-state">
            <div class="op-empty-icon"><i class="bi bi-exclamation-triangle"></i></div>
            <p>Error al cargar las órdenes. Reintentando…</p>
        </div>`;
}