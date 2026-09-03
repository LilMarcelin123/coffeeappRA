import { mensajesAlert, mostrarConfirmacion2 } from '../FuncionesGenerales.js';

let modalConfirmCerrar  = null;
let modalConfirmReabrir = null;

let _alertaSonidoJugado = false; // para no repetir el sonido en cada refresco
// ── Estado modal acceso ───────────────────────────────────────
var _accesoModal     = null;
var _moduloActual    = "";
var _accesoBloqueado = false;

var MODULOS_ACCESO = {
    "usuarios":   { label: "Gestion de Usuarios",    redirect: "/admin/GestionUsuarios"   },
    "reportes":   { label: "Generacion de Reportes", redirect: "/admin/GeneracionReportes" },
    "inventario": { label: "Gestion de Inventario",  redirect: "/admin/gestionInventario"  } // ← AGREGAR
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
			    _abrirAcceso("inventario");
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
    // Estos modales solo existen en admin/inicio.html. Sin la guarda,
    // en admin/tomaOrden.html reventaba aqui y abortaba el resto del ready.
    const modalElCerrar = document.getElementById("modalConfirmCerrar");
    if (modalElCerrar) {
        modalConfirmCerrar = bootstrap.Modal.getOrCreateInstance(modalElCerrar);

        modalElCerrar.addEventListener("hidden.bs.modal", function () {
            document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
            document.body.classList.remove("modal-open");
            document.body.style.removeProperty("overflow");
            document.body.style.removeProperty("padding-right");
            $("#selectMetodoPago").val("");
            $("#btnConfirmarCerrar").prop("disabled", true);
        });
    }

    // ── Modal confirmacion reabrir ────────────────────────────
    const modalElReabrir = document.getElementById("modalConfirmReabrir");
    if (modalElReabrir) {
        modalConfirmReabrir = bootstrap.Modal.getOrCreateInstance(modalElReabrir);

        modalElReabrir.addEventListener("hidden.bs.modal", function () {
            document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
            document.body.classList.remove("modal-open");
            document.body.style.removeProperty("overflow");
            document.body.style.removeProperty("padding-right");
        });
    }

    // ── Cargar tabla pendientes ───────────────────────────────
    cargarPendientes();

    // ── Select all ───────────────────────────────────────────
    $("#chkAll").on("change", function () {
        const marcado = $(this).is(":checked");
        document.querySelectorAll("#gridPendientes .ord-card").forEach(card => {
            const chk = card.querySelector(".chkRow");
            if (chk) { chk.checked = marcado; card.classList.toggle("is-sel", marcado); }
        });
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
            const filas  = Array.isArray(data) ? data : [];   // el endpoint puede responder un objeto de error
            const bajos  = filas.filter(r => r.alerta_stock_bajo == 1 && r.f_activo == 1);
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

// El panel de pendientes solo existe en admin/inicio.html.
// TomaOrden.js tambien se carga en admin/tomaOrden.html, donde no hay tabla:
// sin esta guarda el grid terminaba inyectado fuera de <body>.
function hayPanelPendientes() {
    return !!document.getElementById("tbodyPendientes");
}

function cargarPendientes() {
    if (!hayPanelPendientes()) return;
    $.ajax({
        url: "/admin/orden/pendientes",
        type: "GET",
        success: function (lista) { renderPendientes(lista); },
        error: function (xhr) { console.log("Error pendientes:", xhr.responseText); }
    });
}

function renderPendientes(lista) {
    window.__ORDENES_PENDIENTES__ = lista || [];
    $.ajax({
        url: "/admin/orden/items-estado", type: "GET",
        success: function (items) { pintarTarjetasPendientes(lista || [], items || []); },
        error:   function ()      { pintarTarjetasPendientes(lista || [], []); }
    });
}

function pintarTarjetasPendientes(lista, items) {
    const tbody = document.getElementById("tbodyPendientes");
    const tabla = tbody ? tbody.closest("table") : null;
    if (!tabla) return;               // sin tabla no hay donde anclar el panel
    tabla.style.display = "none";

    let grid = document.getElementById("gridPendientes");
    if (!grid) {
        grid = document.createElement("div");
        grid.id = "gridPendientes";
        grid.className = "op-grid-pendientes";
        const cont = tabla.parentNode;
        cont.parentNode.insertBefore(grid, cont.nextSibling);

        const buscador = document.createElement("input");
        buscador.type = "search";
        buscador.id = "buscadorPendientes";
        buscador.className = "op-buscador";
        buscador.placeholder = "Buscar por número de orden o cliente…";
        buscador.addEventListener("input", function () {
            const q = this.value.trim().toLowerCase();
            grid.querySelectorAll(".ord-card").forEach(card => {
                const txt = card.dataset.busqueda || "";
                card.style.display = (!q || txt.includes(q)) ? "" : "none";
            });
        });
        grid.parentNode.insertBefore(buscador, grid);
    }

    const porOrden = {};
    items.forEach(it => {
        const k = String(it.id_orden);
        (porOrden[k] = porOrden[k] || []).push(it);
    });

    grid.innerHTML = "";
    if (!lista.length) {
        grid.innerHTML = '<div class="ord-empty">Sin órdenes pendientes</div>';
        actualizarBotonesAccion();
        return;
    }

    lista.forEach(o => {
        const id     = o.id_orden;
        const its    = porOrden[String(id)] || [];
        const total  = its.length;
        const listos = its.filter(i => String(i.n_estado_preparacion).toUpperCase() === "LISTO").length;
        const completa = total > 0 && listos === total;
        const cliente  = (o.n_nombre_cliente || "").replace(/^WA:/, "");
        const esWa = window.__WA_ENABLED__ !== false && String(o.source || "").toUpperCase() === "WHATSAPP";

        const card = document.createElement("article");
        card.className = "ord-card" + (completa ? " ord-card--completa" : "");
        card.dataset.idOrden  = id;
        card.dataset.busqueda = (String(id) + " " + cliente).toLowerCase();

        // Tipo de consumo: se ve en la tarjeta, sin abrir la orden.
        const tipoConsumo = String(o.n_tipo_consumo || "").toUpperCase();
        const tcHtml = (tipoConsumo === "AQUI" || tipoConsumo === "LLEVAR")
            ? '<div class="ord-tc"><span class="tc-badge ' +
              (tipoConsumo === "AQUI" ? "tc-aqui" : "tc-llevar") + '">' +
              '<span class="tc-ico"></span>' +
              (tipoConsumo === "AQUI" ? "Para comer aqu\u00ed" : "Para llevar") +
              '</span></div>'
            : "";

        const filas = its.map(i => {
            const ok = String(i.n_estado_preparacion).toUpperCase() === "LISTO";
            const cant = Number(i.p_cantidad) > 1 ? '<span class="ord-cant">×' + i.p_cantidad + '</span>' : "";
            return '<li class="ord-item' + (ok ? " is-listo" : "") + '">' +
                   '<span class="ord-dot"></span>' +
                   '<span class="ord-nombre">' + escHtmlAdmin(i.n_nombre_producto || "—") + '</span>' +
                   cant + '</li>';
        }).join("");

        card.innerHTML =
            '<header class="ord-head">' +
                '<label class="ord-check"><input type="checkbox" class="chkRow form-check-input"></label>' +
                '<span class="ord-num">#' + id + '</span>' +
                (esWa ? '<span class="ord-wa" title="Pedido por WhatsApp"><i class="bi bi-whatsapp"></i></span>' : "") +
                '<span class="ord-hora">' + String(o.t_hora_creacion || "").replace("T", " ").substring(11, 16) + '</span>' +
            '</header>' +
            tcHtml +
            (cliente ? '<div class="ord-cliente"><i class="bi bi-person-fill"></i> ' + escHtmlAdmin(cliente) + '</div>' : "") +
            '<ul class="ord-items">' + (filas || '<li class="ord-item"><span class="ord-nombre text-muted">Sin productos</span></li>') + '</ul>' +
            '<footer class="ord-foot">' +
                '<span class="ord-total">$' + Number(o.p_total || 0).toFixed(2) + '</span>' +
                (completa
                    ? '<span class="ord-estado ord-estado--ok"><i class="bi bi-check-circle-fill"></i> COMPLETA</span>'
                    : '<span class="ord-estado">' + listos + " / " + total + '</span>') +
            '</footer>';

        if (esWa) {
            const acc = document.createElement("div");
            acc.className = "ord-acciones";
            const bAct = document.createElement("button");
            bAct.type = "button"; bAct.className = "btn-actualizar-wa";
            bAct.innerHTML = '<i class="bi bi-send"></i> Actualizar';
            bAct.addEventListener("click", e => {
                e.stopPropagation();
                if (window.ActualizacionEstatus) window.ActualizacionEstatus.abrirModal({
                    idOrden: id, cliente: cliente || "—", telefono: o.wa_phone || "—" });
            });
            const bInfo = document.createElement("button");
            bInfo.type = "button"; bInfo.className = "btn-info-wa ms-1";
            bInfo.innerHTML = '<i class="bi bi-info-circle"></i> Info';
            bInfo.addEventListener("click", e => { e.stopPropagation(); abrirModalInfoWa(id); });
            acc.appendChild(bAct); acc.appendChild(bInfo);
            card.appendChild(acc);
        }

        const chk = card.querySelector(".chkRow");
        chk.addEventListener("change", function (e) {
            e.stopPropagation();
            card.classList.toggle("is-sel", this.checked);
            actualizarBotonesAccion();
        });
        card.addEventListener("click", function (e) {
            if (e.target.closest("button") || e.target.closest("input")) return;
            chk.checked = !chk.checked;
            card.classList.toggle("is-sel", chk.checked);
            actualizarBotonesAccion();
        });

        grid.appendChild(card);
    });

    $("#chkAll").prop("checked", false);
    actualizarBotonesAccion();
}

function obtenerIdsSeleccionados() {
    const ids = [];
    document.querySelectorAll("#gridPendientes .ord-card").forEach(card => {
        const chk = card.querySelector(".chkRow");
        if (chk && chk.checked) ids.push(Number(card.dataset.idOrden));
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
// ════════════════════════════════════════════════════════════
// MODAL INFO WHATSAPP (datos de entrega/pago del cliente)
// ════════════════════════════════════════════════════════════
function abrirModalInfoWa(idOrden) {
    const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    set("infoWaOrdenId", "#" + idOrden);
    set("infoWaCliente", "Cargando…");
    set("infoWaTelefono", "—"); set("infoWaTipoEntrega", "—");
    set("infoWaDireccion", "—"); set("infoWaReferencia", "—");
    set("infoWaPago", "—"); set("infoWaCambio", "—");
    ["infoWaChatLink", "infoWaMapsLink"].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = "none"; });

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("modalInfoWa"), { backdrop: true, keyboard: true });
    modal.show();

    $.ajax({
        url: "/admin/orden/" + idOrden + "/info-whatsapp",
        type: "GET",
        success: function (d) {
            if (!d || !d.ok) { set("infoWaCliente", "Sin datos"); return; }
            const tel = (d.telefono || "").replace("@s.whatsapp.net", "").replace("@lid", "");
            set("infoWaCliente", d.cliente ? String(d.cliente).replace("WA:", "") : "Cliente WhatsApp");
            set("infoWaTelefono", tel || "—");
            set("infoWaTipoEntrega", d.tipoEntrega || "—");
            set("infoWaDireccion", d.direccion || "—");
            set("infoWaReferencia", d.referencia || "—");

            const chat = document.getElementById("infoWaChatLink");
            if (chat && tel) { chat.href = "https://wa.me/" + tel.replace(/\D/g, ""); chat.style.display = "inline-flex"; }

            const copyBtn = document.getElementById("infoWaCopyBtn");
            if (copyBtn) {
                copyBtn.onclick = function () {
                    const texto = (d.direccion || "") + (d.referencia ? " — Ref: " + d.referencia : "");
                    navigator.clipboard.writeText(texto).then(() => {
                        copyBtn.innerHTML = '<i class="bi bi-check2"></i> Copiada';
                        setTimeout(() => copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copiar dirección', 1500);
                    });
                };
            }

            const pago = (d.metodoPago || "").toUpperCase();
            const cambioEl = document.getElementById("infoWaCambio");
            if (pago === "EFECTIVO") {
                set("infoWaPago", "💵 Efectivo");
                if (d.cambioCon != null && Number(d.cambioCon) > 0) {
                    const billete = Number(d.cambioCon), total = Number(d.total || 0);
                    const cambio = billete - total;
                    cambioEl.innerHTML = 'Paga con <strong>$' + billete.toFixed(2) + '</strong>' +
                        (cambio >= 0 ? ' · llevar cambio de <strong>$' + cambio.toFixed(2) + '</strong>' : '');
                    cambioEl.className = "iw-cambio iw-cambio--efectivo";
                } else {
                    cambioEl.textContent = "Importe exacto — no requiere cambio";
                    cambioEl.className = "iw-cambio iw-cambio--exacto";
                }
            } else if (pago === "TRANSFERENCIA") {
                set("infoWaPago", "🏦 Transferencia");
                cambioEl.textContent = "Verificar comprobante antes de enviar";
                cambioEl.className = "iw-cambio iw-cambio--transfer";
            } else {
                set("infoWaPago", d.metodoPago || "—");
                cambioEl.textContent = "—";
            }

            const linkMaps = document.getElementById("infoWaMapsLink");
            if (linkMaps) {
                const m = (d.direccion || "").match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
                if (m) { linkMaps.href = "https://maps.google.com/?q=" + m[1] + "," + m[2]; linkMaps.style.display = "inline-flex"; }
            }
        },
        error: function () { set("infoWaCliente", "Error al cargar"); }
    });
}


// Config del negocio: apaga la UI de WhatsApp si el modulo esta deshabilitado
$.ajax({
    url: "/api/config-negocio", type: "GET",
    success: function (cfg) { window.__WA_ENABLED__ = cfg && cfg.whatsappEnabled !== false; },
    error:   function () { window.__WA_ENABLED__ = true; }
});


// Los estilos de estas tarjetas viven en css/style.css (bloque "ORDENES PENDIENTES")

// Refresco automatico: refleja en Administracion lo que Cocina va marcando
if (hayPanelPendientes()) window.__REFRESCO_PENDIENTES__ = setInterval(function () {
    if (document.hidden) return;
    if (document.querySelector(".modal.show")) return;
    if (document.querySelectorAll("#gridPendientes .chkRow:checked").length) return;
    cargarPendientes();
}, 20000);
