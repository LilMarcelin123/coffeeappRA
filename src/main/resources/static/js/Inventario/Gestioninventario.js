// ================================================================
// GestionInventario.js
// ================================================================

import { mensajesAlert, mostrarConfirmacion2 } from "../FuncionesGenerales.js";

var _accesoModalInv     = null;
var _accesoBloqueadoInv = false;
var MODULOS_ACCESO_INV  = { "salida_stock": { label: "Salida Manual de Stock" } };

function _elAcc(id) { return document.getElementById(id); }

const URL_GESTIONAR = "/admin/inventario/gestionar";
const URL_RECETAS   = "/admin/inventario/recetas";

let insumoSeleccionado   = null;
let productoSeleccionado = null;
let extraSeleccionado    = null;

function ajaxGet(url, data) { return $.ajax({ url, type: "GET", data, dataType: "json" }); }
function ajaxPost(url, data) { return $.ajax({ url, type: "POST", data }); }
function initModal(id) { return new bootstrap.Modal(document.getElementById(id), { backdrop: "static", keyboard: false }); }

// ── Modal Acceso ─────────────────────────────────────────────
function _abrirAccesoInv(modulo) {
    if (_accesoBloqueadoInv || !_accesoModalInv) return;
    const info = MODULOS_ACCESO_INV[modulo];
    const label = _elAcc("labelNombreModulo");
    if (label) label.textContent = info ? info.label : modulo;
    _resetAccesoInv();
    _accesoModalInv.show();
    setTimeout(() => { const i = _elAcc("inputAccesoPassword"); if (i) i.focus(); }, 400);
}

function _validarAccesoInv() {
    const inp = _elAcc("inputAccesoPassword");
    const pass = inp ? inp.value.trim() : "";
    if (!pass) { _mostrarErrorInv("Ingresa la contrasena.", "warning"); return; }
    _setLoadingInv(true);
    const params = new URLSearchParams();
    params.append("password", pass);
    params.append("modulo", "salida_stock");
    fetch("/api/acceso-modulo", { method: "POST", body: params })
        .then(res => res.json())
        .then(data => {
            if (data.acceso) {
                const btn = _elAcc("btnConfirmarAcceso");
                if (btn) { btn.style.background = "#198754"; btn.innerHTML = "<i class='bi bi-check-lg'></i> Acceso concedido"; }
                setTimeout(() => {
                    _accesoModalInv.hide();
                    const r = insumoSeleccionado;
                    $("#salidaInsumoId").val(r.id_insumo);
                    $("#salidaInsumoNombre").text(r.n_nombre);
                    $("#salidaStockActual").text(r.stock_actual + " " + r.abreviacion);
                    $("#salidaCantidad").val(""); $("#salidaDescripcion").val(""); $("#salidaAlertaExceso").hide();
                    setTimeout(() => { bootstrap.Modal.getOrCreateInstance(document.getElementById("modalSalidaStock"), { backdrop: "static", keyboard: false }).show(); }, 300);
                }, 700);
            } else if (data.bloqueado) {
                _accesoBloqueadoInv = true;
                _mostrarErrorInv(data.mensaje, "danger");
                if (inp) inp.disabled = true;
                const btn = _elAcc("btnConfirmarAcceso"); if (btn) btn.disabled = true;
                const seg = parseInt((data.mensaje.match(/[0-9]+/) || ["300"])[0]);
                setTimeout(() => { _accesoBloqueadoInv = false; _resetAccesoInv(); }, seg * 1000);
            } else {
                _mostrarErrorInv(data.mensaje || "Contrasena incorrecta.", "danger");
                if (inp) { inp.value = ""; inp.focus(); }
            }
        })
        .catch(() => _mostrarErrorInv("Error de conexion. Intenta de nuevo.", "warning"))
        .finally(() => _setLoadingInv(false));
}

function _mostrarErrorInv(msg, tipo) {
    const el = _elAcc("mensajeAccesoError"); if (!el) return;
    el.textContent = msg; el.className = "alert alert-" + tipo + " py-2 small mb-0"; el.style.display = "block";
}
function _setLoadingInv(on) {
    const spinner = _elAcc("spinnerAcceso"); if (spinner) spinner.style.display = on ? "inline-block" : "none";
    ["btnConfirmarAcceso","btnCancelarAcceso","inputAccesoPassword"].forEach(id => { const el = _elAcc(id); if (el) el.disabled = on; });
}
function _resetAccesoInv() {
    const input = _elAcc("inputAccesoPassword"); const btn = _elAcc("btnConfirmarAcceso");
    if (input) { input.value = ""; input.type = "password"; input.disabled = false; }
    if (btn)   { btn.disabled = false; btn.style.background = "#48392D"; btn.innerHTML = "Ingresar"; }
    if (_elAcc("iconoOjoAcceso"))     _elAcc("iconoOjoAcceso").className         = "bi bi-eye";
    if (_elAcc("mensajeAccesoError")) _elAcc("mensajeAccesoError").style.display = "none";
    if (_elAcc("spinnerAcceso"))      _elAcc("spinnerAcceso").style.display      = "none";
}

