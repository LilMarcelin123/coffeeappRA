import { mensajesAlert, mostrarConfirmacion2 } from '../FuncionesGenerales.js';

let modalConfirmCerrar  = null;
let modalConfirmReabrir = null;

let _alertaSonidoJugado = false; // para no repetir el sonido en cada refresco
// ── Estado modal acceso ───────────────────────────────────────
var _accesoModal     = null;
var _moduloActual    = "";
var _accesoBloqueado = false;

var MODULOS_ACCESO = {
    "usuarios": { label: "Gestion de Usuarios",    redirect: "/admin/GestionUsuarios"   },
    "reportes": { label: "Generacion de Reportes", redirect: "/admin/GeneracionReportes" }
};

function _elAcceso(id) {
    return document.getElementById(id);
}

// ─────────────────────────────────────────────────────────────
function abrirModalSeguro(modalId) {
    document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");

    const el    = document.getElementById(modalId);
    const modal = bootstrap.Modal.getOrCreateInstance(el, { backdrop: true, keyboard: true });
    modal.show();
    return modal;
}

// ─────────────────────────────────────────────────────────────
$(document).ready(function () {

    // ── Inicializar modal de acceso ───────────────────────────
    var _modalEl = _elAcceso("modalAccesoModulo");
    if (!_modalEl) {
        console.warn("[AccesoModal] No se encontro #modalAccesoModulo en el DOM.");
        console.warn("[AccesoModal] Verifica que th:replace este ANTES del script en inicio.html");
    } else {
        _accesoModal = bootstrap.Modal.getOrCreateInstance(_modalEl, {
            backdrop: "static",
            keyboard: false
        });
        _modalEl.addEventListener("hidden.bs.modal", function () {
            _resetAccesoModal();
            document.querySelectorAll(".modal-backdrop").forEach(function (b) { b.remove(); });
            document.body.classList.remove("modal-open");
            document.body.style.removeProperty("overflow");
            document.body.style.removeProperty("padding-right");
        });
    }

    // ── CAMBIO 3: Toda la tarjeta es clickeable via data-modulo ──
    //    Las tarjetas con .modulo-disabled son ignoradas por CSS
    //    (pointer-events: none), pero se agrega también una guarda JS.
    $(".modulo-card").on("click", function () {
        // Ignorar si la tarjeta está deshabilitada
        if ($(this).hasClass("modulo-disabled")) return;

        const modulo = $(this).data("modulo");

        switch (modulo) {

            // ── Toma de ordenes — SIN contrasena ─────────────
            case "orden":
                mostrarConfirmacion2(
                    "¿Seguro que quieres iniciar una orden?",
                    () => {
                        $.ajax({
                            url: "/procesoInicialOrden",
                            type: "GET",
                            data: { tipoProceso: 1 },
                            success: function (data) {
                                window.location.href = "/admin/tomaOrden?idOrden=" + data.idOrden;
                            },
                            error: function () {
                                alert("No se pudo iniciar la orden, intenta de nuevo.");
                            }
                        });
                    },
                    () => { console.log("cancelado"); }
                );
                break;

			// ── Gestion catalogo — SIN contrasena ────────────
			case "catalogo":
				mostrarConfirmacion2(
					"¿Seguro que quieres modificar el catálogo?",
					() => { window.location.href = "/admin/gestionCatalogo"; },
					() => { console.log("cancelado"); }
				);
				break;


			// ── Inventario — SIN contrasena ──────────────────────────
			case "inventario":
				mostrarConfirmacion2(
					"¿Seguro que quieres ir a Gestión de Inventario?",
					() => { window.location.href = "/admin/gestionInventario"; },
					() => { console.log("cancelado"); }
				);
				break;


			// ── Reportes — CON contrasena maestra ────────────
			case "reportes":
				_abrirAcceso("reportes");
				break;

			// ── Gestion usuarios — CON contrasena maestra ────
			case "usuarios":
				_abrirAcceso("usuarios");
				break;

			default:
                console.warn("[Modulos] modulo desconocido:", modulo);
        }
    });

    // ── Eventos modal acceso ──────────────────────────────────
    $("#btnConfirmarAcceso").on("click", function () {
        _validarAcceso();
    });

    $("#btnCancelarAcceso").on("click", function () {
        if (_accesoModal) _accesoModal.hide();
    });

    $("#btnToggleAccesoPass").on("click", function () {
        var input = _elAcceso("inputAccesoPassword");
        var icono = _elAcceso("iconoOjoAcceso");
        if (!input || !icono) return;
        var esPass      = input.type === "password";
        input.type      = esPass ? "text" : "password";
        icono.className = esPass ? "bi bi-eye-slash" : "bi bi-eye";
    });

    $("#inputAccesoPassword").on("keydown", function (e) {
        if (e.key === "Enter" && !_accesoBloqueado) _validarAcceso();
    });

    // ── Modal confirmacion cierre ─────────────────────────────
    const modalElCerrar = document.getElementById("modalConfirmCerrar");
    modalConfirmCerrar  = bootstrap.Modal.getOrCreateInstance(modalElCerrar);

    modalElCerrar.addEventListener("hidden.bs.modal", function () {
        document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
        document.body.classList.remove("modal-open");
        document.body.style.removeProperty("overflow");
        document.body.style.removeProperty("padding-right");
        $("#selectMetodoPago").val("");
        $("#btnConfirmarCerrar").prop("disabled", true);
    });

    // ── Modal confirmacion reabrir ────────────────────────────
    const modalElReabrir = document.getElementById("modalConfirmReabrir");
    modalConfirmReabrir  = bootstrap.Modal.getOrCreateInstance(modalElReabrir);

    modalElReabrir.addEventListener("hidden.bs.modal", function () {
        document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
        document.body.classList.remove("modal-open");
        document.body.style.removeProperty("overflow");
        document.body.style.removeProperty("padding-right");
    });

    // ── Cargar tabla pendientes ───────────────────────────────
    cargarPendientes();

    // ── Select all ───────────────────────────────────────────
    $("#chkAll").on("change", function () {
        $(".chkRow").prop("checked", $(this).is(":checked"));
        actualizarBotonesAccion();
    });

    // ── Abrir modal CERRAR ────────────────────────────────────
    $("#btnCerrarSeleccionadas").on("click", function () {
        const ids = obtenerIdsSeleccionados();
        if (ids.length === 0) return;
        renderListaConfirmacion(ids);
        modalConfirmCerrar = abrirModalSeguro("modalConfirmCerrar");
    });

    // ── Confirmar cierre ──────────────────────────────────────
    $("#btnConfirmarCerrar").on("click", function () {
        const ids = obtenerIdsSeleccionados();
        if (ids.length === 0) { $("#modalConfirmCerrar").modal("hide"); return; }
        cerrarOrdenes(ids);
    });

    $("#selectMetodoPago").on("change", function () {
        $("#btnConfirmarCerrar").prop("disabled", !$(this).val());
    });

    // ── Abrir modal REABRIR ───────────────────────────────────
    $("#btnReabrirSeleccionadas").on("click", function () {
        const ids = obtenerIdsSeleccionados();
        if (ids.length === 0) return;
        if (ids.length > 1) { alert("Solo puedes reabrir una orden a la vez."); return; }
        renderListaReabrir(ids);
        modalConfirmReabrir = abrirModalSeguro("modalConfirmReabrir");
    });

    // ── Confirmar reabrir ─────────────────────────────────────
    $("#btnConfirmarReabrir").on("click", function () {
        const ids = obtenerIdsSeleccionados();
        if (ids.length === 0) { modalConfirmReabrir.hide(); return; }
        modalConfirmReabrir.hide();
        reabrirOrdenes(ids);
    });

	// ── Alerta de stock bajo ──────────────────────────────────
	cargarAlertaStock();
	setInterval(cargarAlertaStock, 60000); // refresca cada 60 seg
});

