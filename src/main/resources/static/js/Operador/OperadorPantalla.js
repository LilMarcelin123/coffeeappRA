// ═══════════════════════════════════════════════════════════════
// OperadorPantalla.js
// Panel de cocina — Polling cada 10 s + filtro por área + alerta sonora
// ═══════════════════════════════════════════════════════════════

"use strict";

// ── CONSTANTES ────────────────────────────────────────────────

const POLLING_INTERVAL_MS = 10_000;

const ENVEJECIMIENTO_ALERTA_MIN  = 60;   // minuto en que aparece el chip de alerta (1 hora)
const ENVEJECIMIENTO_CRITICO_MIN = 180;  // minuto en que llega a rojo total (3 horas)

const AREA_MAP = {
    2: { clase: "area-salados",    icono: "bi bi-egg-fried",    label: "Salados"          },
    3: { clase: "area-crepas",     icono: "bi bi-layers-fill",  label: "Crepas & Waffles" },
    4: { clase: "area-bcalientes", icono: "bi bi-cup-hot-fill", label: "Beb. Calientes"   },
    5: { clase: "area-bfrias",     icono: "bi bi-cup-straw",    label: "Beb. Frías"       },
    6: { clase: "area-fitness",    icono: "bi bi-apple",        label: "Fitness"          },
};

const AREA_DEFAULT = { clase: "area-bcalientes", icono: "bi bi-cup-hot-fill", label: "Sin área" };

const FILTROS_COCINA = {
    atras:    new Set([2, 5, 6]),
    adelante: new Set([3, 4]),
};

// ── ESTADO ────────────────────────────────────────────────────

let primeraVez        = true;
let filtroActivo      = null;
let filtroCocina      = null;
let idsConocidos      = new Set();
let countdownSeg      = POLLING_INTERVAL_MS / 1000;
let audioCtx          = null;

let ultimosOrdenes       = [];
let ultimosItemsPorOrden = {};

// ── ESTADO ITEMS TACHADOS ─────────────────────────────────────
const itemsTachados = new Set();

// ── INICIO ────────────────────────────────────────────────────

