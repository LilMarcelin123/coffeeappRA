// ─────────────────────────────────────────────────────────────
// OperadorPantalla.js
// Polling cada 10 segundos + filtro por área
// ─────────────────────────────────────────────────────────────

let countdownSeg  = 10;
let primeraVez    = true;
let filtroActivo  = null; // null = todos, número = id_rol_preparacion

const AREA_MAP = {
    2: { clase: "area-salados",    icono: "bi bi-egg-fried",    label: "Salados"          },
    3: { clase: "area-crepas",     icono: "bi bi-layers-fill",  label: "Crepas & Waffles" },
    4: { clase: "area-bcalientes", icono: "bi bi-cup-hot-fill", label: "Beb. Calientes"   },
    5: { clase: "area-bfrias",     icono: "bi bi-cup-straw",    label: "Beb. Frías"       },
    6: { clase: "area-fitness",    icono: "bi bi-apple",        label: "Fitness"          },
};
const AREA_DEFAULT = { clase: "area-bcalientes", icono: "bi bi-cup-hot-fill", label: "Sin área" };

// Cache de los últimos datos para re-renderizar al cambiar filtro sin esperar el polling
let ultimosOrdenes     = [];
let ultimosItemsPorOrden = {};

// ── INICIO ───────────────────────────────────────────────────
$(document).ready(function () {
    actualizarHora();
    setInterval(actualizarHora, 1000);

    iniciarBotonesFiltro();
    cargarOrdenes();
    iniciarPolling();
});

// ── BOTONES DE FILTRO ─────────────────────────────────────────
function iniciarBotonesFiltro() {
    // Agrega data-rol a cada chip de la leyenda para identificarlos
    // Estructura esperada en el HTML:
    // <span class="leyenda-chip area-salados"    data-rol="2">...
    // <span class="leyenda-chip area-crepas"     data-rol="3">...
    // etc.
    document.querySelectorAll(".leyenda-chip[data-rol]").forEach(chip => {
        chip.style.cursor = "pointer";
        chip.addEventListener("click", function () {
            const rol = parseInt(this.dataset.rol);

            if (filtroActivo === rol) {
                // Click en el mismo → quitar filtro
                filtroActivo = null;
                document.querySelectorAll(".leyenda-chip[data-rol]").forEach(c => c.classList.remove("filtro-activo"));
            } else {
                filtroActivo = rol;
                document.querySelectorAll(".leyenda-chip[data-rol]").forEach(c => c.classList.remove("filtro-activo"));
                this.classList.add("filtro-activo");
            }

            // Re-renderizar con los datos en cache sin esperar el polling
            renderOrdenes(ultimosOrdenes, ultimosItemsPorOrden);
        });
    });
}

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

// ── FETCH ÓRDENES ─────────────────────────────────────────────
function cargarOrdenes() {
    $.ajax({
        url: "/operador/ordenes",
        type: "GET",
        success: function (data) {
            const ordenes = data.ordenes || [];
            const items   = data.items   || [];

            const itemsPorOrden = {};
            items.forEach(item => {
                const id = String(item.id_orden);
                if (!itemsPorOrden[id]) itemsPorOrden[id] = [];
                itemsPorOrden[id].push(item);
            });

            // Guardar en cache para uso del filtro
            ultimosOrdenes       = ordenes;
            ultimosItemsPorOrden = itemsPorOrden;

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

    // Aplicar filtro: si hay filtro activo, solo mostrar ítems de ese rol
    // y excluir órdenes que queden sin ítems tras el filtro
    let ordenesFiltradas = [];
    let itemsFiltrados   = {};

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

    // Stats: siempre muestran el total real (sin filtro)
    const totalItemsReal = Object.values(itemsPorOrden)
        .reduce((acc, arr) => acc + arr.length, 0);
    animarNum("numOrdenes", ordenes.length);
    animarNum("numItems",   totalItemsReal);

    // Sin órdenes tras el filtro
    if (ordenesFiltradas.length === 0) {
        const msg = filtroActivo
            ? `Sin órdenes con ítems de <strong>${AREA_MAP[filtroActivo]?.label || 'esta área'}</strong>.`
            : 'Sin órdenes pendientes. Todo al día.';

        grid.innerHTML = `
            <div class="op-empty-state">
                <div class="op-empty-icon">
                    <i class="bi bi-check2-circle"></i>
                </div>
                <p>${msg}</p>
            </div>`;
        return;
    }

    const tplCard = document.getElementById("tplOrdenCard");
    const tplItem = document.getElementById("tplItem");

    const idsNuevos = new Set(ordenesFiltradas.map(o => String(o.id_orden)));

    // Eliminar cards que ya no están en el filtro actual
    grid.querySelectorAll(".orden-card").forEach(el => {
        if (!idsNuevos.has(el.dataset.id)) el.remove();
    });

    grid.querySelectorAll(".op-empty-state").forEach(el => el.remove());

    ordenesFiltradas.forEach((orden, idx) => {
        const idStr = String(orden.id_orden);
        let card = grid.querySelector(`.orden-card[data-id="${idStr}"]`);

        if (!card) {
            const clone = tplCard.content.cloneNode(true);
            card = clone.querySelector(".orden-card");
            card.dataset.id = idStr;
            card.style.animationDelay = `${idx * 0.06}s`;
            grid.appendChild(card);
        }

        // Cabecera
        card.querySelector(".orden-id-val").textContent = `Orden #${orden.id_orden}`;
        const hora = orden.t_hora_creacion
            ? orden.t_hora_creacion.toString().replace("T", " ").substring(11, 16)
            : "—";
        card.querySelector(".orden-hora-val").innerHTML = `<i class="bi bi-clock"></i> ${hora}`;

        // Ítems
        const itemsEl = card.querySelector(".orden-items-list");
        itemsEl.innerHTML = "";

        const misItems = itemsFiltrados[idStr] || [];

        misItems.forEach(item => {
            const cloneItem = tplItem.content.cloneNode(true);
            const itemEl    = cloneItem.querySelector(".orden-item");

            const area = AREA_MAP[item.id_rol_preparacion] || AREA_DEFAULT;
            itemEl.classList.add(area.clase);
            itemEl.querySelector(".item-icono").innerHTML   = `<i class="${area.icono}"></i>`;
            itemEl.querySelector(".item-nombre").textContent = item.n_nombre_producto || "—";
            itemEl.querySelector(".item-badge-cantidad").textContent = `×${item.p_cantidad}`;

            const extrasEl = itemEl.querySelector(".item-extras");
            if (item.n_extras_descripcion) {
                extrasEl.textContent = item.n_extras_descripcion;
            } else {
                extrasEl.style.display = "none";
            }

            itemsEl.appendChild(cloneItem);
        });

        // Footer
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