// ════════════════════════════════════════════════════════════
// MODAL ACCESO — funciones
// ════════════════════════════════════════════════════════════



// ════════════════════════════════════════════════════════════
// ALERTA STOCK BAJO
// ════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════
// ALERTA STOCK BAJO
// ════════════════════════════════════════════════════════════


function cargarAlertaStock() {
    $.ajax({
        url: "/admin/inventario/gestionar",
        type: "GET",
        data: { tipoProceso: 1 },
        success: function (data) {
            const bajos  = (data || []).filter(r => r.alerta_stock_bajo == 1 && r.f_activo == 1);
            const $wrap  = $("#alertaStockBajo");
            const $modulo = $(".modulo-card[data-modulo='inventario']");

            if (bajos.length === 0) {
                $wrap.fadeOut(300);
                $modulo.removeClass("inventario-alerta");
                _alertaSonidoJugado = false; // resetear para próxima alerta
                return;
            }

            // ── Sonido (solo la primera vez que aparecen alertas) ──
            if (!_alertaSonidoJugado) {
                _tocarSonidoAlerta();
                _alertaSonidoJugado = true;
            }

            // ── Pulso en tarjeta de inventario ─────────────────
            $modulo.addClass("inventario-alerta");

            // ── Construir items ────────────────────────────────
            const itemsHtml = bajos.map(r => `
                <div class="alerta-stock-item">
                    <i class="bi bi-box-seam-fill"></i>
                    ${escHtmlAdmin(r.n_nombre)}
                    <span class="stock-num">${r.stock_actual} ${r.abreviacion}</span>
                </div>
            `).join("");

            $("#alertaStockLista").html(itemsHtml);
            $("#alertaStockConteo").text(
                bajos.length === 1 ? "1 insumo" : `${bajos.length} insumos`
            );

            $wrap.fadeIn(300);
        },
        error: function () {
            $("#alertaStockBajo").hide();
        }
    });
}

