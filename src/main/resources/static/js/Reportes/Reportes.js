// ─────────────────────────────────────────────────────────────
// Reportes.js  —  /js/Reportes/Reportes.js
// Rincón Arboledas · módulo de reportes y corte de caja
// ─────────────────────────────────────────────────────────────

/* ── CONSTANTES ─────────────────────────────────────────────── */
const API = {
    detalle : "/admin/reportes/detalle",
    corte   : "/admin/reportes/corte",
    excel   : "/admin/reportes/excel",
};

const SUFIJO_EXCEL = { 1: "_efectivo", 2: "_tarjeta" };

const METODO = {
    EFECTIVO      : "EFECTIVO",
    TARJETA       : "TARJETA",
    TOTAL_GENERAL : "TOTAL GENERAL",
};

/* ── ESTADO DEL MÓDULO ─────────────────────────────────────── */
const estado = {
    filtroActivo  : null,   // null = todos | 1 = efectivo | 2 = tarjeta
    datosDetalle  : [],     // cache de la última respuesta de detalle
};

/* ── REFERENCIAS DOM ────────────────────────────────────────── */
const dom = {
    tbodyDetalle   : () => document.getElementById("tbodyDetalle"),
    tbodyCorte     : () => document.getElementById("tbodyCorte"),
    labelConteo    : () => document.getElementById("labelConteo"),
    wrapTablaCorte : () => document.getElementById("wrapTablaCorte"),
    btnCorte       : () => document.getElementById("btnGenerarCorte"),
    totalGeneral   : () => document.getElementById("totalGeneral"),
    totalEfectivo  : () => document.getElementById("totalEfectivo"),
    totalTarjeta   : () => document.getElementById("totalTarjeta"),
    totalOrdenes   : () => document.getElementById("totalOrdenes"),
};

/* ════════════════════════════════════════════════════════════
   INICIALIZACIÓN
   ════════════════════════════════════════════════════════════ */
$(document).ready(() => {

    cargarDetalle(null);

    /* Filtros de método de pago */
    $(".filter-pill").on("click", function () {
        $(".filter-pill").removeClass("active").attr("aria-pressed", "false");
        $(this).addClass("active").attr("aria-pressed", "true");

        const val = $(this).data("filtro");
        estado.filtroActivo = val === "" ? null : parseInt(val, 10);
        cargarDetalle(estado.filtroActivo);
    });

    /* Búsqueda local */
    $("#inputBuscar").on("input", function () {
        filtrarTablaLocal($(this).val().trim().toLowerCase());
    });

    /* Corte */
    $("#btnGenerarCorte").on("click", cargarCorte);

    /* Descargas Excel */
    $("#btnDescargaDetalle").on("click", function () {
        descargarExcel(null, this);
    });

    $("#btnDescargaFiltro").on("click", function () {
        descargarExcel(estado.filtroActivo, this);
    });

});

/* ════════════════════════════════════════════════════════════
   DETALLE DE ÓRDENES
   ════════════════════════════════════════════════════════════ */
function cargarDetalle(idTipoPago) {
    const params = idTipoPago != null ? { idTipoPago } : {};
    renderEstadoTabla(dom.tbodyDetalle(), "loading");

    $.ajax({
        url     : API.detalle,
        type    : "GET",
        data    : params,
        success(lista) {
            estado.datosDetalle = lista ?? [];
            renderTablaDetalle(estado.datosDetalle);
            actualizarConteo(estado.datosDetalle.length);
        },
        error(xhr) {
            console.error("Error detalle:", xhr.responseText);
            renderEstadoTabla(dom.tbodyDetalle(), "error");
        },
    });
}