// ════════════════════════════════════════════════════════════
// DOCUMENT READY
// ════════════════════════════════════════════════════════════
$(document).ready(function () {

    const modales = {
        nuevoInsumo: initModal("modalNuevoInsumo"), editarInsumo: initModal("modalEditarInsumo"),
        entradaStock: initModal("modalEntradaStock"), salidaStock: initModal("modalSalidaStock"),
        nuevaCategoria: initModal("modalNuevaCategoria"), nuevaUnidad: initModal("modalNuevaUnidad"),
        agregarReceta: initModal("modalAgregarReceta"), editarReceta: initModal("modalEditarReceta"),
        agregarRecetaExtra: initModal("modalAgregarRecetaExtra"), editarRecetaExtra: initModal("modalEditarRecetaExtra"),
    };

    const _modalAccEl = _elAcc("modalAccesoModulo");
    if (_modalAccEl) {
        _accesoModalInv = bootstrap.Modal.getOrCreateInstance(_modalAccEl, { backdrop: "static", keyboard: false });
        _modalAccEl.addEventListener("hidden.bs.modal", function () {
            _resetAccesoInv();
            document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
            document.body.classList.remove("modal-open");
            document.body.style.removeProperty("overflow");
            document.body.style.removeProperty("padding-right");
        });
    }

    $("#btnConfirmarAcceso").on("click", function () { _validarAccesoInv(); });
    $("#btnCancelarAcceso").on("click", function () { if (_accesoModalInv) _accesoModalInv.hide(); });
    $("#btnToggleAccesoPass").on("click", function () {
        const input = _elAcc("inputAccesoPassword"); const icono = _elAcc("iconoOjoAcceso");
        if (!input || !icono) return;
        const esPass = input.type === "password";
        input.type = esPass ? "text" : "password";
        icono.className = esPass ? "bi bi-eye-slash" : "bi bi-eye";
    });
    $("#inputAccesoPassword").on("keydown", function (e) { if (e.key === "Enter" && !_accesoBloqueadoInv) _validarAccesoInv(); });

    // ── TABS ─────────────────────────────────────────────────
    $(".inv-tab").on("click", function () {
        const tab = $(this).data("tab");
        $(".inv-tab").removeClass("activo"); $(this).addClass("activo");
        $(".tab-pane-inv").hide(); $("#tab-" + tab).show();
        if (tab === "insumos") { cargarCategorias(); cargarUnidades(); cargarInsumos(); cargarDesactivados(); }
        else if (tab === "recetas") activarSubTab($(".inv-sub-tab.activo").data("subtab") || "productos");
        else if (tab === "log") cargarLog();
    });

    $(document).on("click", ".inv-sub-tab", function () {
        $(".inv-sub-tab").removeClass("activo"); $(this).addClass("activo");
        activarSubTab($(this).data("subtab"));
    });

    function activarSubTab(subtab) {
        $("#subtab-productos, #subtab-extras").hide(); $("#subtab-" + subtab).show();
        if (subtab === "productos") cargarProductosReceta();
        if (subtab === "extras")    cargarExtrasReceta();
    }

    cargarCategorias(); cargarUnidades(); cargarInsumos(); cargarDesactivados();

    // ════════════════════════════════════════════════════════
    // TAB 1 — INSUMOS
    // ════════════════════════════════════════════════════════

    function cargarCategorias() {
        ajaxGet(URL_GESTIONAR, { tipoProceso: 6 })
            .done(function (data) {
                const $tb = $("#bodyCategorias").empty();
                if (!data?.length) return $tb.html(emptyRow(3, "Sin categorias registradas"));
                data.forEach(r => $tb.append("<tr><td>" + r.id + "</td><td>" + r.nombre + "</td><td>" + (r.n_descripcion || "—") + "</td></tr>"));
            })
            .fail(() => $("#bodyCategorias").html(errorRow(3)));
    }

    function cargarUnidades() {
        ajaxGet(URL_GESTIONAR, { tipoProceso: 7 })
            .done(function (data) {
                const $tb = $("#bodyUnidades").empty();
                if (!data?.length) return $tb.html(emptyRow(3, "Sin unidades registradas"));
                data.forEach(r => {
                    const abrev = r.abreviacion || r.abreviatura || r.n_abreviacion || "—";
                    $tb.append("<tr><td>" + r.id + "</td><td>" + escHtml(r.nombre) + "</td><td><span class='badge-unidad'>" + escHtml(abrev) + "</span></td></tr>");
                });
            })
            .fail(() => $("#bodyUnidades").html(errorRow(3)));
    }

    function cargarInsumos() {
        $("#bodyInsumos").html(loadingRow(8));
        ajaxGet(URL_GESTIONAR, { tipoProceso: 1 })
            .done(function (data) {
                const $tb = $("#bodyInsumos").empty();
                insumoSeleccionado = null; ocultarAccionesInsumos();
                if (!data?.length) return $tb.html(emptyRow(8, "Sin insumos registrados"));
                data.forEach(row => {
                    const alerta = row.alerta_stock_bajo == 1;
                    const stockCls = alerta ? "stock-bajo" : "";
                    const alertaIcon = alerta ? ' <i class="bi bi-exclamation-triangle-fill ms-1 text-warning" title="Stock bajo"></i>' : "";
                    const $tr = $('<tr class="fila-insumo">' +
                        '<td><input type="radio" name="selInsumo" class="form-check-input"></td>' +
                        '<td>' + row.id_insumo + '</td>' +
                        '<td><strong>' + escHtml(row.n_nombre) + '</strong></td>' +
                        '<td>' + escHtml(row.categoria) + '</td>' +
                        '<td class="' + stockCls + '">' + row.stock_actual + ' ' + row.abreviacion + alertaIcon + '</td>' +
                        '<td>' + row.stock_minimo + ' ' + row.abreviacion + '</td>' +
                        '<td>' + escHtml(row.unidad_medida) + '</td>' +
                        '<td><span class="badge-est ' + (row.f_activo == 1 ? 'est-activo' : 'est-inactivo') + '">' + (row.f_activo == 1 ? 'Activo' : 'Inactivo') + '</span></td>' +
                        '</tr>').data("row", row);
                    $tr.find("input[type=radio]").on("change", function () {
                        $(".fila-insumo").removeClass("table-active");
                        $tr.addClass("table-active"); insumoSeleccionado = row; mostrarAccionesInsumos(row.n_nombre);
                    });
                    $tr.on("click", function () { $(this).find("input[type=radio]").prop("checked", true).trigger("change"); });
                    $tb.append($tr);
                });
            })
            .fail(() => $("#bodyInsumos").html(errorRow(8)));
    }

    function cargarDesactivados() {
        ajaxGet(URL_GESTIONAR, { tipoProceso: 14 })
            .done(function (data) {
                const $tb = $("#bodyDesactivados").empty();
                if (!data?.length) {
                    $("#panelDesactivados").hide();
                    return $tb.html(emptyRow(6, "Sin insumos desactivados"));
                }
                $("#panelDesactivados").show();
                data.forEach(row => {
                    $tb.append('<tr>' +
                        '<td>' + row.id_insumo + '</td>' +
                        '<td><strong>' + escHtml(row.n_nombre) + '</strong></td>' +
                        '<td>' + escHtml(row.categoria) + '</td>' +
                        '<td>' + row.stock_actual + ' ' + row.abreviacion + '</td>' +
                        '<td>' + escHtml(row.unidad_medida) + '</td>' +
                        '<td>' +
                            '<button class="btn-accion btn-stock btn-sm-inv me-1 btn-reactivar-insumo" data-id="' + row.id_insumo + '" data-nombre="' + escAttr(row.n_nombre) + '">' +
                                '<i class="bi bi-arrow-clockwise"></i> Reactivar' +
                            '</button>' +
                            '<button class="btn-accion btn-del btn-sm-inv btn-eliminar-insumo" data-id="' + row.id_insumo + '" data-nombre="' + escAttr(row.n_nombre) + '">' +
                                '<i class="bi bi-trash3-fill"></i> Eliminar' +
                            '</button>' +
                        '</td>' +
                    '</tr>');
                });
            })
            .fail(() => { $("#panelDesactivados").hide(); });
    }

    function mostrarAccionesInsumos(nombre) { $("#infoSeleccionInsumo").text(nombre); $("#accionesPanelInsumos").addClass("visible"); }
    function ocultarAccionesInsumos() { $("#accionesPanelInsumos").removeClass("visible"); $("#infoSeleccionInsumo").text("—"); }

    // ── Nuevo Insumo ─────────────────────────────────────────
    $("#btnNuevoInsumo").on("click", function () {
        limpiarCampos("#insumoNombre, #insumoStockInicial, #insumoStockMinimo");
        cargarSelectCat("#insumoCategoria"); cargarSelectUnid("#insumoUnidad"); modales.nuevoInsumo.show();
    });
    $("#btnGuardarNuevoInsumo").on("click", function () {
        const nombre = trim("#insumoNombre"), catId = val("#insumoCategoria"), unidadId = val("#insumoUnidad");
        if (!nombre || !catId || !unidadId) return mensajesAlert("Nombre, categoria y unidad son obligatorios|bg-danger");
        ajaxPost(URL_GESTIONAR, { tipoProceso: 2, nombre, idCategoria: catId, idUnidad: unidadId, stockInicial: numVal("#insumoStockInicial"), stockMinimo: numVal("#insumoStockMinimo") })
            .done(() => { modales.nuevoInsumo.hide(); mensajesAlert("Insumo creado correctamente|bg-success"); cargarInsumos(); })
            .fail(() => mensajesAlert("Error al crear insumo|bg-danger"));
    });

    // ── Editar Insumo ────────────────────────────────────────
    $("#btnEditarInsumo").on("click", function () {
        if (!insumoSeleccionado) return;
        const r = insumoSeleccionado;
        setVal("#editInsumoId", r.id_insumo); setVal("#editInsumoNombre", r.n_nombre); setVal("#editInsumoStockMinimo", r.stock_minimo);
        cargarSelectCat("#editInsumoCategoria", r.id_categoria_insumo);
        cargarSelectUnid("#editInsumoUnidad", r.id_unidad_medida);
        modales.editarInsumo.show();
    });
    $("#btnGuardarEditarInsumo").on("click", function () {
        const nombre = trim("#editInsumoNombre");
        if (!nombre) return mensajesAlert("El nombre es obligatorio|bg-danger");
        ajaxPost(URL_GESTIONAR, { tipoProceso: 3, idInsumo: val("#editInsumoId"), nombre, idCategoria: val("#editInsumoCategoria"), idUnidad: val("#editInsumoUnidad"), stockMinimo: numVal("#editInsumoStockMinimo") })
            .done(() => { modales.editarInsumo.hide(); mensajesAlert("Insumo actualizado|bg-success"); cargarInsumos(); })
            .fail(() => mensajesAlert("Error al actualizar|bg-danger"));
    });

    // ── Entrada Stock ────────────────────────────────────────
    $("#btnEntradaStock").on("click", function () {
        if (!insumoSeleccionado) return;
        const r = insumoSeleccionado;
        setVal("#entradaInsumoId", r.id_insumo); $("#entradaInsumoNombre").text(r.n_nombre);
        $("#entradaStockActual").text(r.stock_actual + " " + r.abreviacion);
        limpiarCampos("#entradaCantidad, #entradaDescripcion"); modales.entradaStock.show();
    });
    $("#btnGuardarEntrada").on("click", function () {
        const cantidad = numVal("#entradaCantidad");
        if (!cantidad || cantidad <= 0) return mensajesAlert("La cantidad debe ser mayor a 0|bg-danger");
        ajaxPost(URL_GESTIONAR, { tipoProceso: 5, idInsumo: val("#entradaInsumoId"), cantidadEntrada: cantidad, descripcion: trim("#entradaDescripcion") })
            .done(() => { modales.entradaStock.hide(); mensajesAlert("Stock actualizado correctamente|bg-success"); cargarInsumos(); if ($("#tab-log").is(":visible")) cargarLog(); })
            .fail(() => mensajesAlert("Error al actualizar stock|bg-danger"));
    });

    // ── Salida Stock ─────────────────────────────────────────
    $("#btnSalidaStock").on("click", function () { if (!insumoSeleccionado) return; _abrirAccesoInv("salida_stock"); });
    $("#salidaCantidad").on("input", function () {
        const cantidad = parseFloat($(this).val()) || 0;
        const stockActual = parseFloat(insumoSeleccionado?.stock_actual) || 0;
        $("#salidaAlertaExceso").toggle(cantidad > stockActual);
    });
    $("#btnGuardarSalida").on("click", function () {
        const cantidad = numVal("#salidaCantidad");
        const stockActual = parseFloat(insumoSeleccionado?.stock_actual) || 0;
        if (!cantidad || cantidad <= 0) return mensajesAlert("La cantidad debe ser mayor a 0|bg-danger");
        if (cantidad > stockActual) return mensajesAlert("No puedes restar mas stock del disponible|bg-danger");
        ajaxPost(URL_GESTIONAR, { tipoProceso: 11, idInsumo: val("#salidaInsumoId"), cantidadEntrada: cantidad, descripcion: trim("#salidaDescripcion") })
            .done(() => { modales.salidaStock.hide(); mensajesAlert("Salida registrada correctamente|bg-success"); cargarInsumos(); if ($("#tab-log").is(":visible")) cargarLog(); })
            .fail(() => mensajesAlert("Error al registrar salida|bg-danger"));
    });

    // ── Desactivar Insumo ────────────────────────────────────
    $("#btnDesactivarInsumo").on("click", function () {
        if (!insumoSeleccionado) return;
        mostrarConfirmacion2(
            'Vas a desactivar "' + insumoSeleccionado.n_nombre + '". Este insumo dejara de aparecer en el stock activo. Asegurate de haberlo quitado de todas las recetas antes de continuar.',
            function () {
                ajaxPost(URL_GESTIONAR, { tipoProceso: 4, idInsumo: insumoSeleccionado.id_insumo })
                    .done(function (resp) {
                        if (resp?.resultado === -2) {
                            mensajesAlert(resp.mensaje + "|bg-danger");
                            return;
                        }
                        mensajesAlert("Insumo desactivado. Puedes revisarlo en la seccion de Insumos Desactivados.|bg-warning");
                        insumoSeleccionado = null;
                        ocultarAccionesInsumos();
                        cargarInsumos();
                        cargarDesactivados();
                    })
                    .fail(() => mensajesAlert("Error al desactivar|bg-danger"));
            },
            function () {}
        );
    });

    // ── Reactivar Insumo ─────────────────────────────────────
    $(document).on("click", ".btn-reactivar-insumo", function () {
        const id = $(this).data("id"), nombre = $(this).data("nombre");
        mostrarConfirmacion2(
            'Reactivar "' + nombre + '"? Volvera a aparecer en el stock activo y podra usarse en recetas.',
            function () {
                ajaxPost(URL_GESTIONAR, { tipoProceso: 12, idInsumo: id })
                    .done(function (resp) {
                        if (resp?.resultado === -1) return mensajesAlert("Error al reactivar|bg-danger");
                        mensajesAlert('"' + nombre + '" reactivado correctamente.|bg-success');
                        cargarInsumos();
                        cargarDesactivados();
                    })
                    .fail(() => mensajesAlert("Error al reactivar|bg-danger"));
            },
            function () {}
        );
    });

    // ── Eliminar Insumo Definitivamente ──────────────────────
    $(document).on("click", ".btn-eliminar-insumo", function () {
        const id = $(this).data("id"), nombre = $(this).data("nombre");
        mostrarConfirmacion2(
            'ATENCION: Vas a eliminar "' + nombre + '" de forma definitiva. Esta accion NO se puede deshacer. Se borrara el insumo y todo su historial de movimientos. Confirmar?',
            function () {
                mostrarConfirmacion2(
                    'Segunda confirmacion: Eliminar "' + nombre + '" para siempre? Esta es tu ultima oportunidad de cancelar.',
                    function () {
                        ajaxPost(URL_GESTIONAR, { tipoProceso: 13, idInsumo: id })
                            .done(function (resp) {
                                if (resp?.resultado === -2) return mensajesAlert(resp.mensaje + "|bg-danger");
                                mensajesAlert('"' + nombre + '" eliminado definitivamente.|bg-danger');
                                cargarDesactivados();
                            })
                            .fail(() => mensajesAlert("Error al eliminar|bg-danger"));
                    },
                    function () {}
                );
            },
            function () {}
        );
    });

    // ── Nueva Categoria ──────────────────────────────────────
    $("#btnNuevaCategoria").on("click", function () { limpiarCampos("#catNombre, #catDescripcion"); modales.nuevaCategoria.show(); });
    $("#btnGuardarCategoria").on("click", function () {
        const nombre = trim("#catNombre");
        if (!nombre) return mensajesAlert("El nombre es obligatorio|bg-danger");
        ajaxPost(URL_GESTIONAR, { tipoProceso: 8, nombre, descripcion: trim("#catDescripcion") })
            .done(() => { modales.nuevaCategoria.hide(); mensajesAlert("Categoria creada|bg-success"); cargarCategorias(); })
            .fail(() => mensajesAlert("Error al crear categoria|bg-danger"));
    });

    // ── Nueva Unidad ─────────────────────────────────────────
    $("#btnNuevaUnidad").on("click", function () { limpiarCampos("#unidadNombre, #unidadAbreviacion"); modales.nuevaUnidad.show(); });
    $("#btnGuardarUnidad").on("click", function () {
        const nombre = trim("#unidadNombre"), abrev = trim("#unidadAbreviacion");
        if (!nombre || !abrev) return mensajesAlert("Nombre y abreviacion son obligatorios|bg-danger");
        ajaxPost(URL_GESTIONAR, { tipoProceso: 9, nombre, descripcion: abrev })
            .done(() => { modales.nuevaUnidad.hide(); mensajesAlert("Unidad creada|bg-success"); cargarUnidades(); })
            .fail(() => mensajesAlert("Error al crear unidad|bg-danger"));
    });

    // ════════════════════════════════════════════════════════
    // TAB 2 — RECETAS: PRODUCTOS
    // ════════════════════════════════════════════════════════

    function cargarProductosReceta() {
        $("#bodyProductosReceta").html(loadingRow(3));
        ajaxGet(URL_RECETAS, { tipoProceso: 5 })
            .done(function (data) {
                const $tb = $("#bodyProductosReceta").empty();
                productoSeleccionado = null; resetPanelReceta();
                if (!data?.length) return $tb.html(emptyRow(3, "Sin productos"));
                data.forEach(row => {
                    const $tr = $('<tr class="fila-producto"><td><strong>' + escHtml(row.n_nombre_producto) + '</strong></td><td><small>' + escHtml(row.categoria) + '</small></td><td style="text-align:center;"><span class="badge-count">' + (row.total_insumos_receta || 0) + '</span></td></tr>').data("row", row);
                    $tr.on("click", function () {
                        $(".fila-producto").removeClass("table-active"); $tr.addClass("table-active");
                        productoSeleccionado = row; cargarRecetaProducto(row.id_producto, row.n_nombre_producto);
                    });
                    $tb.append($tr);
                });
            })
            .fail(() => $("#bodyProductosReceta").html(errorRow(3)));
    }

    function resetPanelReceta() { $("#panelReceta").hide(); $("#panelRecetaVacio").show(); }

    function cargarRecetaProducto(idProducto, nombreProducto) {
        $("#tituloReceta").text(nombreProducto); $("#panelRecetaVacio").hide(); $("#panelReceta").show();
        $("#bodyReceta").html(loadingRow(6));
        ajaxGet(URL_RECETAS, { tipoProceso: 1, idProducto })
            .done(function (data) {
                const $tb = $("#bodyReceta").empty();
                if (!data?.length) return $tb.html(emptyRow(6, "Sin insumos asignados aun"));
                data.forEach(row => $tb.append(filaReceta(row, "producto", idProducto)));
            })
            .fail(() => $("#bodyReceta").html(errorRow(6)));
    }

    $("#bodyReceta").on("click", ".btn-editar-item", function () {
        setVal("#editRecetaId", $(this).data("id")); $("#editRecetaInsumoNombre").text($(this).data("nombre")); setVal("#editRecetaCantidad", $(this).data("cantidad")); modales.editarReceta.show();
    });
    $("#bodyReceta").on("click", ".btn-eliminar-item", function () {
        const id = $(this).data("id"), nombre = $(this).data("nombre"), idProd = $(this).data("ref");
        mostrarConfirmacion2('Eliminar "' + nombre + '" de la receta?',
            function () {
                ajaxPost(URL_RECETAS, { tipoProceso: 4, idProductoInsumo: id })
                    .done(() => { mensajesAlert("Insumo eliminado de la receta|bg-success"); cargarRecetaProducto(idProd, $("#tituloReceta").text()); cargarProductosReceta(); })
                    .fail(() => mensajesAlert("Error al eliminar|bg-danger"));
            }, function () {}
        );
    });
    $("#btnGuardarEditarReceta").on("click", function () {
        const cant = numVal("#editRecetaCantidad");
        if (!cant || cant <= 0) return mensajesAlert("La cantidad debe ser mayor a 0|bg-danger");
        ajaxPost(URL_RECETAS, { tipoProceso: 3, idProductoInsumo: val("#editRecetaId"), cantidadRequerida: cant })
            .done(() => { modales.editarReceta.hide(); mensajesAlert("Cantidad actualizada|bg-success"); if (productoSeleccionado) cargarRecetaProducto(productoSeleccionado.id_producto, productoSeleccionado.n_nombre_producto); })
            .fail(() => mensajesAlert("Error al actualizar|bg-danger"));
    });
    $("#btnAgregarInsumoReceta").on("click", function () {
        if (!productoSeleccionado) return;
        setVal("#recetaProductoId", productoSeleccionado.id_producto); $("#recetaProductoNombre").text(productoSeleccionado.n_nombre_producto);
        limpiarCampos("#recetaCantidad"); cargarSelectInsumos("#recetaInsumoId"); modales.agregarReceta.show();
    });
    $("#btnGuardarReceta").on("click", function () {
        const idInsum = val("#recetaInsumoId"), cant = numVal("#recetaCantidad");
        if (!idInsum || !cant || cant <= 0) return mensajesAlert("Insumo y cantidad son obligatorios|bg-danger");
        ajaxPost(URL_RECETAS, { tipoProceso: 2, idProducto: val("#recetaProductoId"), idInsumo: idInsum, cantidadRequerida: cant })
            .done(resp => {
                if (resp?.resultado === 0) return mensajesAlert((resp.mensaje || "Ya existe") + "|bg-warning");
                modales.agregarReceta.hide(); mensajesAlert("Insumo agregado a la receta|bg-success");
                cargarRecetaProducto(val("#recetaProductoId"), productoSeleccionado.n_nombre_producto); cargarProductosReceta();
            })
            .fail(() => mensajesAlert("Error al agregar insumo|bg-danger"));
    });

    // ════════════════════════════════════════════════════════
    // TAB 2 — RECETAS: EXTRAS
    // ════════════════════════════════════════════════════════

    function cargarExtrasReceta() {
        $("#bodyExtrasReceta").html(loadingRow(3));
        ajaxGet(URL_RECETAS, { tipoProceso: 10 })
            .done(function (data) {
                const $tb = $("#bodyExtrasReceta").empty();
                extraSeleccionado = null; resetPanelExtra();
                if (!data?.length) return $tb.html(emptyRow(3, "Sin extras registrados"));
                data.forEach(row => {
                    const $tr = $('<tr class="fila-extra"><td><strong>' + escHtml(row.nombre_opcion) + '</strong></td><td><small>' + escHtml(row.subcategoria) + '</small></td><td style="text-align:center;"><span class="badge-count">' + (row.total_insumos_receta || 0) + '</span></td></tr>').data("row", row);
                    $tr.on("click", function () {
                        $(".fila-extra").removeClass("table-active"); $tr.addClass("table-active");
                        extraSeleccionado = row; cargarRecetaExtra(row.id_subcategoria_opcion, row.nombre_opcion);
                    });
                    $tb.append($tr);
                });
            })
            .fail(() => $("#bodyExtrasReceta").html(errorRow(3)));
    }

    function resetPanelExtra() { $("#panelRecetaExtra").hide(); $("#panelRecetaExtraVacio").show(); }

    function cargarRecetaExtra(idOpcion, nombreOpcion) {
        $("#tituloRecetaExtra").text(nombreOpcion); $("#panelRecetaExtraVacio").hide(); $("#panelRecetaExtra").show();
        $("#bodyRecetaExtra").html(loadingRow(6));
        ajaxGet(URL_RECETAS, { tipoProceso: 6, idProducto: idOpcion })
            .done(function (data) {
                const $tb = $("#bodyRecetaExtra").empty();
                if (!data?.length) return $tb.html(emptyRow(6, "Sin insumos asignados aun"));
                data.forEach(row => $tb.append(filaReceta(row, "extra", idOpcion)));
            })
            .fail(() => $("#bodyRecetaExtra").html(errorRow(6)));
    }

    $("#bodyRecetaExtra").on("click", ".btn-editar-item", function () {
        setVal("#editRecetaExtraId", $(this).data("id")); $("#editRecetaExtraInsumoNombre").text($(this).data("nombre")); setVal("#editRecetaExtraCantidad", $(this).data("cantidad")); modales.editarRecetaExtra.show();
    });
    $("#bodyRecetaExtra").on("click", ".btn-eliminar-item", function () {
        const id = $(this).data("id"), nombre = $(this).data("nombre"), idOp = $(this).data("ref");
        mostrarConfirmacion2('Eliminar "' + nombre + '" del extra?',
            function () {
                ajaxPost(URL_RECETAS, { tipoProceso: 9, idOpcionInsumo: id })
                    .done(() => { mensajesAlert("Insumo eliminado del extra|bg-success"); cargarRecetaExtra(idOp, $("#tituloRecetaExtra").text()); cargarExtrasReceta(); })
                    .fail(() => mensajesAlert("Error al eliminar|bg-danger"));
            }, function () {}
        );
    });
    $("#btnGuardarEditarRecetaExtra").on("click", function () {
        const cant = numVal("#editRecetaExtraCantidad");
        if (!cant || cant <= 0) return mensajesAlert("La cantidad debe ser mayor a 0|bg-danger");
        ajaxPost(URL_RECETAS, { tipoProceso: 8, idOpcionInsumo: val("#editRecetaExtraId"), cantidadRequerida: cant })
            .done(() => { modales.editarRecetaExtra.hide(); mensajesAlert("Cantidad actualizada|bg-success"); if (extraSeleccionado) cargarRecetaExtra(extraSeleccionado.id_subcategoria_opcion, extraSeleccionado.nombre_opcion); })
            .fail(() => mensajesAlert("Error al actualizar|bg-danger"));
    });
    $("#btnAgregarInsumoExtra").on("click", function () {
        if (!extraSeleccionado) return;
        setVal("#recetaExtraId", extraSeleccionado.id_subcategoria_opcion); $("#recetaExtraNombre").text(extraSeleccionado.nombre_opcion);
        limpiarCampos("#recetaExtraCantidad"); cargarSelectInsumos("#recetaExtraInsumoId"); modales.agregarRecetaExtra.show();
    });
    $("#btnGuardarRecetaExtra").on("click", function () {
        const idInsum = val("#recetaExtraInsumoId"), cant = numVal("#recetaExtraCantidad");
        if (!idInsum || !cant || cant <= 0) return mensajesAlert("Insumo y cantidad son obligatorios|bg-danger");
        ajaxPost(URL_RECETAS, { tipoProceso: 7, idProducto: val("#recetaExtraId"), idInsumo: idInsum, cantidadRequerida: cant })
            .done(resp => {
                if (resp?.resultado === 0) return mensajesAlert((resp.mensaje || "Ya existe") + "|bg-warning");
                modales.agregarRecetaExtra.hide(); mensajesAlert("Insumo agregado al extra|bg-success");
                cargarRecetaExtra(val("#recetaExtraId"), extraSeleccionado.nombre_opcion); cargarExtrasReceta();
            })
            .fail(() => mensajesAlert("Error al agregar insumo al extra|bg-danger"));
    });

    // ════════════════════════════════════════════════════════
    // TAB 3 — MOVIMIENTOS
    // ════════════════════════════════════════════════════════

    function cargarLog() {
        $("#bodyLog").html(loadingRow(10));
        ajaxGet(URL_GESTIONAR, { tipoProceso: 10 })
            .done(function (data) {
                const $tb = $("#bodyLog").empty();
                if (!data?.length) return $tb.html(emptyRow(10, "Sin movimientos registrados"));
                const TIPO_CSS = { ENTRADA:"badge-entrada", SALIDA:"badge-salida", ALTA:"badge-alta", EDICION:"badge-edicion", BAJA:"badge-baja", AJUSTE:"badge-ajuste" };
                data.forEach(row => {
                    const dif = parseFloat(row.diferencia);
                    const difStr = dif >= 0 ? "+" + dif : "" + dif;
                    const difCls = dif >= 0 ? "dif-pos" : "dif-neg";
                    const tipoCls = TIPO_CSS[row.tipo_movimiento] || "";
                    $tb.append("<tr><td><small>" + (row.t_fecha || "—") + "</small></td><td><strong>" + escHtml(row.insumo) + "</strong></td><td><span class='badge-tipo " + tipoCls + "'>" + row.tipo_movimiento + "</span></td><td>" + row.cantidad_anterior + "</td><td>" + row.cantidad_nueva + "</td><td class='" + difCls + "'>" + difStr + " " + row.unidad + "</td><td><span class='badge-unidad'>" + row.unidad + "</span></td><td><small>" + escHtml(row.n_descripcion || "—") + "</small></td><td><small>" + escHtml(row.n_usuario) + "</small></td><td>" + (row.id_orden ? "#" + row.id_orden : "—") + "</td></tr>");
                });
            })
            .fail(() => $("#bodyLog").html(errorRow(10)));
    }

    // ════════════════════════════════════════════════════════
    // HELPERS — Selects
    // ════════════════════════════════════════════════════════

    function cargarSelectCat(selector, selected) {
        selected = selected || null;
        ajaxGet(URL_GESTIONAR, { tipoProceso: 6 }).done(data => {
            const $s = $(selector).empty().append('<option value="">Seleccione</option>');
            (data || []).forEach(r => $s.append('<option value="' + r.id + '" ' + (selected == r.id ? "selected" : "") + '>' + escHtml(r.nombre) + '</option>'));
        });
    }
    function cargarSelectUnid(selector, selected) {
        selected = selected || null;
        ajaxGet(URL_GESTIONAR, { tipoProceso: 7 }).done(data => {
            const $s = $(selector).empty().append('<option value="">Seleccione</option>');
            (data || []).forEach(r => $s.append('<option value="' + r.id + '" ' + (selected == r.id ? "selected" : "") + '>' + escHtml(r.nombre) + ' (' + (r.n_abreviacion || r.abreviacion || "") + ')</option>'));
        });
    }
    function cargarSelectInsumos(selector) {
        ajaxGet(URL_GESTIONAR, { tipoProceso: 1 }).done(data => {
            const $s = $(selector).empty().append('<option value="">Seleccione un insumo</option>');
            (data || []).forEach(r => $s.append('<option value="' + r.id_insumo + '">' + escHtml(r.n_nombre) + ' (' + r.stock_actual + ' ' + r.abreviacion + ')</option>'));
        });
    }

    // ════════════════════════════════════════════════════════
    // HELPERS — UI
    // ════════════════════════════════════════════════════════

    function filaReceta(row, tipo, idRef) {
        const idField = tipo === "producto" ? "id_producto_insumo" : "id_opcion_insumo";
        return '<tr>' +
            '<td><strong>' + escHtml(row.insumo) + '</strong></td>' +
            '<td><small>' + escHtml(row.categoria_insumo) + '</small></td>' +
            '<td>' + row.cantidad_requerida + '</td>' +
            '<td><span class="badge-unidad">' + row.abreviacion + '</span></td>' +
            '<td>' + row.stock_actual + ' ' + row.abreviacion + '</td>' +
            '<td>' +
                '<button class="btn-mini btn-mini-edit btn-editar-item" data-id="' + row[idField] + '" data-nombre="' + escAttr(row.insumo) + '" data-cantidad="' + row.cantidad_requerida + '" data-ref="' + idRef + '" title="Editar cantidad"><i class="bi bi-pencil-fill"></i></button>' +
                '<button class="btn-mini btn-mini-del btn-eliminar-item" data-id="' + row[idField] + '" data-nombre="' + escAttr(row.insumo) + '" data-ref="' + idRef + '" title="Eliminar de receta"><i class="bi bi-trash3-fill"></i></button>' +
            '</td></tr>';
    }

    function loadingRow(cols)    { return '<tr><td colspan="' + cols + '" class="tabla-empty"><i class="bi bi-arrow-repeat spin"></i><p>Cargando...</p></td></tr>'; }
    function emptyRow(cols, msg) { return '<tr><td colspan="' + cols + '" class="tabla-empty"><i class="bi bi-inbox"></i><p>' + msg + '</p></td></tr>'; }
    function errorRow(cols)      { return '<tr><td colspan="' + cols + '" class="tabla-empty text-danger"><i class="bi bi-exclamation-triangle"></i><p>Error al cargar datos</p></td></tr>'; }

    const val           = sel => $(sel).val();
    const trim          = sel => $(sel).val()?.trim() || "";
    const numVal        = sel => parseFloat($(sel).val()) || 0;
    const setVal        = (sel, v) => $(sel).val(v);
    const limpiarCampos = sel => $(sel).val("");
    const escHtml       = s => $("<span>").text(s || "").html();
    const escAttr       = s => (s || "").toString().replace(/"/g, "&quot;");

});