$(document).ready(() => {
    actualizarHora();
    setInterval(actualizarHora, 1000);

    document.addEventListener("click", () => obtenerAudioCtx(), { once: true });

    iniciarBotonesFiltro();
    iniciarBotonesCocina();
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
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    return audioCtx;
}

function sonarAlertar() {
    try {
        const ctx = obtenerAudioCtx();

        reproducirCampana(ctx, 880,  0.00, 1.8, 0.5);
        reproducirCampana(ctx, 1760, 0.00, 1.2, 0.2);
        reproducirCampana(ctx, 2640, 0.00, 0.8, 0.1);

        reproducirCampana(ctx, 880,  0.55, 1.8, 0.5);
        reproducirCampana(ctx, 1760, 0.55, 1.2, 0.2);
        reproducirCampana(ctx, 2640, 0.55, 0.8, 0.1);

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

    gain.gain.setValueAtTime(0, ctx.currentTime + inicioSeg);
    gain.gain.linearRampToValueAtTime(volumen, ctx.currentTime + inicioSeg + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicioSeg + duracionSeg);

    osc.start(ctx.currentTime + inicioSeg);
    osc.stop(ctx.currentTime  + inicioSeg + duracionSeg + 0.05);
}

// ── FILTRO POR ÁREA (chips individuales) ─────────────────────

function iniciarBotonesFiltro() {
    document.querySelectorAll(".leyenda-chip[data-rol]").forEach(chip => {
        chip.style.cursor = "pointer";
        chip.addEventListener("click", onClickFiltro);
    });
}

function onClickFiltro() {
    const rol = parseInt(this.dataset.rol);

    filtroCocina = null;
    limpiarActivoBotonesCocina();

    filtroActivo = filtroActivo === rol ? null : rol;

    document.querySelectorAll(".leyenda-chip[data-rol]").forEach(c => {
        c.classList.toggle("filtro-activo", parseInt(c.dataset.rol) === filtroActivo);
    });

    renderOrdenes(ultimosOrdenes, ultimosItemsPorOrden);
}

// ── FILTRO POR COCINA (botones compuestos) ────────────────────

function iniciarBotonesCocina() {
    document.querySelectorAll(".btn-cocina[data-cocina]").forEach(btn => {
        btn.addEventListener("click", onClickCocina);
    });
}

function onClickCocina() {
    const cocina = this.dataset.cocina;

    filtroActivo = null;
    document.querySelectorAll(".leyenda-chip[data-rol]").forEach(c => c.classList.remove("filtro-activo"));

    filtroCocina = filtroCocina === cocina ? null : cocina;

    document.querySelectorAll(".btn-cocina[data-cocina]").forEach(b => {
        b.classList.toggle("cocina-activa", b.dataset.cocina === filtroCocina);
    });

    renderOrdenes(ultimosOrdenes, ultimosItemsPorOrden);
}

function limpiarActivoBotonesCocina() {
    document.querySelectorAll(".btn-cocina[data-cocina]").forEach(b => b.classList.remove("cocina-activa"));
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

        let itemsVisibles;

        if (filtroCocina) {
            const rolesPermitidos = FILTROS_COCINA[filtroCocina];
            itemsVisibles = items.filter(i => rolesPermitidos.has(i.id_rol_preparacion));
        } else if (filtroActivo) {
            itemsVisibles = items.filter(i => i.id_rol_preparacion === filtroActivo);
        } else {
            itemsVisibles = items;
        }

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
    let msg;
    if (filtroCocina === "atras") {
        msg = "Sin órdenes para <strong>Cocina de Atrás</strong>.";
    } else if (filtroCocina === "adelante") {
        msg = "Sin órdenes para <strong>Cocina de Adelante</strong>.";
    } else if (filtroActivo) {
        msg = `Sin órdenes con ítems de <strong>${AREA_MAP[filtroActivo]?.label || "esta área"}</strong>.`;
    } else {
        msg = "Sin órdenes pendientes. Todo al día.";
    }

    grid.innerHTML = `
        <div class="op-empty-state">
            <div class="op-empty-icon"><i class="bi bi-check2-circle"></i></div>
            <p>${msg}</p>
        </div>`;
}

// ── SINCRONIZACIÓN DE CARDS ───────────────────────────────────

function sincronizarCards(grid, ordenesFiltradas, itemsFiltrados) {
    const idsActivos = new Set(ordenesFiltradas.map(o => String(o.id_orden)));

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

    const nombreCli = (orden.n_nombre_cliente || "").replace(/^WA:/, "");
    let elCli = card.querySelector(".op-cliente");
    if (nombreCli) {
        if (!elCli) {
            elCli = document.createElement("div");
            elCli.className = "op-cliente";
            const cab = card.querySelector(".orden-id-val");
            if (cab && cab.parentNode) cab.parentNode.insertBefore(elCli, cab.nextSibling);
            else card.appendChild(elCli);
        }
        elCli.innerHTML = '<i class="bi bi-person-fill"></i> ' + nombreCli;
    } else if (elCli) {
        elCli.remove();
    }

    // Guardar hora de creacion para el envejecimiento visual
    if (orden.t_hora_creacion) card.dataset.creacion = String(orden.t_hora_creacion);

    // Badge WhatsApp (pedido a domicilio via bot)
    const esWa = String(orden.source || "").toUpperCase() === "WHATSAPP";
    let badgeWa = card.querySelector(".op-badge-wa");
    if (esWa && !badgeWa) {
        badgeWa = document.createElement("span");
        badgeWa.className = "op-badge-wa";
        badgeWa.innerHTML = '<i class="bi bi-whatsapp"></i>';
        badgeWa.title = "Pedido por WhatsApp" + (orden.wa_tipo_entrega ? " · " + orden.wa_tipo_entrega : "");
        card.appendChild(badgeWa);
    } else if (!esWa && badgeWa) {
        badgeWa.remove();
    }

    aplicarEnvejecimiento(card);
}

function actualizarItemsCard(card, items) {
    const tpl     = document.getElementById("tplItem");
    const itemsEl = card.querySelector(".orden-items-list");
    itemsEl.innerHTML = "";

    items.forEach(item => {
        const cloneItem = tpl.content.cloneNode(true);
        const itemEl    = cloneItem.querySelector(".orden-item");
        const area      = AREA_MAP[item.id_rol_preparacion] || AREA_DEFAULT;

        // ── Clave única por item ───────────────────────────────
        const claveItem = `${item.id_orden}-${item.id_orden_item}`;

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

        // ── Estado real persistido en BD (unica fuente de verdad) ──
        const listo = String(item.n_estado_preparacion || "").toUpperCase() === "LISTO";
        if (listo) itemEl.classList.add("item-hecho");
        itemEl.dataset.idOrdenItem = item.id_orden_item;

        // ── Toggle persistente: marca en BD y refresca progreso ──
        itemEl.addEventListener("click", function () {
            const nuevoEstado = itemEl.classList.contains("item-hecho") ? "PENDIENTE" : "LISTO";
            itemEl.classList.toggle("item-hecho");
            itemEl.style.opacity = ".55";
            $.ajax({
                url: "/orden/item/estado", type: "POST",
                data: { idOrdenItem: itemEl.dataset.idOrdenItem, estado: nuevoEstado },
                success: function (r) {
                    if (!r || !r.ok) itemEl.classList.toggle("item-hecho");
                    actualizarProgresoCard(card);
                },
                error: function () {
                    itemEl.classList.toggle("item-hecho");
                    actualizarProgresoCard(card);
                },
                complete: function () { itemEl.style.opacity = ""; }
            });
        });

        itemsEl.appendChild(cloneItem);
    });

    actualizarProgresoCard(card);

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

// ════════════════════════════════════════════════════════════
// ENVEJECIMIENTO VISUAL DE ORDENES (15 min alerta → 60 min rojo)
// ════════════════════════════════════════════════════════════
function minutosDesde(tsStr) {
    if (!tsStr) return 0;
    const d = new Date(String(tsStr).replace(" ", "T"));
    if (isNaN(d.getTime())) return 0;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
}

function aplicarEnvejecimiento(card) {
    const mins = minutosDesde(card.dataset.creacion);

    // Chip de alerta (aparece a los 15 min)
    let chip = card.querySelector(".op-chip-tiempo");
    if (mins >= ENVEJECIMIENTO_ALERTA_MIN) {
        if (!chip) {
            chip = document.createElement("span");
            chip.className = "op-chip-tiempo";
            card.appendChild(chip);
        }
        chip.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> ${mins} min`;
    } else if (chip) {
        chip.remove();
    }

    // Degradado: 0-15 min normal; 15→60 min interpola hacia rojo total
    const rango = ENVEJECIMIENTO_CRITICO_MIN - ENVEJECIMIENTO_ALERTA_MIN;
    const t = Math.min(1, Math.max(0, (mins - ENVEJECIMIENTO_ALERTA_MIN) / rango));
    if (t <= 0) {
        card.style.backgroundColor = "";
        card.classList.remove("op-card-critica");
        return;
    }
    // Interpolar de blanco (255,255,255) a rojo (220,53,69)
    const r = Math.round(255 + (220 - 255) * t);
    const g = Math.round(255 + (53  - 255) * t);
    const b = Math.round(255 + (69  - 255) * t);
    card.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    card.classList.toggle("op-card-critica", t >= 0.65);
}

function refrescarEnvejecimiento() {
    document.querySelectorAll(".orden-card[data-creacion]").forEach(aplicarEnvejecimiento);
}
setInterval(refrescarEnvejecimiento, 30000);

// Estilos inyectados (badge WhatsApp, chip de tiempo y estado critico)
(function () {
    const st = document.createElement("style");
    st.textContent = `
    .orden-card { position: relative; transition: background-color 1.2s ease; }
    .op-badge-wa {
        position: absolute; top: 8px; right: 8px;
        display: inline-flex; align-items: center; justify-content: center;
        width: 26px; height: 26px; border-radius: 50%;
        background: linear-gradient(135deg,#25D366,#128C7E); color: #fff;
        font-size: .85rem; box-shadow: 0 2px 6px rgba(18,140,126,.4); z-index: 2;
    }
    .op-chip-tiempo {
        position: absolute; top: 8px; right: 40px;
        display: inline-flex; align-items: center; gap: .3rem;
        padding: .12rem .5rem; border-radius: 999px;
        background: #DC3545; color: #fff; font-size: .7rem; font-weight: 700;
        box-shadow: 0 2px 6px rgba(220,53,69,.4); z-index: 2;
        animation: opChipPulse 1.6s ease-in-out infinite;
    }
    .orden-card:not(:has(.op-badge-wa)) .op-chip-tiempo { right: 8px; }
    .op-card-critica, .op-card-critica * { color: #fff !important; }
    @keyframes opChipPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
    `;
    document.head.appendChild(st);
})();


(function () {
    const st = document.createElement("style");
    st.textContent = `
    .op-cliente {
        display:inline-flex; align-items:center; gap:.35rem;
        font-size:.82rem; font-weight:600; color:#6F4E37;
        background:#FBF6EF; border:1px solid #EFE2D2;
        padding:.15rem .55rem; border-radius:999px; margin-top:.25rem;
    }
    .op-card-critica .op-cliente { background:rgba(255,255,255,.18); border-color:rgba(255,255,255,.35); }
    `;
    document.head.appendChild(st);
})();


// ════════════════════════════════════════════════════════════
// PROGRESO DE PREPARACION (puntos, contador y orden completa)
// ════════════════════════════════════════════════════════════
function actualizarProgresoCard(card) {
    const items  = card.querySelectorAll(".orden-item");
    const total  = items.length;
    const listos = card.querySelectorAll(".orden-item.item-hecho").length;
    if (!total) return;

    let barra = card.querySelector(".op-progreso");
    if (!barra) {
        barra = document.createElement("div");
        barra.className = "op-progreso";
        const lista = card.querySelector(".orden-items-list");
        if (lista && lista.parentNode) lista.parentNode.insertBefore(barra, lista);
        else card.appendChild(barra);
    }

    let puntos = "";
    for (let i = 0; i < total; i++) {
        puntos += '<span class="op-punto' + (i < listos ? " is-listo" : "") + '"></span>';
    }
    const completa = listos === total;
    barra.innerHTML =
        '<span class="op-puntos">' + puntos + '</span>' +
        (completa
            ? '<span class="op-completa"><i class="bi bi-check-circle-fill"></i> ORDEN COMPLETA</span>'
            : '<span class="op-contador">' + listos + " / " + total + '</span>');

    card.classList.toggle("op-orden-completa", completa);
}

(function () {
    const st = document.createElement("style");
    st.textContent = `
    .op-progreso { display:flex; align-items:center; justify-content:space-between;
        gap:.6rem; margin:.5rem 0 .6rem; padding:.35rem .1rem; }
    .op-puntos { display:inline-flex; gap:.3rem; flex-wrap:wrap; }
    .op-punto { width:9px; height:9px; border-radius:50%; background:#DDD3C7;
        box-shadow:inset 0 0 0 1px rgba(0,0,0,.06); transition:background .25s ease, transform .25s ease; }
    .op-punto.is-listo { background:#2BA84A; transform:scale(1.12); }
    .op-contador { font-size:.72rem; font-weight:700; color:#8A8A8A; letter-spacing:.03em; }
    .op-completa { display:inline-flex; align-items:center; gap:.3rem; font-size:.68rem; font-weight:800;
        letter-spacing:.05em; color:#fff; background:linear-gradient(135deg,#2BA84A,#1A7F4B);
        padding:.15rem .55rem; border-radius:999px; }
    .op-orden-completa { box-shadow:0 0 0 2px #2BA84A inset; }
    `;
    document.head.appendChild(st);
})();
