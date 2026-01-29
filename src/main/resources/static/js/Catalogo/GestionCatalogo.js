import { mostrarConfirmacion2, mensajesAlert } from "../FuncionesGenerales.js";
let modalEditar;

$(document).ready(function () {

    const modalEditarEl = document.getElementById("modalEditar");
    if (modalEditarEl) {
        modalEditar = new bootstrap.Modal(modalEditarEl, {
            backdrop: 'static',
            keyboard: false
        });
    }

    const $tipoProceso = $("#tipoProceso");
    const $thead = $("#tablaCatalogoHead");
    const $tbody = $("#tablaCatalogoBody");

    const $btnEditar = $("#btnEditar");
    const $btnEliminar = $("#btnEliminar");
    const $btnInsertar = $("#btnInsertar");

    let filaSeleccionada = null;

    // ================================
    // Cambio de catálogo
    // ================================
    $tipoProceso.on("change", function () {
        cargarTablaCatalogo(this.value);
        deshabilitarAcciones();
        $btnInsertar.prop("disabled", false); // habilitar insertar cuando hay selección
    });

    // ================================
    // AJAX tabla
    // ================================
    function cargarTablaCatalogo(tipoProceso) {
        $.ajax({
            url: "/admin/catalogo/vista",
            type: "GET",
            data: { tipoProceso },
            dataType: "json",
            success: pintarTabla,
            error: limpiarTabla
        });
    }

    // ================================
    // Pintar tabla
    // ================================
    function pintarTabla(data) {
        limpiarTabla();
        filaSeleccionada = null;

        if (!Array.isArray(data) || data.length === 0) return;

        const columnas = Object.keys(data[0]);

        $thead.append("<th></th>");
        columnas.forEach(col => $thead.append(`<th>${col}</th>`));

        data.forEach(row => {
            const $tr = $("<tr>")
                .addClass("fila-catalogo")
                .css("cursor", "pointer")
                .data("row", row);

            const $check = $('<input type="radio" name="filaSeleccion" class="form-check-input">');

            $check.on("change", function () {
                $(".fila-catalogo").removeClass("table-active");
                filaSeleccionada = row;
                $tr.addClass("table-active");
                habilitarAcciones();
            });

            $tr.append($("<td>").append($check));

            columnas.forEach(col => {
                $tr.append(`<td>${row[col] ?? ""}</td>`);
            });

            $tr.on("click", function () {
                $check.prop("checked", true).trigger("change");
            });

            $tbody.append($tr);
        });
    }

    // ================================
    // Editar
    // ================================
    $("#btnEditar").on("click", function () {
        if (!filaSeleccionada) return;

        $("#nombre").val(filaSeleccionada.Nombre ?? "");
        $("#precio").val(filaSeleccionada.Precio ?? "");
        $("#descripcion").val(filaSeleccionada.Descripcion ?? "");
        $("#rol").val(filaSeleccionada.Rol ?? "");

        modalEditar.show();
    });

    // ================================
    // Guardar cambios
    // ================================
    $("#btnGuardarCambios").on("click", function () {
        if (!filaSeleccionada) return;

        const precioVal = $("#precio").val().trim();

        if (precioVal === "" || isNaN(precioVal)) {
            bootstrap.Modal.getInstance(document.getElementById("modalEditar")).hide();
            mensajesAlert("Debes ingresar un precio válido antes de guardar|bg-danger");
            $("#precio").focus();
            return;
        }

        const payload = {
            tipoProceso: obtenerTipoProceso("editar"),
            id: filaSeleccionada.ID,
            nombre: $("#nombre").val() || null,
            precio: parseFloat(precioVal),
            descripcion: $("#descripcion").val() || null,
            rol: $("#rol").val() ? parseInt($("#rol").val()) : null
        };

        $.ajax({
            url: "/admin/catalogo/gestionar",
            type: "POST",
            data: payload,
            success: function () {
                bootstrap.Modal.getInstance(document.getElementById("modalEditar")).hide();
                mensajesAlert("Se actualizó el campo correctamente|bg-success");
                $tipoProceso.trigger("change");
            },
            error: function () {
                mensajesAlert("Error al actualizar|bg-danger");
            }
        });
    });

    // ================================
    // Eliminar
    // ================================
    $("#btnEliminar").on("click", function () {
        if (!filaSeleccionada) return;

        $("#mensajeEliminar").text(`¿Está seguro que desea eliminar el registro con ID ${filaSeleccionada.ID}?`);

        const modalEliminar = new bootstrap.Modal(document.getElementById("modalEliminar"));
        modalEliminar.show();

        $("#btnConfirmarEliminar").off("click").on("click", function () {
            $.ajax({
                url: "/admin/catalogo/gestionar",
                type: "POST",
                data: {
                    tipoProceso: obtenerTipoProceso("eliminar"),
                    id: filaSeleccionada.ID
                },
                success: function () {
                    modalEliminar.hide();
                    $tipoProceso.trigger("change");
                    mensajesAlert("Se eliminó el campo correctamente|bg-success");
                },
                error: function () {
                    mensajesAlert("Error al eliminar el registro|bg-danger");
                }
            });
        });
    });
	
	$("#btnInsertar").on("click", function () {
	    const modalInsertar = new bootstrap.Modal(document.getElementById("modalInsertar"));

	    // Ocultar todo por defecto
	    $("#precioContainer, #descripcionContainer, #rolContainer, #categoriaSelectContainer, #subcategoriaSelectContainer").hide();

	    if ($tipoProceso.val() === "1") {
	        // Categoría → solo nombre
	    }

	    if ($tipoProceso.val() === "2") {
	        // Subcategoría → solo nombre
	    }

	    if ($tipoProceso.val() === "3") {
	        // Producto → nombre, precio, descripción, rol, categoría padre
	        $("#precioContainer, #descripcionContainer, #rolContainer, #categoriaSelectContainer").show();

	        // Cargar categorías
	        $.ajax({
	            url: "/admin/catalogo/vista",
	            type: "GET",
	            data: { tipoProceso: 1 },
	            dataType: "json",
	            success: function (data) {
	                const $select = $("#insertCategoria");
	                $select.empty().append('<option value="">Seleccione</option>');
	                data.forEach(cat => {
	                    $select.append(`<option value="${cat.ID}">${cat.Nombre}</option>`);
	                });
	            }
	        });

	        // Cargar roles dinámicos
	        $.ajax({
	            url: "/admin/catalogo/vistaRoles",
	            type: "GET",
	            dataType: "json",
	            success: function (data) {
	                const $select = $("#insertRol");
	                $select.empty().append('<option value="">Seleccione</option>');
	                data.forEach(rol => {
	                    $select.append(`<option value="${rol.ID}">${rol.Nombre}</option>`);
	                });
	            }
	        });
	    }

	    if ($tipoProceso.val() === "4") {
	        // Opción → nombre, precio, subcategoría padre
	        $("#precioContainer, #subcategoriaSelectContainer").show();

	        $.ajax({
	            url: "/admin/catalogo/vista",
	            type: "GET",
	            data: { tipoProceso: 2 },
	            dataType: "json",
	            success: function (data) {
	                const $select = $("#insertSubcategoria");
	                $select.empty().append('<option value="">Seleccione</option>');
	                data.forEach(sub => {
	                    $select.append(`<option value="${sub.ID}">${sub.Nombre}</option>`);
	                });
	            }
	        });
	    }

	    modalInsertar.show();
	});

	$("#btnGuardarInsertar").on("click", function () {
	    const nombre = $("#insertNombre").val().trim();
	    const precioVal = $("#insertPrecio").val().trim();
	    const descripcion = $("#insertDescripcion").val().trim();
	    const rol = $("#insertRol").val();

	    if (nombre === "") {
	        mensajesAlert("El nombre es obligatorio|bg-danger");
	        return;
	    }

	    if (($tipoProceso.val() === "3" || $tipoProceso.val() === "4") && (precioVal === "" || isNaN(precioVal))) {
	        mensajesAlert("Debes ingresar un precio válido|bg-danger");
	        return;
	    }

	    const payload = {
	        tipoProceso: obtenerTipoProceso("insertar"),
	        nombre: nombre || null,
	        precio: precioVal ? parseFloat(precioVal) : null,
	        descripcion: descripcion || null,
	        rol: rol ? parseInt(rol) : null,
	        id: null
	    };

		if ($tipoProceso.val() === "3") {
		    // Producto → id_categoria obligatorio
		    const categoriaId = $("#insertCategoria").val();
		    if (!categoriaId) {
		        mensajesAlert("Debes elegir una categoría antes de guardar el producto|bg-danger");
		        return;
		    }
		    payload.id = parseInt(categoriaId);
		}
		$.ajax({
		    url: "/admin/catalogo/vista",
		    type: "GET",
		    data: { tipoProceso: 1 }, // cargar categorías
		    dataType: "json",
		    success: function (data) {
		        const $select = $("#insertCategoria");
		        $select.empty().append('<option value="">Seleccione</option>');
		        data.forEach(cat => {
		            $select.append(`<option value="${cat.ID}">${cat.Nombre}</option>`);
		        });
		    }
		});


	    if ($tipoProceso.val() === "4") {
	        // Opción → id_subcategoria
	        const subcategoriaId = $("#insertSubcategoria").val();
	        if (!subcategoriaId) {
	            mensajesAlert("Debes elegir una subcategoría|bg-danger");
	            return;
	        }
	        payload.id = parseInt(subcategoriaId);
	    }

	    $.ajax({
	        url: "/admin/catalogo/gestionar",
	        type: "POST",
	        data: payload,
	        success: function () {
	            bootstrap.Modal.getInstance(document.getElementById("modalInsertar")).hide();
	            mensajesAlert("Registro insertado correctamente|bg-success");
	            $tipoProceso.trigger("change");
	        },
	        error: function () {
	            mensajesAlert("Error al insertar registro|bg-danger");
	        }
	    });
	});



    // ================================
    // Utilidades
    // ================================
    function limpiarTabla() {
        $thead.empty();
        $tbody.empty();
        deshabilitarAcciones();
    }

    function habilitarAcciones() {
        $btnEditar.prop("disabled", false);
        $btnEliminar.prop("disabled", false);
    }

    function deshabilitarAcciones() {
        $btnEditar.prop("disabled", true);
        $btnEliminar.prop("disabled", true);
    }

    function obtenerTipoProceso(accion) {
        const mapa = {
            "1": { insertar: 1, editar: 2, eliminar: 3 },   // Categoría
            "2": { insertar: 4, editar: 5, eliminar: 6 },   // Subcategoría
            "3": { insertar: 7, editar: 8, eliminar: 9 },   // Producto
            "4": { insertar: 10, editar: 11, eliminar: 12 } // Opción
        };
        return mapa[$tipoProceso.val()]?.[accion];
    }

});