function _tocarSonidoAlerta() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Dos tonos suaves: beep doble tipo notificación
        function beep(frecuencia, inicio, duracion) {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type            = "sine";
            osc.frequency.value = frecuencia;

            gain.gain.setValueAtTime(0, ctx.currentTime + inicio);
            gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + inicio + 0.02);
            gain.gain.linearRampToValueAtTime(0,    ctx.currentTime + inicio + duracion);

            osc.start(ctx.currentTime + inicio);
            osc.stop (ctx.currentTime + inicio + duracion + 0.05);
        }

        beep(780, 0.0,  0.18); // primer tono
        beep(980, 0.22, 0.18); // segundo tono más agudo

    } catch (e) {
        // Si el navegador bloquea AudioContext, simplemente no suena
        console.warn("[Stock] AudioContext no disponible:", e);
    }
}



function escHtmlAdmin(s) {
    return $("<span>").text(s ?? "").html();
}




function _abrirAcceso(modulo) {
    if (_accesoBloqueado) return;
    if (!_accesoModal) {
        console.error("[AccesoModal] No inicializado. El fragmento debe estar antes del script.");
        return;
    }
    _moduloActual = modulo;
    var info  = MODULOS_ACCESO[modulo];
    var label = _elAcceso("labelNombreModulo");
    if (label) label.textContent = info ? info.label : modulo;
    _resetAccesoModal();
    _accesoModal.show();
    setTimeout(function () {
        var inp = _elAcceso("inputAccesoPassword");
        if (inp) inp.focus();
    }, 400);
}

function _validarAcceso() {
    var inp  = _elAcceso("inputAccesoPassword");
    var pass = inp ? inp.value.trim() : "";
    if (!pass) { _mostrarErrorAcceso("Ingresa la contrasena.", "warning"); return; }

    _setLoadingAcceso(true);

    var params = new URLSearchParams();
    params.append("password", pass);
    params.append("modulo",   _moduloActual);

    fetch("/api/acceso-modulo", { method: "POST", body: params })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data.acceso) {
                var btn = _elAcceso("btnConfirmarAcceso");
                if (btn) {
                    btn.style.background = "#198754";
                    btn.innerHTML = "<i class='bi bi-check-lg'></i> Acceso concedido";
                }
                setTimeout(function () {
                    if (_accesoModal) _accesoModal.hide();
                    window.location.href = data.redirect;
                }, 700);

            } else if (data.bloqueado) {
                _accesoBloqueado = true;
                _mostrarErrorAcceso(data.mensaje, "danger");
                if (_elAcceso("inputAccesoPassword")) _elAcceso("inputAccesoPassword").disabled = true;
                if (_elAcceso("btnConfirmarAcceso"))  _elAcceso("btnConfirmarAcceso").disabled  = true;
                if (_elAcceso("dotsIntentos"))        _elAcceso("dotsIntentos").style.display   = "none";
                var segundos = parseInt((data.mensaje.match(/[0-9]+/) || ["300"])[0]);
                setTimeout(function () { _accesoBloqueado = false; _resetAccesoModal(); }, segundos * 1000);

            } else {
                _mostrarErrorAcceso(data.mensaje, "danger");
                _actualizarDotsAcceso(data.intentos || 0);
                if (_elAcceso("inputAccesoPassword")) {
                    _elAcceso("inputAccesoPassword").value = "";
                    _elAcceso("inputAccesoPassword").focus();
                }
                _sacudirInputAcceso();
            }
        })
        .catch(function () { _mostrarErrorAcceso("Error de conexion. Intenta de nuevo.", "warning"); })
        .finally(function () { _setLoadingAcceso(false); });
}