function renderTablaDetalle(lista) {
    const tbody = dom.tbodyDetalle();
    tbody.innerHTML = "";

    if (!lista?.length) {
        renderEstadoTabla(tbody, "empty");
        return;
    }

    const fragment = document.createDocumentFragment();

    lista.forEach((row, idx) => {
        const metodo     = String(row.metodo_pago ?? "").toUpperCase();
        const esEfectivo = metodo === METODO.EFECTIVO;
        const badgeClass = esEfectivo ? "badge-efectivo" : "badge-tarjeta";
        const badgeIcon  = esEfectivo
            ? '<i class="bi bi-cash-coin" aria-hidden="true"></i>'
            : '<i class="bi bi-credit-card-fill" aria-hidden="true"></i>';

        const total = row.total != null
            ? `$${Number(row.total).toFixed(2)}`
            : "$0.00";

        const hora = row.hora_cierre
            ? String(row.hora_cierre).replace("T", " ").substring(0, 19)
            : "—";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="color:var(--text-muted);font-size:.78rem;">${idx + 1}</td>
            <td><strong>#${row.id_orden ?? "—"}</strong></td>
            <td style="font-size:.82rem;color:var(--text-muted);">${hora}</td>
            <td style="font-size:.82rem;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${row.resumen ?? "—"}
            </td>
            <td><span class="${badgeClass}">${badgeIcon} ${metodo || "—"}</span></td>
            <td class="td-total">${total}</td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

function filtrarTablaLocal(q) {
    if (!q) {
        renderTablaDetalle(estado.datosDetalle);
        actualizarConteo(estado.datosDetalle.length);
        return;
    }

    const filtrados = estado.datosDetalle.filter(row =>
        String(row.id_orden    ?? "").includes(q) ||
        String(row.resumen     ?? "").toLowerCase().includes(q) ||
        String(row.metodo_pago ?? "").toLowerCase().includes(q)
    );

    renderTablaDetalle(filtrados);
    dom.labelConteo().textContent = `${filtrados.length} de ${estado.datosDetalle.length} registros`;
}

/* ════════════════════════════════════════════════════════════
   CORTE DE CAJA
   ════════════════════════════════════════════════════════════ */
function cargarCorte() {
    const btn = dom.btnCorte();
    setBotonCargando(btn, true, "Calculando…");

    $.ajax({
        url: API.corte,
        type: "GET",
        success(lista) {
            setBotonCargando(btn, false, '<i class="bi bi-play-circle-fill"></i> Generar corte');

            if (!lista?.length) {
                resetCardsCorte();
                return;
            }

            renderCardsCorte(lista);
            renderTablaCorte(lista);
            dom.wrapTablaCorte().style.display = "block";
        },
        error(xhr) {
            setBotonCargando(btn, false, '<i class="bi bi-play-circle-fill"></i> Generar corte');
            console.error("Error corte:", xhr.responseText);
            alert("No se pudo generar el corte.");
        },
    });
}

function renderCardsCorte(lista) {
    const totales = { general: 0, efectivo: 0, tarjeta: 0, ordenes: 0 };

    lista.forEach(row => {
        const metodo  = String(row.metodo_pago ?? "").toUpperCase();
        const monto   = Number(row.total_monto   ?? 0);
        const ordenes = Number(row.total_ordenes  ?? 0);

        if      (metodo === METODO.TOTAL_GENERAL) { totales.general  = monto;   totales.ordenes = ordenes; }
        else if (metodo === METODO.EFECTIVO)      { totales.efectivo = monto; }
        else if (metodo === METODO.TARJETA)       { totales.tarjeta  = monto; }
    });

    animarValor(dom.totalGeneral(),  `$${totales.general.toFixed(2)}`);
    animarValor(dom.totalEfectivo(), `$${totales.efectivo.toFixed(2)}`);
    animarValor(dom.totalTarjeta(),  `$${totales.tarjeta.toFixed(2)}`);
    animarValor(dom.totalOrdenes(),  String(totales.ordenes));
}

function renderTablaCorte(lista) {
    const tbody    = dom.tbodyCorte();
    tbody.innerHTML = "";
    const fragment = document.createDocumentFragment();

    lista.forEach(row => {
        const metodo  = row.metodo_pago ?? "—";
        const ordenes = row.total_ordenes ?? 0;
        const monto   = Number(row.total_monto ?? 0);
        const esTotal = metodo.toUpperCase() === METODO.TOTAL_GENERAL;

        const tr = document.createElement("tr");
        if (esTotal) tr.style.fontWeight = "700";

        tr.innerHTML = `
            <td>${esTotal ? `<strong>${metodo}</strong>` : metodo}</td>
            <td>${ordenes}</td>
            <td class="td-total">$${monto.toFixed(2)}</td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

function resetCardsCorte() {
    [dom.totalGeneral(), dom.totalEfectivo(), dom.totalTarjeta(), dom.totalOrdenes()]
        .forEach(el => { if (el) el.textContent = "—"; });
}

/* ════════════════════════════════════════════════════════════
   DESCARGA EXCEL
   ════════════════════════════════════════════════════════════ */
async function descargarExcel(idTipoPago, btnEl) {
    const textoOriginal = btnEl.innerHTML;
    setBotonCargando(btnEl, true, "Generando…");

    const sufijo = SUFIJO_EXCEL[idTipoPago] ?? "_todos";
    const query  = idTipoPago != null ? `?idTipoPago=${idTipoPago}` : "";
    const url    = `${API.excel}${query}`;
    const hoy    = new Date().toISOString().slice(0, 10);

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Error ${response.status}`);

        const blob      = await response.blob();
        const objectURL = URL.createObjectURL(blob);
        const link      = document.createElement("a");

        link.href     = objectURL;
        link.download = `detalle_ordenes${sufijo}_${hoy}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectURL);

    } catch (err) {
        console.error("Error al descargar Excel:", err);
        alert("No se pudo generar el Excel. Intenta de nuevo.");
    } finally {
        setBotonCargando(btnEl, false, textoOriginal);
    }
}

/* ════════════════════════════════════════════════════════════
   UTILIDADES
   ════════════════════════════════════════════════════════════ */

/**
 * Renderiza un estado visual en un tbody (loading | empty | error).
 * @param {HTMLElement} tbody
 * @param {"loading"|"empty"|"error"} tipo
 */
function renderEstadoTabla(tbody, tipo) {
    const estados = {
        loading : { icon: "bi-arrow-down-circle", texto: "Cargando datos…"            },
        empty   : { icon: "bi-inbox",             texto: "Sin órdenes cerradas hoy"   },
        error   : { icon: "bi-exclamation-circle",texto: "Error al cargar los datos"  },
    };

    const { icon, texto } = estados[tipo] ?? estados.empty;
    const cols = tbody.closest("table")?.querySelectorAll("thead th")?.length ?? 6;

    tbody.innerHTML = `
        <tr>
            <td colspan="${cols}">
                <div class="empty-state">
                    <i class="bi ${icon}" aria-hidden="true"></i>
                    <span>${texto}</span>
                </div>
            </td>
        </tr>`;
}

/**
 * Habilita o deshabilita un botón y cambia su texto mientras está cargando.
 * @param {HTMLElement} btn
 * @param {boolean} cargando
 * @param {string} textoCargando  — HTML del texto mientras carga
 */
function setBotonCargando(btn, cargando, textoCargando) {
    btn.disabled = cargando;
    if (cargando) {
        btn.innerHTML = `<i class="bi bi-hourglass-split" aria-hidden="true"></i> ${textoCargando}`;
    } else {
        btn.innerHTML = textoCargando;   // texto original restaurado por el caller
    }
}

/**
 * Anima el cambio de valor de un elemento con fade + slide.
 * @param {HTMLElement} el
 * @param {string} nuevoValor
 */
function animarValor(el, nuevoValor) {
    if (!el) return;
    el.style.opacity   = "0";
    el.style.transform = "translateY(6px)";

    setTimeout(() => {
        el.textContent     = nuevoValor;
        el.style.transition = "opacity .35s ease, transform .35s ease";
        el.style.opacity   = "1";
        el.style.transform = "translateY(0)";
    }, 150);
}

/**
 * Actualiza el texto del contador de registros.
 * @param {number} n
 */
function actualizarConteo(n) {
    const el = dom.labelConteo();
    if (el) el.textContent = `${n} registro${n !== 1 ? "s" : ""}`;
}