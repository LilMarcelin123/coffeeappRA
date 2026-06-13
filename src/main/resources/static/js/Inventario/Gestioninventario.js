// ================================================================
// GestionInventario.js  — VERSIÓN COMPLETA ACTUALIZADA
// /js/Inventario/GestionInventario.js
// ================================================================

import { mensajesAlert } from "../FuncionesGenerales.js";

$(document).ready(function () {

    // ── Estado global ────────────────────────────────────────────
    let insumoSeleccionado   = null;
    let productoSeleccionado = null;
    let extraSeleccionado    = null;   // ← NUEVO

    // ── Modales Bootstrap ────────────────────────────────────────
    const modalNuevoInsumo        = new bootstrap.Modal(document.getElementById("modalNuevoInsumo"),        { backdrop: 'static', keyboard: false });
    const modalEditarInsumo       = new bootstrap.Modal(document.getElementById("modalEditarInsumo"),       { backdrop: 'static', keyboard: false });
    const modalEntradaStock       = new bootstrap.Modal(document.getElementById("modalEntradaStock"),       { backdrop: 'static', keyboard: false });
    const modalNuevaCat           = new bootstrap.Modal(document.getElementById("modalNuevaCategoria"),     { backdrop: 'static', keyboard: false });
    const modalNuevaUnidad        = new bootstrap.Modal(document.getElementById("modalNuevaUnidad"),        { backdrop: 'static', keyboard: false });
    const modalAgregarReceta      = new bootstrap.Modal(document.getElementById("modalAgregarReceta"),      { backdrop: 'static', keyboard: false });
    const modalEditarReceta       = new bootstrap.Modal(document.getElementById("modalEditarReceta"),       { backdrop: 'static', keyboard: false });
    const modalAgregarRecetaExtra = new bootstrap.Modal(document.getElementById("modalAgregarRecetaExtra"), { backdrop: 'static', keyboard: false }); // ← NUEVO
    const modalEditarRecetaExtra  = new bootstrap.Modal(document.getElementById("modalEditarRecetaExtra"),  { backdrop: 'static', keyboard: false }); // ← NUEVO

    // ────────────────────────────────────────────────────────────
    // TABS PRINCIPALES
    // ────────────────────────────────────────────────────────────
    $(".inv-tab").on("click", function () {
        const tab = $(this).data("tab");
        $(".inv-tab").removeClass("activo");
        $(this).addClass("activo");
        $(".tab-content-inv").hide();
        $("#tab-" + tab).show();

        if (tab === "insumos") {
            cargarCategorias();
            cargarUnidades();
            cargarInsumos();
        } else if (tab === "recetas") {
            // Activa sub-tab activo al cambiar al tab de recetas
            const subActivo = $(".inv-sub-tab.activo").data("subtab") || "productos";
            activarSubTab(subActivo);
        } else if (tab === "log") {
            cargarLog();
        }
    });

    // ── Sub-tabs Productos / Extras ──────────────────────────────
    $(".inv-tabs").on("click", ".inv-sub-tab", function () {
        $(".inv-sub-tab").removeClass("activo");
        $(this).addClass("activo");
        activarSubTab($(this).data("subtab"));
    });

    function activarSubTab(subtab) {
        $("#subtab-productos, #subtab-extras").hide();
        $("#subtab-" + subtab).show();
        if (subtab === "productos") cargarProductosReceta();
        if (subtab === "extras")    cargarExtrasReceta();
    }

    // Carga inicial
    cargarCategorias();
    cargarUnidades();
    cargarInsumos();

    // ────────────────────────────────────────────────────────────
    // TAB 1 — INSUMOS
    // ────────────────────────────────────────────────────────────

    function cargarCategorias() {
        $.ajax({
            url: "/admin/inventario/gestionar",
            type: "GET",
            data: { tipoProceso: 6 },
            dataType: "json",
            success: function (data) {
                const $tbody = $("#bodyCategorias").empty();
                if (!data || data.length === 0) {
                    $tbody.html('<tr><td colspan="3" class="tabla-empty"><i class="bi bi-inbox"></i><p>Sin categorías</p></td></tr>');
                    return;
                }
                data.forEach(row => {
                    $tbody.append(`<tr>
                        <td>${row.id}</td>
                        <td>${row.nombre}</td>
                        <td>${row.n_descripcion ?? "—"}</td>
                    </tr>`);
                });
            },
            error: () => {
                $("#bodyCategorias").html('<tr><td colspan="3" class="tabla-empty"><i class="bi bi-exclamation-triangle"></i><p>Error al cargar</p></td></tr>');
            }
        });
    }

    function cargarUnidades() {
        $.ajax({
            url: "/admin/inventario/gestionar",
            type: "GET",
            data: { tipoProceso: 7 },
            dataType: "json",
            success: function (data) {
                const $tbody = $("#bodyUnidades").empty();
                if (!data || data.length === 0) {
                    $tbody.html('<tr><td colspan="3" class="tabla-empty"><i class="bi bi-inbox"></i><p>Sin unidades</p></td></tr>');
                    return;
                }
                data.forEach(row => {
                    $tbody.append(`<tr>
                        <td>${row.id}</td>
                        <td>${row.nombre}</td>
                        <td><span class="badge-unidad">${row.abreviacion}</span></td>
                    </tr>`);
                });
            }
        });
    }

    function cargarInsumos() {
        $("#bodyInsumos").html('<tr><td colspan="8" class="tabla-empty"><i class="bi bi-arrow-repeat spin"></i><p>Cargando...</p></td></tr>');
        $.ajax({
            url: "/admin/inventario/gestionar",
            type: "GET",
            data: { tipoProceso: 1 },
            dataType: "json",
            success: function (data) {
                const $tbody = $("#bodyInsumos").empty();
                insumoSeleccionado = null;
                ocultarAccionesInsumos();

                if (!data || data.length === 0) {
                    $tbody.html('<tr><td colspan="8" class="tabla-empty"><i class="bi bi-inbox"></i><p>Sin insumos registrados</p></td></tr>');
                    return;
                }

                data.forEach(row => {
                    const alertaBaja = row.alerta_stock_bajo == 1;
                    const stockClass = alertaBaja ? "stock-bajo" : "";
                    const $tr = $(`<tr class="fila-insumo">
                        <td><input type="radio" name="selInsumo" class="form-check-input"></td>
                        <td>${row.id_insumo}</td>
                        <td>${row.n_nombre}</td>
                        <td>${row.categoria}</td>
                        <td class="${stockClass}">
                            ${row.stock_actual} ${row.abreviacion}
                            ${alertaBaja ? '<i class="bi bi-exclamation-triangle-fill ms-1" title="Stock bajo"></i>' : ""}
                        </td>
                        <td>${row.stock_minimo} ${row.abreviacion}</td>
                        <td>${row.unidad_medida}</td>
                        <td><span class="badge-estatus ${row.f_activo == 1 ? 'activo' : 'inactivo'}">${row.f_activo == 1 ? 'Activo' : 'Inactivo'}</span></td>
                    </tr>`).data("row", row);

                    $tr.find("input[type=radio]").on("change", function () {
                        $(".fila-insumo").removeClass("table-active");
                        $tr.addClass("table-active");
                        insumoSeleccionado = row;
                        mostrarAccionesInsumos(row.n_nombre);
                    });

                    $tr.on("click", function () {
                        $(this).find("input[type=radio]").prop("checked", true).trigger("change");
                    });

                    $tbody.append($tr);
                });
            },
            error: () => {
                $("#bodyInsumos").html('<tr><td colspan="8" class="tabla-empty"><i class="bi bi-exclamation-triangle"></i><p>Error al cargar insumos</p></td></tr>');
            }
        });
    }

    function mostrarAccionesInsumos(nombre) {
        $("#infoSeleccionInsumo").text(nombre);
        $("#accionesPanelInsumos").addClass("visible");
    }
    function ocultarAccionesInsumos() {
        $("#accionesPanelInsumos").removeClass("visible");
        $("#infoSeleccionInsumo").text("—");
    }

    // ── Nuevo Insumo ─────────────────────────────────────────────
    $("#btnNuevoInsumo").on("click", function () {
        $("#insumoNombre, #insumoStockInicial, #insumoStockMinimo").val("");
        cargarSelectCategorias("#insumoCategoria");
        cargarSelectUnidades("#insumoUnidad");
        modalNuevoInsumo.show();
    });

    $("#btnGuardarNuevoInsumo").on("click", function () {
        const nombre   = $("#insumoNombre").val().trim();
        const catId    = $("#insumoCategoria").val();
        const unidadId = $("#insumoUnidad").val();
        const stockIni = parseFloat($("#insumoStockInicial").val()) || 0;
        const stockMin = parseFloat($("#insumoStockMinimo").val()) || 0;

        if (!nombre || !catId || !unidadId) {
            mensajesAlert("Nombre, categoría y unidad son obligatorios|bg-danger");
            return;
        }

        $.ajax({
            url: "/admin/inventario/gestionar",
            type: "POST",
            data: { tipoProceso: 2, nombre, idCategoria: catId, idUnidad: unidadId, stockInicial: stockIni, stockMinimo: stockMin },
            success: function () {
                modalNuevoInsumo.hide();
                mensajesAlert("Insumo creado correctamente|bg-success");
                cargarInsumos();
            },
            error: () => mensajesAlert("Error al crear insumo|bg-danger")
        });
    });

    // ── Editar Insumo ────────────────────────────────────────────
    $("#btnEditarInsumo").on("click", function () {
        if (!insumoSeleccionado) return;
        const r = insumoSeleccionado;
        $("#editInsumoId").val(r.id_insumo);
        $("#editInsumoNombre").val(r.n_nombre);
        $("#editInsumoStockMinimo").val(r.stock_minimo);
        cargarSelectCategorias("#editInsumoCategoria", r.id_categoria_insumo);
        cargarSelectUnidades("#editInsumoUnidad", r.id_unidad_medida);
        modalEditarInsumo.show();
    });

    $("#btnGuardarEditarInsumo").on("click", function () {
        const id       = $("#editInsumoId").val();
        const nombre   = $("#editInsumoNombre").val().trim();
        const catId    = $("#editInsumoCategoria").val();
        const unidadId = $("#editInsumoUnidad").val();
        const stockMin = parseFloat($("#editInsumoStockMinimo").val()) || 0;

        if (!nombre) { mensajesAlert("El nombre es obligatorio|bg-danger"); return; }

        $.ajax({
            url: "/admin/inventario/gestionar",
            type: "POST",
            data: { tipoProceso: 3, idInsumo: id, nombre, idCategoria: catId, idUnidad: unidadId, stockMinimo: stockMin },
            success: function () {
                modalEditarInsumo.hide();
                mensajesAlert("Insumo actualizado|bg-success");
                cargarInsumos();
            },
            error: () => mensajesAlert("Error al actualizar|bg-danger")
        });
    });

    // ── Entrada de Stock ─────────────────────────────────────────
    $("#btnEntradaStock").on("click", function () {
        if (!insumoSeleccionado) return;
        const r = insumoSeleccionado;
        $("#entradaInsumoId").val(r.id_insumo);
        $("#entradaInsumoNombre").text(r.n_nombre);
        $("#entradaStockActual").text(`${r.stock_actual} ${r.abreviacion}`);
        $("#entradaCantidad, #entradaDescripcion").val("");
        modalEntradaStock.show();
    });

    $("#btnGuardarEntrada").on("click", function () {
        const id       = $("#entradaInsumoId").val();
        const cantidad = parseFloat($("#entradaCantidad").val());
        const desc     = $("#entradaDescripcion").val().trim();

        if (!cantidad || cantidad <= 0) {
            mensajesAlert("La cantidad debe ser mayor a 0|bg-danger");
            return;
        }

        $.ajax({
            url: "/admin/inventario/gestionar",
            type: "POST",
            data: { tipoProceso: 5, idInsumo: id, cantidadEntrada: cantidad, descripcion: desc },
            success: function () {
                modalEntradaStock.hide();
                mensajesAlert("Stock actualizado correctamente|bg-success");
                cargarInsumos();
                if ($("#tab-log").is(":visible")) cargarLog();
            },
            error: () => mensajesAlert("Error al actualizar stock|bg-danger")
        });
    });

    // ── Desactivar Insumo ────────────────────────────────────────
    $("#btnDesactivarInsumo").on("click", function () {
        if (!insumoSeleccionado) return;
        if (!confirm(`¿Desactivar el insumo "${insumoSeleccionado.n_nombre}"? No se eliminará del historial.`)) return;

        $.ajax({
            url: "/admin/inventario/gestionar",
            type: "POST",
            data: { tipoProceso: 4, idInsumo: insumoSeleccionado.id_insumo },
            success: function () {
                mensajesAlert("Insumo desactivado|bg-warning");
                insumoSeleccionado = null;
                ocultarAccionesInsumos();
                cargarInsumos();
            },
            error: () => mensajesAlert("Error al desactivar|bg-danger")
        });
    });

    // ── Nueva Categoría ──────────────────────────────────────────
    $("#btnNuevaCategoria").on("click", function () {
        $("#catNombre, #catDescripcion").val("");
        modalNuevaCat.show();
    });

    $("#btnGuardarCategoria").on("click", function () {
        const nombre = $("#catNombre").val().trim();
        const desc   = $("#catDescripcion").val().trim();
        if (!nombre) { mensajesAlert("El nombre es obligatorio|bg-danger"); return; }

        $.ajax({
            url: "/admin/inventario/gestionar",
            type: "POST",
            data: { tipoProceso: 8, nombre, descripcion: desc },
            success: function () {
                modalNuevaCat.hide();
                mensajesAlert("Categoría creada|bg-success");
                cargarCategorias();
            },
            error: () => mensajesAlert("Error al crear categoría|bg-danger")
        });
    });

    // ── Nueva Unidad ─────────────────────────────────────────────
    $("#btnNuevaUnidad").on("click", function () {
        $("#unidadNombre, #unidadAbreviacion").val("");
        modalNuevaUnidad.show();
    });

    $("#btnGuardarUnidad").on("click", function () {
        const nombre = $("#unidadNombre").val().trim();
        const abrev  = $("#unidadAbreviacion").val().trim();
        if (!nombre || !abrev) { mensajesAlert("Nombre y abreviación son obligatorios|bg-danger"); return; }

        $.ajax({
            url: "/admin/inventario/gestionar",
            type: "POST",
            data: { tipoProceso: 9, nombre, descripcion: abrev },
            success: function () {
                modalNuevaUnidad.hide();
                mensajesAlert("Unidad de medida creada|bg-success");
                cargarUnidades();
            },
            error: () => mensajesAlert("Error al crear unidad|bg-danger")
        });
    });

    // ────────────────────────────────────────────────────────────
    // TAB 2 — RECETAS: SUB-TAB PRODUCTOS
    // ────────────────────────────────────────────────────────────

    function cargarProductosReceta() {
        $.ajax({
            url: "/admin/inventario/recetas",
            type: "GET",
            data: { tipoProceso: 5 },
            dataType: "json",
            success: function (data) {
                const $tbody = $("#bodyProductosReceta").empty();
                productoSeleccionado = null;
                $("#panelReceta").hide();
                $("#panelRecetaVacio").show();

                if (!data || data.length === 0) {
                    $tbody.html('<tr><td colspan="3" class="tabla-empty"><i class="bi bi-inbox"></i><p>Sin productos</p></td></tr>');
                    return;
                }

                data.forEach(row => {
                    const $tr = $(`<tr class="fila-producto" style="cursor:pointer;">
                        <td><strong>${row.n_nombre_producto}</strong></td>
                        <td><small>${row.categoria}</small></td>
                        <td><span class="badge-count">${row.total_insumos_receta}</span></td>
                    </tr>`).data("row", row);

                    $tr.on("click", function () {
                        $(".fila-producto").removeClass("table-active");
                        $tr.addClass("table-active");
                        productoSeleccionado = row;
                        cargarRecetaProducto(row.id_producto, row.n_nombre_producto);
                    });

                    $tbody.append($tr);
                });
            }
        });
    }

    function cargarRecetaProducto(idProducto, nombreProducto) {
        $("#tituloReceta").text(nombreProducto);
        $("#panelRecetaVacio").hide();
        $("#panelReceta").show();
        $("#bodyReceta").html('<tr><td colspan="6" class="tabla-empty"><i class="bi bi-arrow-repeat spin"></i><p>Cargando receta...</p></td></tr>');

        $.ajax({
            url: "/admin/inventario/recetas",
            type: "GET",
            data: { tipoProceso: 1, idProducto },
            dataType: "json",
            success: function (data) {
                const $tbody = $("#bodyReceta").empty();
                if (!data || data.length === 0) {
                    $tbody.html('<tr><td colspan="6" class="tabla-empty"><i class="bi bi-info-circle"></i><p>Sin insumos asignados aún</p></td></tr>');
                    return;
                }
                data.forEach(row => {
                    $tbody.append(`<tr>
                        <td><strong>${row.insumo}</strong></td>
                        <td><small>${row.categoria_insumo}</small></td>
                        <td>${row.cantidad_requerida}</td>
                        <td><span class="badge-unidad">${row.abreviacion}</span></td>
                        <td>${row.stock_actual} ${row.abreviacion}</td>
                        <td>
                            <button class="btn-accion-mini btn-edit-mini btn-editar-receta-item"
                                data-id="${row.id_producto_insumo}"
                                data-nombre="${row.insumo}"
                                data-cantidad="${row.cantidad_requerida}">
                                <i class="bi bi-pencil-fill"></i>
                            </button>
                            <button class="btn-accion-mini btn-del-mini btn-eliminar-receta-item"
                                data-id="${row.id_producto_insumo}"
                                data-nombre="${row.insumo}"
                                data-producto="${idProducto}">
                                <i class="bi bi-trash3-fill"></i>
                            </button>
                        </td>
                    </tr>`);
                });
            }
        });
    }

    // Delegación: editar/eliminar fila de receta de producto
    $("#bodyReceta").on("click", ".btn-editar-receta-item", function () {
        $("#editRecetaId").val($(this).data("id"));
        $("#editRecetaInsumoNombre").text($(this).data("nombre"));
        $("#editRecetaCantidad").val($(this).data("cantidad"));
        modalEditarReceta.show();
    });

    $("#bodyReceta").on("click", ".btn-eliminar-receta-item", function () {
        const id     = $(this).data("id");
        const nombre = $(this).data("nombre");
        const idProd = $(this).data("producto");
        if (!confirm(`¿Eliminar "${nombre}" de la receta?`)) return;

        $.ajax({
            url: "/admin/inventario/recetas",
            type: "POST",
            data: { tipoProceso: 4, idProductoInsumo: id },
            success: function () {
                mensajesAlert("Insumo eliminado de la receta|bg-success");
                cargarRecetaProducto(idProd, $("#tituloReceta").text());
                cargarProductosReceta();
            },
            error: () => mensajesAlert("Error al eliminar|bg-danger")
        });
    });

    $("#btnGuardarEditarReceta").on("click", function () {
        const id   = $("#editRecetaId").val();
        const cant = parseFloat($("#editRecetaCantidad").val());
        if (!cant || cant <= 0) { mensajesAlert("La cantidad debe ser mayor a 0|bg-danger"); return; }

        $.ajax({
            url: "/admin/inventario/recetas",
            type: "POST",
            data: { tipoProceso: 3, idProductoInsumo: id, cantidadRequerida: cant },
            success: function () {
                modalEditarReceta.hide();
                mensajesAlert("Cantidad actualizada|bg-success");
                if (productoSeleccionado)
                    cargarRecetaProducto(productoSeleccionado.id_producto, productoSeleccionado.n_nombre_producto);
            },
            error: () => mensajesAlert("Error al actualizar|bg-danger")
        });
    });

    // ── Agregar insumo a receta de producto ──────────────────────
    $("#btnAgregarInsumoReceta").on("click", function () {
        if (!productoSeleccionado) return;
        $("#recetaProductoId").val(productoSeleccionado.id_producto);
        $("#recetaProductoNombre").text(productoSeleccionado.n_nombre_producto);
        $("#recetaCantidad").val("");
        cargarSelectInsumosReceta("#recetaInsumoId");
        modalAgregarReceta.show();
    });

    $("#btnGuardarReceta").on("click", function () {
        const idProd  = $("#recetaProductoId").val();
        const idInsum = $("#recetaInsumoId").val();
        const cant    = parseFloat($("#recetaCantidad").val());

        if (!idInsum || !cant || cant <= 0) {
            mensajesAlert("Insumo y cantidad son obligatorios|bg-danger");
            return;
        }

        $.ajax({
            url: "/admin/inventario/recetas",
            type: "POST",
            data: { tipoProceso: 2, idProducto: idProd, idInsumo: idInsum, cantidadRequerida: cant },
            success: function (resp) {
                if (resp.resultado === 0) { mensajesAlert(resp.mensaje + "|bg-warning"); return; }
                modalAgregarReceta.hide();
                mensajesAlert("Insumo agregado a la receta|bg-success");
                cargarRecetaProducto(idProd, productoSeleccionado.n_nombre_producto);
                cargarProductosReceta();
            },
            error: () => mensajesAlert("Error al agregar insumo a receta|bg-danger")
        });
    });

    // ────────────────────────────────────────────────────────────
    // TAB 2 — RECETAS: SUB-TAB EXTRAS   ← NUEVO
    // ────────────────────────────────────────────────────────────

    function cargarExtrasReceta() {
        $.ajax({
            url: "/admin/inventario/recetas",
            type: "GET",
            data: { tipoProceso: 10 },
            dataType: "json",
            success: function (data) {
                const $tbody = $("#bodyExtrasReceta").empty();
                extraSeleccionado = null;
                $("#panelRecetaExtra").hide();
                $("#panelRecetaExtraVacio").show();

                if (!data || data.length === 0) {
                    $tbody.html('<tr><td colspan="3" class="tabla-empty"><i class="bi bi-inbox"></i><p>Sin extras registrados</p></td></tr>');
                    return;
                }

                data.forEach(row => {
                    const $tr = $(`<tr class="fila-extra" style="cursor:pointer;">
                        <td><strong>${row.nombre_opcion}</strong></td>
                        <td><small>${row.subcategoria}</small></td>
                        <td><span class="badge-count">${row.total_insumos_receta}</span></td>
                    </tr>`).data("row", row);

                    $tr.on("click", function () {
                        $(".fila-extra").removeClass("table-active");
                        $tr.addClass("table-active");
                        extraSeleccionado = row;
                        cargarRecetaExtra(row.id_subcategoria_opcion, row.nombre_opcion);
                    });

                    $tbody.append($tr);
                });
            },
            error: () => {
                $("#bodyExtrasReceta").html('<tr><td colspan="3" class="tabla-empty"><i class="bi bi-exclamation-triangle"></i><p>Error al cargar</p></td></tr>');
            }
        });
    }

    function cargarRecetaExtra(idOpcion, nombreOpcion) {
        $("#tituloRecetaExtra").text(nombreOpcion);
        $("#panelRecetaExtraVacio").hide();
        $("#panelRecetaExtra").show();
        $("#bodyRecetaExtra").html('<tr><td colspan="6" class="tabla-empty"><i class="bi bi-arrow-repeat spin"></i><p>Cargando...</p></td></tr>');

        $.ajax({
            url: "/admin/inventario/recetas",
            type: "GET",
            // proceso 6, reutiliza idProducto como id_subcategoria_opcion
            data: { tipoProceso: 6, idProducto: idOpcion },
            dataType: "json",
            success: function (data) {
                const $tbody = $("#bodyRecetaExtra").empty();
                if (!data || data.length === 0) {
                    $tbody.html('<tr><td colspan="6" class="tabla-empty"><i class="bi bi-info-circle"></i><p>Sin insumos asignados aún</p></td></tr>');
                    return;
                }
                data.forEach(row => {
                    $tbody.append(`<tr>
                        <td><strong>${row.insumo}</strong></td>
                        <td><small>${row.categoria_insumo}</small></td>
                        <td>${row.cantidad_requerida}</td>
                        <td><span class="badge-unidad">${row.abreviacion}</span></td>
                        <td>${row.stock_actual} ${row.abreviacion}</td>
                        <td>
                            <button class="btn-accion-mini btn-edit-mini btn-editar-extra-item"
                                data-id="${row.id_opcion_insumo}"
                                data-nombre="${row.insumo}"
                                data-cantidad="${row.cantidad_requerida}">
                                <i class="bi bi-pencil-fill"></i>
                            </button>
                            <button class="btn-accion-mini btn-del-mini btn-eliminar-extra-item"
                                data-id="${row.id_opcion_insumo}"
                                data-nombre="${row.insumo}"
                                data-opcion="${idOpcion}">
                                <i class="bi bi-trash3-fill"></i>
                            </button>
                        </td>
                    </tr>`);
                });
            }
        });
    }

    // Delegación: editar/eliminar fila de receta de extra
    $("#bodyRecetaExtra").on("click", ".btn-editar-extra-item", function () {
        $("#editRecetaExtraId").val($(this).data("id"));
        $("#editRecetaExtraInsumoNombre").text($(this).data("nombre"));
        $("#editRecetaExtraCantidad").val($(this).data("cantidad"));
        modalEditarRecetaExtra.show();
    });

    $("#bodyRecetaExtra").on("click", ".btn-eliminar-extra-item", function () {
        const id      = $(this).data("id");
        const nombre  = $(this).data("nombre");
        const idOpcion = $(this).data("opcion");
        if (!confirm(`¿Eliminar "${nombre}" del extra?`)) return;

        $.ajax({
            url: "/admin/inventario/recetas",
            type: "POST",
            data: { tipoProceso: 9, idOpcionInsumo: id },
            success: function () {
                mensajesAlert("Insumo eliminado del extra|bg-success");
                cargarRecetaExtra(idOpcion, $("#tituloRecetaExtra").text());
                cargarExtrasReceta();
            },
            error: () => mensajesAlert("Error al eliminar|bg-danger")
        });
    });

    $("#btnGuardarEditarRecetaExtra").on("click", function () {
        const id   = $("#editRecetaExtraId").val();
        const cant = parseFloat($("#editRecetaExtraCantidad").val());
        if (!cant || cant <= 0) { mensajesAlert("La cantidad debe ser mayor a 0|bg-danger"); return; }

        $.ajax({
            url: "/admin/inventario/recetas",
            type: "POST",
            data: { tipoProceso: 8, idOpcionInsumo: id, cantidadRequerida: cant },
            success: function () {
                modalEditarRecetaExtra.hide();
                mensajesAlert("Cantidad actualizada|bg-success");
                if (extraSeleccionado)
                    cargarRecetaExtra(extraSeleccionado.id_subcategoria_opcion, extraSeleccionado.nombre_opcion);
            },
            error: () => mensajesAlert("Error al actualizar|bg-danger")
        });
    });

    // ── Agregar insumo a receta de extra ─────────────────────────
    $("#btnAgregarInsumoExtra").on("click", function () {
        if (!extraSeleccionado) return;
        $("#recetaExtraId").val(extraSeleccionado.id_subcategoria_opcion);
        $("#recetaExtraNombre").text(extraSeleccionado.nombre_opcion);
        $("#recetaExtraCantidad").val("");
        cargarSelectInsumosReceta("#recetaExtraInsumoId");
        modalAgregarRecetaExtra.show();
    });

    $("#btnGuardarRecetaExtra").on("click", function () {
        const idOpcion = $("#recetaExtraId").val();
        const idInsum  = $("#recetaExtraInsumoId").val();
        const cant     = parseFloat($("#recetaExtraCantidad").val());

        if (!idInsum || !cant || cant <= 0) {
            mensajesAlert("Insumo y cantidad son obligatorios|bg-danger");
            return;
        }

        $.ajax({
            url: "/admin/inventario/recetas",
            type: "POST",
            // proceso 7: idProducto = id_subcategoria_opcion
            data: { tipoProceso: 7, idProducto: idOpcion, idInsumo: idInsum, cantidadRequerida: cant },
            success: function (resp) {
                if (resp.resultado === 0) { mensajesAlert(resp.mensaje + "|bg-warning"); return; }
                modalAgregarRecetaExtra.hide();
                mensajesAlert("Insumo agregado al extra|bg-success");
                cargarRecetaExtra(idOpcion, extraSeleccionado.nombre_opcion);
                cargarExtrasReceta();
            },
            error: () => mensajesAlert("Error al agregar insumo al extra|bg-danger")
        });
    });

    // ────────────────────────────────────────────────────────────
    // TAB 3 — LOG
    // ────────────────────────────────────────────────────────────

    function cargarLog() {
        $("#bodyLog").html('<tr><td colspan="10" class="tabla-empty"><i class="bi bi-arrow-repeat spin"></i><p>Cargando...</p></td></tr>');
        $.ajax({
            url: "/admin/inventario/gestionar",
            type: "GET",
            data: { tipoProceso: 10 },
            dataType: "json",
            success: function (data) {
                const $tbody = $("#bodyLog").empty();
                if (!data || data.length === 0) {
                    $tbody.html('<tr><td colspan="10" class="tabla-empty"><i class="bi bi-inbox"></i><p>Sin movimientos</p></td></tr>');
                    return;
                }
                data.forEach(row => {
                    const tipoCls = {
                        ENTRADA: "badge-entrada",
                        SALIDA:  "badge-salida",
                        ALTA:    "badge-alta",
                        EDICION: "badge-edicion",
                        BAJA:    "badge-baja",
                        AJUSTE:  "badge-ajuste"
                    }[row.tipo_movimiento] || "";

                    const difVal  = parseFloat(row.diferencia);
                    const difSign = difVal >= 0 ? `+${difVal}` : `${difVal}`;
                    const difCls  = difVal >= 0 ? "dif-pos" : "dif-neg";

                    $tbody.append(`<tr>
                        <td><small>${row.t_fecha ?? "—"}</small></td>
                        <td><strong>${row.insumo}</strong></td>
                        <td><span class="badge-tipo ${tipoCls}">${row.tipo_movimiento}</span></td>
                        <td>${row.cantidad_anterior}</td>
                        <td>${row.cantidad_nueva}</td>
                        <td class="${difCls}">${difSign} ${row.unidad}</td>
                        <td><span class="badge-unidad">${row.unidad}</span></td>
                        <td><small>${row.n_descripcion ?? "—"}</small></td>
                        <td><small>${row.n_usuario}</small></td>
                        <td>${row.id_orden ? `#${row.id_orden}` : "—"}</td>
                    </tr>`);
                });
            }
        });
    }

    // ────────────────────────────────────────────────────────────
    // HELPERS — Cargar selects
    // ────────────────────────────────────────────────────────────

    function cargarSelectCategorias(selector, valorSeleccionado = null) {
        $.ajax({
            url: "/admin/inventario/gestionar",
            type: "GET",
            data: { tipoProceso: 6 },
            dataType: "json",
            success: function (data) {
                const $sel = $(selector).empty().append('<option value="">Seleccione</option>');
                data.forEach(row => {
                    const sel = valorSeleccionado && row.id == valorSeleccionado ? "selected" : "";
                    $sel.append(`<option value="${row.id}" ${sel}>${row.nombre}</option>`);
                });
            }
        });
    }

    function cargarSelectUnidades(selector, valorSeleccionado = null) {
        $.ajax({
            url: "/admin/inventario/gestionar",
            type: "GET",
            data: { tipoProceso: 7 },
            dataType: "json",
            success: function (data) {
                const $sel = $(selector).empty().append('<option value="">Seleccione</option>');
                data.forEach(row => {
                    const sel = valorSeleccionado && row.id == valorSeleccionado ? "selected" : "";
                    $sel.append(`<option value="${row.id}" ${sel}>${row.nombre} (${row.abreviacion})</option>`);
                });
            }
        });
    }

    function cargarSelectInsumosReceta(selector) {
        $.ajax({
            url: "/admin/inventario/gestionar",
            type: "GET",
            data: { tipoProceso: 1 },
            dataType: "json",
            success: function (data) {
                const $sel = $(selector).empty().append('<option value="">Seleccione un insumo</option>');
                data.forEach(row => {
                    $sel.append(`<option value="${row.id_insumo}">${row.n_nombre} (${row.stock_actual} ${row.abreviacion})</option>`);
                });
            }
        });
    }

});