// ─────────────────────────────────────────────────────────────
// Reportes.js
// /js/Reportes/Reportes.js
// ─────────────────────────────────────────────────────────────

let filtroActivo = null;      // null = todos, 1 = efectivo, 2 = tarjeta
let datosDetalle = [];        // cache de la última respuesta

// ── AL CARGAR ────────────────────────────────────────────────
$(document).ready(function () {

    cargarDetalle(null);

    $(".filter-pill").on("click", function () {
        $(".filter-pill").removeClass("active");
        $(this).addClass("active");

        const filtro = $(this).data("filtro");
        filtroActivo = filtro === "" ? null : parseInt(filtro);
        cargarDetalle(filtroActivo);
    });

    $("#inputBuscar").on("input", function () {
        const q = $(this).val().toLowerCase().trim();
        filtrarTablaLocal(q);
    });

    $("#btnGenerarCorte").on("click", function () {
        cargarCorte();
    });

    $("#btnDescargaDetalle").on("click", function () {
        descargarExcel(null, this);
    });

    $("#btnDescargaFiltro").on("click", function () {
        descargarExcel(filtroActivo, this);
    });
});

// ── DETALLE DE ÓRDENES ───────────────────────────────────────
function cargarDetalle(idTipoPago) {
    const params = idTipoPago != null ? { idTipoPago } : {};

    mostrarLoadingDetalle();

    $.ajax({
        url: "/admin/reportes/detalle",
        type: "GET",
        data: params,
        success: function (lista) {
            datosDetalle = lista || [];
            renderTablaDetalle(datosDetalle);
            $("#labelConteo").text(`${datosDetalle.length} registro${datosDetalle.length !== 1 ? "s" : ""}`);
        },
        error: function (xhr) {
            console.error("Error detalle:", xhr.responseText);
            mostrarErrorDetalle();
        }
    });
}

function renderTablaDetalle(lista) {
    const tbody = document.getElementById("tbodyDetalle");
    tbody.innerHTML = "";

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        <i class="bi bi-inbox"></i>
                        <span>Sin órdenes cerradas hoy</span>
                    </div>
                </td>
            </tr>`;
        return;
    }

    lista.forEach((row, idx) => {
        const metodo     = (row.metodo_pago || "").toString().toUpperCase();
        const badgeClass = metodo === "EFECTIVO" ? "badge-efectivo" : "badge-tarjeta";
        const badgeIcon  = metodo === "EFECTIVO"
            ? '<i class="bi bi-cash-coin"></i>'
            : '<i class="bi bi-credit-card-fill"></i>';

        const total = row.total != null
            ? `$${Number(row.total).toFixed(2)}`
            : "$0.00";

        const hora = row.hora_cierre
            ? row.hora_cierre.toString().replace("T", " ").substring(0, 19)
            : "—";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="color:var(--text-muted); font-size:.78rem;">${idx + 1}</td>
            <td><strong>#${row.id_orden ?? "—"}</strong></td>
            <td style="font-size:.82rem; color:var(--text-muted);">${hora}</td>
            <td style="font-size:.82rem; max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${row.resumen || "—"}
            </td>
            <td>
                <span class="${badgeClass}">
                    ${badgeIcon} ${metodo || "—"}
                </span>
            </td>
            <td class="td-total">${total}</td>
        `;
        tbody.appendChild(tr);
    });
}

function filtrarTablaLocal(q) {
    if (!q) {
        renderTablaDetalle(datosDetalle);
        return;
    }

    const filtrados = datosDetalle.filter(row => {
        return (
            String(row.id_orden    ?? "").includes(q) ||
            String(row.resumen     ?? "").toLowerCase().includes(q) ||
            String(row.metodo_pago ?? "").toLowerCase().includes(q)
        );
    });

    renderTablaDetalle(filtrados);
    $("#labelConteo").text(`${filtrados.length} de ${datosDetalle.length} registros`);
}

function mostrarLoadingDetalle() {
    document.getElementById("tbodyDetalle").innerHTML = `
        <tr>
            <td colspan="6">
                <div class="empty-state">
                    <i class="bi bi-arrow-down-circle"></i>
                    <span>Cargando datos…</span>
                </div>
            </td>
        </tr>`;
}

function mostrarErrorDetalle() {
    document.getElementById("tbodyDetalle").innerHTML = `
        <tr>
            <td colspan="6">
                <div class="empty-state">
                    <i class="bi bi-exclamation-circle"></i>
                    <span>Error al cargar los datos</span>
                </div>
            </td>
        </tr>`;
}

