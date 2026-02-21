// ─────────────────────────────────────────────────────────────
// OperadorPantalla.js
// /js/Operador/OperadorPantalla.js
// Polling cada 10 segundos — proceso 7 (ordenes + items por rol)
// ─────────────────────────────────────────────────────────────

let countdownSeg = 10;
let primeraVez   = true;

// ── Mapa de áreas por id_rol_preparacion ─────────────────────
const AREA_MAP = {
    2: { clase: "area-salados",    icono: "bi bi-egg-fried",    label: "Salados"          },
    3: { clase: "area-crepas",     icono: "bi bi-layers-fill",  label: "Crepas & Waffles" },
    4: { clase: "area-bcalientes", icono: "bi bi-cup-hot-fill", label: "Beb. Calientes"   },
    5: { clase: "area-bfrias",     icono: "bi bi-cup-straw",    label: "Beb. Frías"       },
    6: { clase: "area-fitness",    icono: "bi bi-apple",        label: "Fitness"          },
};
const AREA_DEFAULT = { clase: "area-bcalientes", icono: "bi bi-cup-hot-fill", label: "Sin área" };

// ── INICIO ───────────────────────────────────────────────────
$(document).ready(function () {
    actualizarHora();
    setInterval(actualizarHora, 1000);

    cargarOrdenes();
    iniciarPolling();
});

// ── POLLING ───────────────────────────────────────────────────
function iniciarPolling() {
    setInterval(() => {
        countdownSeg--;
        $("#countdownDisplay").text(countdownSeg + "s");

        if (countdownSeg <= 0) {
            countdownSeg = 10;
            cargarOrdenes();

            const icon = document.getElementById("iconRefresh");
            icon.classList.add("spinning");
            setTimeout(() => icon.classList.remove("spinning"), 650);
        }
    }, 1000);
}

// ── FETCH ÓRDENES (proceso 7) ─────────────────────────────────
function cargarOrdenes() {
    $.ajax({
        url: "/operador/ordenes",
        type: "GET",
        success: function (data) {
            const ordenes = data.ordenes || [];
            const items   = data.items   || [];

            // Agrupar ítems por id_orden para acceso rápido
            const itemsPorOrden = {};
            items.forEach(item => {
                const id = String(item.id_orden);
                if (!itemsPorOrden[id]) itemsPorOrden[id] = [];
                itemsPorOrden[id].push(item);
            });

            renderOrdenes(ordenes, itemsPorOrden);
        },
        error: function (xhr) {
            console.error("Error al cargar órdenes:", xhr.responseText);
            if (primeraVez) mostrarError();
        }
    });
}

// ── RENDER PRINCIPAL ──────────────────────────────────────────
function renderOrdenes(ordenes, itemsPorOrden) {
    primeraVez = false;
    const grid = document.getElementById("ordenesGrid");

    // Actualizar stats
    const totalItems = Object.values(itemsPorOrden)
        .reduce((acc, arr) => acc + arr.length, 0);
    animarNum("numOrdenes", ordenes.length);
    animarNum("numItems",   totalItems);

    // Sin órdenes
    if (ordenes.length === 0) {
        grid.innerHTML = `
            <div class="op-empty-state">
                <div class="op-empty-icon">
                    <i class="bi bi-check2-circle"></i>
                </div>
                <p>Sin órdenes pendientes. Todo al día.</p>
            </div>`;
        return;
    }

    const tplCard = document.getElementById("tplOrdenCard");
    const tplItem = document.getElementById("tplItem");

    const idsNuevos = new Set(ordenes.map(o => String(o.id_orden)));

    // Eliminar cards que ya no están
    grid.querySelectorAll(".orden-card").forEach(el => {
        if (!idsNuevos.has(el.dataset.id)) el.remove();
    });

    // Limpiar empty state si existía
    grid.querySelectorAll(".op-empty-state").forEach(el => el.remove());

    // Crear o actualizar cada card
    ordenes.forEach((orden, idx) => {
        const idStr = String(orden.id_orden);
        let card = grid.querySelector(`.orden-card[data-id="${idStr}"]`);

        if (!card) {
            const clone = tplCard.content.cloneNode(true);
            card = clone.querySelector(".orden-card");
            card.dataset.id = idStr;
            card.style.animationDelay = `${idx * 0.06}s`;
            grid.appendChild(card);
        }

        // ── Cabecera ──────────────────────────────────────────
        card.querySelector(".orden-id-val").textContent = `Orden #${orden.id_orden}`;

        const hora = orden.t_hora_creacion
            ? orden.t_hora_creacion.toString().replace("T", " ").substring(11, 16)
            : "—";
        card.querySelector(".orden-hora-val").innerHTML =
            `<i class="bi bi-clock"></i> ${hora}`;

        // ── Ítems ─────────────────────────────────────────────
        const itemsEl = card.querySelector(".orden-items-list");
        itemsEl.innerHTML = "";

        const misItems = itemsPorOrden[idStr] || [];

        misItems.forEach(item => {
            const cloneItem = tplItem.content.cloneNode(true);
            const itemEl    = cloneItem.querySelector(".orden-item");

            const area = AREA_MAP[item.id_rol_preparacion] || AREA_DEFAULT;
            itemEl.classList.add(area.clase);

            itemEl.querySelector(".item-icono").innerHTML =
                `<i class="${area.icono}"></i>`;

            itemEl.querySelector(".item-nombre").textContent =
                item.n_nombre_producto || "—";

            itemEl.querySelector(".item-badge-cantidad").textContent =
                `×${item.p_cantidad}`;

            const extrasEl = itemEl.querySelector(".item-extras");
            if (item.n_extras_descripcion) {
                extrasEl.textContent = item.n_extras_descripcion;
            } else {
                extrasEl.style.display = "none";
            }

            itemsEl.appendChild(cloneItem);
        });

        // ── Footer: conteo de ítems ───────────────────────────
        card.querySelector(".orden-items-count").textContent =
            `${misItems.length} ítem${misItems.length !== 1 ? "s" : ""}`;
    });
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
            <div class="op-empty-icon">
                <i class="bi bi-exclamation-triangle"></i>
            </div>
            <p>Error al cargar las órdenes. Reintentando…</p>
        </div>`;
}