function _mostrarErrorAcceso(msg, tipo) {
    var el = _elAcceso("mensajeAccesoError");
    if (!el) return;
    el.textContent   = msg;
    el.className     = "alert alert-" + tipo + " py-2 small mb-0";
    el.style.display = "block";
}

function _actualizarDotsAcceso(intentosFallidos) {
    var wrap = _elAcceso("dotsIntentos");
    if (!wrap) return;
    wrap.style.display = "flex";
    var restantes = 3 - intentosFallidos;
    ["dot1", "dot2", "dot3"].forEach(function (id, i) {
        var dot = _elAcceso(id);
        if (dot) dot.style.color = i < restantes ? "#48392D" : "#dee2e6";
    });
}

function _setLoadingAcceso(on) {
    var spinner = _elAcceso("spinnerAcceso");
    if (spinner) spinner.style.display = on ? "inline-block" : "none";
    ["btnConfirmarAcceso", "btnCancelarAcceso", "inputAccesoPassword"].forEach(function (id) {
        var el = _elAcceso(id);
        if (el) el.disabled = on;
    });
}

function _sacudirInputAcceso() {
    var input = _elAcceso("inputAccesoPassword");
    if (!input) return;
    input.classList.add("is-invalid");
    input.style.animation = "shake 0.4s ease";
    setTimeout(function () {
        input.style.animation = "";
        input.classList.remove("is-invalid");
    }, 400);
}

function _resetAccesoModal() {
    var input = _elAcceso("inputAccesoPassword");
    var btn   = _elAcceso("btnConfirmarAcceso");
    if (input) { input.value = ""; input.type = "password"; input.disabled = false; }
    if (btn)   { btn.disabled = false; btn.style.background = "#48392D"; btn.innerHTML = "Ingresar"; }
    if (_elAcceso("iconoOjoAcceso"))     _elAcceso("iconoOjoAcceso").className         = "bi bi-eye";
    if (_elAcceso("mensajeAccesoError")) _elAcceso("mensajeAccesoError").style.display = "none";
    if (_elAcceso("dotsIntentos"))       _elAcceso("dotsIntentos").style.display       = "none";
    if (_elAcceso("spinnerAcceso"))      _elAcceso("spinnerAcceso").style.display      = "none";
    ["dot1", "dot2", "dot3"].forEach(function (id) {
        var dot = _elAcceso(id);
        if (dot) dot.style.color = "#48392D";
    });
}

// ════════════════════════════════════════════════════════════
// TABLA ORDENES PENDIENTES
// ════════════════════════════════════════════════════════════

function cargarPendientes() {
    $.ajax({
        url: "/admin/orden/pendientes",
        type: "GET",
        success: function (lista) { renderPendientes(lista); },
        error: function (xhr) { console.log("Error pendientes:", xhr.responseText); }
    });
}