// ── CORTE DE CAJA ────────────────────────────────────────────
function cargarCorte() {
    const btn = document.getElementById("btnGenerarCorte");
    btn.disabled = true;
    btn.innerHTML = `<i class="bi bi-hourglass-split"></i> Calculando…`;

    $.ajax({
        url: "/admin/reportes/corte",
        type: "GET",
        success: function (lista) {
            btn.disabled = false;
            btn.innerHTML = `<i class="bi bi-play-circle-fill"></i> Generar corte`;

            if (!lista || lista.length === 0) {
                resetCardsCorte();
                return;
            }

            renderCardsCorte(lista);
            renderTablaCorte(lista);
            $("#wrapTablaCorte").show();
        },
        error: function (xhr) {
            btn.disabled = false;
            btn.innerHTML = `<i class="bi bi-play-circle-fill"></i> Generar corte`;
            console.error("Error corte:", xhr.responseText);
            alert("No se pudo generar el corte.");
        }
    });
}

function renderCardsCorte(lista) {
    let totalGeneral  = 0;
    let totalEfectivo = 0;
    let totalTarjeta  = 0;
    let totalOrdenes  = 0;

    lista.forEach(row => {
        const metodo  = (row.metodo_pago || "").toUpperCase();
        const monto   = Number(row.total_monto   || 0);
        const ordenes = Number(row.total_ordenes || 0);

        if (metodo === "TOTAL GENERAL") {
            totalGeneral = monto;
            totalOrdenes = ordenes;
        } else if (metodo === "EFECTIVO") {
            totalEfectivo = monto;
        } else if (metodo === "TARJETA") {
            totalTarjeta = monto;
        }
    });

    animarValor("totalGeneral",  `$${totalGeneral.toFixed(2)}`);
    animarValor("totalEfectivo", `$${totalEfectivo.toFixed(2)}`);
    animarValor("totalTarjeta",  `$${totalTarjeta.toFixed(2)}`);
    animarValor("totalOrdenes",  totalOrdenes.toString());
}

function renderTablaCorte(lista) {
    const tbody = document.getElementById("tbodyCorte");
    tbody.innerHTML = "";

    lista.forEach(row => {
        const metodo  = row.metodo_pago || "—";
        const ordenes = row.total_ordenes ?? 0;
        const monto   = Number(row.total_monto || 0);
        const esTotal = metodo.toUpperCase() === "TOTAL GENERAL";

        const tr = document.createElement("tr");
        if (esTotal) tr.style.fontWeight = "600";

        tr.innerHTML = `
            <td>${esTotal ? "<strong>" + metodo + "</strong>" : metodo}</td>
            <td>${ordenes}</td>
            <td class="td-total">$${monto.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function resetCardsCorte() {
    ["totalGeneral", "totalEfectivo", "totalTarjeta", "totalOrdenes"].forEach(id => {
        document.getElementById(id).textContent = "—";
    });
}

function animarValor(elementId, nuevoValor) {
    const el = document.getElementById(elementId);
    el.style.opacity = "0";
    el.style.transform = "translateY(6px)";
    setTimeout(() => {
        el.textContent = nuevoValor;
        el.style.transition = "opacity .35s ease, transform .35s ease";
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
    }, 150);
}

// ── EXCEL ────────────────────────────────────────────────────
function descargarExcel(idTipoPago, btnEl) {

    // Feedback visual en el botón
    const textoOriginal = btnEl.innerHTML;
    btnEl.disabled = true;
    btnEl.innerHTML = `<i class="bi bi-hourglass-split"></i> Generando…`;

    const params = idTipoPago != null ? `?idTipoPago=${idTipoPago}` : "";
    const url    = `/admin/reportes/excel${params}`;

    // Usamos fetch para detectar errores del servidor
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`Error ${response.status}`);
            return response.blob();
        })
        .then(blob => {
            // Crear enlace temporal y disparar descarga
            const link     = document.createElement("a");
            const objetoURL = URL.createObjectURL(blob);
            const hoy      = new Date().toISOString().slice(0, 10);
            const sufijo   = idTipoPago === 1 ? "_efectivo"
                           : idTipoPago === 2 ? "_tarjeta"
                           : "_todos";

            link.href     = objetoURL;
            link.download = `detalle_ordenes${sufijo}_${hoy}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(objetoURL);
        })
        .catch(err => {
            console.error("Error al descargar Excel:", err);
            alert("No se pudo generar el Excel. Intenta de nuevo.");
        })
        .finally(() => {
            // Restaurar botón
            btnEl.disabled  = false;
            btnEl.innerHTML = textoOriginal;
        });
}