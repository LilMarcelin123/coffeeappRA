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

    let filaSeleccionada = null;

    // ================================
    // Cambio de catálogo
    // ================================
    $tipoProceso.on("change", function () {
        cargarTablaCatalogo(this.value);
        deshabilitarAcciones();
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
			bootstrap.Modal.getInstance(
			    document.getElementById("modalEditar")
			).hide();
		    mensajesAlert("Debes ingresar un precio válido antes de guardar|bg-danger");
		    $("#precio").focus();
		    return;
		}

	    const payload = {
	        tipoProceso: obtenerTipoProceso("editar"),
	        id: filaSeleccionada.ID,
	        nombre: $("#nombre").val() || null,
	        precio: parseFloat(precioVal), // ya validado
	        descripcion: $("#descripcion").val() || null,
	        rol: $("#rol").val() ? parseInt($("#rol").val()) : null
	    };

	    $.ajax({
	        url: "/admin/catalogo/gestionar",
	        type: "POST",
	        data: payload,
	        success: function () {
	            bootstrap.Modal.getInstance(
	                document.getElementById("modalEditar")
	            ).hide();
				mensajesAlert("Se actualizó el campo correctamente|bg-success");
	            $tipoProceso.trigger("change");
	        },
	        error: function () {
	            alert("Error al actualizar");
	        }
	    });
	});

    // ================================
    // Eliminar
    // ================================
	$("#btnEliminar").on("click", function () {
	    if (!filaSeleccionada) return;

	    // Actualiza el mensaje dinámico
	    $("#mensajeEliminar").text(`¿Está seguro que desea eliminar el registro con ID ${filaSeleccionada.ID}?`);

	    // Muestra el modal
	    const modalEliminar = new bootstrap.Modal(document.getElementById("modalEliminar"));
	    modalEliminar.show();

	    // Manejo de confirmación
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
            "1": { editar: 2, eliminar: 3 },
            "2": { editar: 5, eliminar: 6 },
            "3": { editar: 8, eliminar: 9 },
            "4": { editar: 11, eliminar: 12 }
        };
        return mapa[$tipoProceso.val()]?.[accion];
    }

});