function renderPendientes(lista) {
    const tbody = document.getElementById("tbodyPendientes");
    const tpl   = document.getElementById("tplPendienteRow");
    tbody.innerHTML = "";

    (lista || []).forEach(o => {
        const idOrden = o.id_orden;
        const node    = tpl.content.cloneNode(true);
        const tr      = node.querySelector("tr");

        tr.dataset.idOrden = idOrden;
        node.querySelector(".col-id").textContent      = idOrden ?? "";
		node.querySelector(".col-nombre").textContent  = o.n_nombre_cliente ?? "—";  
        node.querySelector(".col-hora").textContent    = o.t_hora_creacion ?? "";
        node.querySelector(".col-total").textContent   = (o.p_total != null) ? `$${Number(o.p_total).toFixed(2)}` : "$0.00";
        node.querySelector(".col-resumen").textContent = o.resumen ?? "";

        const chk = node.querySelector(".chkRow");

        chk.addEventListener("change", function () {
            const total    = $("#tbodyPendientes .chkRow").length;
            const marcados = $("#tbodyPendientes .chkRow:checked").length;
            $("#chkAll").prop("checked", total > 0 && marcados === total);
            actualizarBotonesAccion();
        });

        tr.addEventListener("click", function (e) {
            const tag = e.target.tagName.toLowerCase();
            if (tag === "input" || tag === "button" || tag === "a") return;
            chk.checked = !chk.checked;
            const total    = $("#tbodyPendientes .chkRow").length;
            const marcados = $("#tbodyPendientes .chkRow:checked").length;
            $("#chkAll").prop("checked", total > 0 && marcados === total);
            actualizarBotonesAccion();
        });

        tbody.appendChild(node);
    });

    $("#chkAll").prop("checked", false);
    actualizarBotonesAccion();
}

function obtenerIdsSeleccionados() {
    const ids = [];
    $("#tbodyPendientes tr").each(function () {
        const chk = this.querySelector(".chkRow");
        if (chk && chk.checked) ids.push(Number(this.dataset.idOrden));
    });
    return ids;
}

function actualizarBotonesAccion() {
    const disabled = obtenerIdsSeleccionados().length === 0;
    $("#btnCerrarSeleccionadas").prop("disabled", disabled);
    $("#btnReabrirSeleccionadas").prop("disabled", disabled);
}

function renderListaConfirmacion(ids) {
    const ul = document.getElementById("listaOrdenesSeleccionadas");
    ul.innerHTML = "";
    ids.forEach(id => { const li = document.createElement("li"); li.textContent = `Orden #${id}`; ul.appendChild(li); });
}

function renderListaReabrir(ids) {
    const ul = document.getElementById("listaOrdenesReabrir");
    ul.innerHTML = "";
    ids.forEach(id => { const li = document.createElement("li"); li.textContent = `Orden #${id}`; ul.appendChild(li); });
}

// ════════════════════════════════════════════════════════════
// ACCIONES
// ════════════════════════════════════════════════════════════

function cerrarOrdenes(ids) {
    $("#btnConfirmarCerrar").prop("disabled", true);
    const metodoPago = $("#selectMetodoPago").val();
    const requests   = ids.map(idOrden =>
        $.ajax({ url: "/admin/orden/gestionar", type: "POST",
                 data: { idOrden: idOrden, tipoProceso: 1, idRol: 1, pTipoPago: metodoPago } })
    );
    $.when.apply($, requests)
        .done(function () {
            $("#btnConfirmarCerrar").prop("disabled", false);
            $("#modalConfirmCerrar").modal("hide");
            cargarPendientes();
        })
        .fail(function (xhr) {
            $("#btnConfirmarCerrar").prop("disabled", false);
            console.log("Error cerrando:", xhr.responseText);
            alert("No se pudieron cerrar una o mas ordenes.");
        });
}

function reabrirOrdenes(ids) {
    $("#btnConfirmarReabrir").prop("disabled", true);
    const idOrden = ids[0];
    $.ajax({
        url: "/admin/orden/gestionar",
        type: "POST",
        data: { idOrden: idOrden, tipoProceso: 6, idRol: null, pTipoPago: null },
        success: function () { window.location.href = "/admin/tomaOrden?idOrden=" + idOrden; },
        error: function (xhr) {
            $("#btnConfirmarReabrir").prop("disabled", false);
            console.error("Error reabriendo:", xhr.responseText);
            alert("No se pudo reabrir la orden.");
        }
    });
}