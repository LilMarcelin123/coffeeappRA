import { mostrarConfirmacion2, mensajesAlert } from "../FuncionesGenerales.js";
$(document).ready(function () {

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
        cargarTablaCatalogo($(this).val());
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

        if (!data || data.length === 0) return;

        const columnas = Object.keys(data[0]);

        $thead.append("<th></th>");
        columnas.forEach(col => $thead.append(`<th>${col}</th>`));

        data.forEach(row => {

            const $tr = $("<tr>").addClass("fila-catalogo").data("row", row);

            const $check = $('<input type="checkbox" class="form-check-input">');

            $check.on("change", function () {

                $(".form-check-input").not(this).prop("checked", false);
                $(".fila-catalogo").removeClass("table-active");

                if (this.checked) {
                    filaSeleccionada = $tr.data("row");
                    $tr.addClass("table-active");
                    habilitarAcciones();
                } else {
                    filaSeleccionada = null;
                    deshabilitarAcciones();
                }
            });

            $tr.append($("<td>").append($check));

            columnas.forEach(col => {
                $tr.append(`<td>${row[col] ?? ""}</td>`);
            });

            $tbody.append($tr);
        });
    }

    // ================================
    // Botones
    // ================================
    $btnEditar.on("click", function () {
        if (!filaSeleccionada) return;

        console.log("EDITAR →", filaSeleccionada);

        // aquí luego pintas el formulario
        // ejemplo:
        // $("#nombre").val(filaSeleccionada.Nombre);
    });

    $btnEliminar.on("click", function () {
        if (!filaSeleccionada) return;

        if (!confirm(`¿Eliminar ID ${filaSeleccionada.ID}?`)) return;

        console.log("ELIMINAR → ID:", filaSeleccionada.ID);

        // aquí luego llamas al SP
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

});

