import { mensajesAlert, mostrarConfirmacion } from '../FuncionesGenerales.js';

function eliminarItem(idOrdenItem) {
    $.ajax({
        url: "/admin/orden/eliminarItem",
        type: "POST",
        data: { idOrdenItem: idOrdenItem },
        success: function () {
            cargarResumenOrden();
        },
        error: function (xhr) {
            console.error("Error eliminando item:", xhr.responseText);
            alert("No se pudo eliminar el producto.");
        }
    });
}

function renderResumenOrden(lista) {
    const contenedor = document.getElementById("contenedorResumenOrden");
    const tpl        = document.getElementById("tplResumenItem");
    const totalVista = document.getElementById("totalOrdenVista");

    contenedor.innerHTML = "";
    let total = 0;

    if (!lista || lista.length === 0) {
        totalVista.textContent = "$0.00";
        return;
    }

    lista.forEach(item => {
        const cantidad    = Number(item.cantidad || 0);
        const producto    = (item.producto || "").toString();
        const extrasTxt   = (item.extras || "").toString().trim();
        const totalItem   = Number(item.total_item || 0);
        const idOrdenItem = item.id_orden_item;

        total += totalItem;

        const node = tpl.content.cloneNode(true);

        node.querySelector(".cantidad").textContent   = `${cantidad}x`;
        node.querySelector(".producto").textContent   = producto;
        node.querySelector(".total-item").textContent = `$${totalItem.toFixed(2)}`;

        const extrasEl = node.querySelector(".extras");
        if (extrasTxt !== "") {
            extrasEl.style.display = "block";
            extrasEl.textContent   = `+ ${extrasTxt}`;
        }

        const btnEliminar = node.querySelector(".btn-eliminar-item");
        btnEliminar.addEventListener("click", function () {
            eliminarItem(idOrdenItem);
        });

        contenedor.appendChild(node);
    });

    totalVista.textContent = `$${total.toFixed(2)}`;
}

function cargarResumenOrden() {
    const idOrden = $("#idOrden").val();

    $.ajax({
        url: "/admin/orden/resumen",
        type: "GET",
        data: { idOrden: idOrden },
        success: function (lista) {
            renderResumenOrden(lista);

            // Si ya hay items (orden reabierta), mostrar confirmar sin necesidad de añadir
            if (lista && lista.length > 0) {
                $("#btnConfirmaOrden").prop("disabled", false);
                $("#btnConfirmaOrden").show();
            }
        },
        error: function (xhr) {
            console.log("Error resumen:", xhr.responseText);
        }
    });
}

function cargarOpcionesExtras(idSubcategoria) {
    $.ajax({
        url: "/api/opcionesPorSubcategoria/" + idSubcategoria,
        method: "GET",
        success: function (data) {
            if (!data || data.length === 0) {
                $("#contenedorOpcionesExtras").html(
                    "<p class='text-muted mt-2'>Esta subcategoría no tiene extras disponibles.</p>"
                );
                return;
            }

            let html = `<label class="form-label fw-bold mt-3">Opciones Extras</label>`;

            data.forEach(o => {
                html += `
                    <div class="row align-items-center mb-1">
                        <div class="col-8">
                            <div class="form-check text-start">
                                <input class="form-check-input extra-checkbox"
                                       type="checkbox"
                                       name="idOpcionesExtras"
                                       value="${o.id}"
                                       id="extra_${o.id}">
                                <label class="form-check-label" for="extra_${o.id}">
                                    ${o.nombre} (+$${o.precio})
                                </label>
                            </div>
                        </div>
                        <div class="col-4">
                            <input type="number"
                                   class="form-control form-control-sm extra-qty"
                                   name="cantidadExtra_${o.id}"
                                   id="cantidadExtra_${o.id}"
                                   min="1" max="10" value="1" disabled>
                        </div>
                    </div>
                `;
            });

            $("#contenedorOpcionesExtras").html(html);
        },
        error: function () {
            $("#contenedorOpcionesExtras").html(
                "<p class='text-danger mt-2'>Error cargando extras.</p>"
            );
        }
    });
}


$(document).ready(function () {

    $("#btnAñadeItem").hide();
    $("#btnConfirmaOrden").prop("disabled", true);
    $("#btnConfirmaOrden").hide();
    $("#cantidadProducto").prop("disabled", true);
    $("#cantidadProducto").hide();

    // Cargar resumen al entrar (muestra items si la orden fue reabierta)
    cargarResumenOrden();

    $(document).on("change", "#selectCategoria", function () {
        $("#cantidadProducto").val("");
        $("#cantidadProducto").hide();

        const idCategoria = $(this).val();

        if (!idCategoria) {
            $("#contenedorProductos").html("");
            $("#contenedorSubcategoria").html("");
            $("#contenedorOpcionesExtras").html("");
            return;
        }

        $.ajax({
            url: "/api/productosPorCategoria/" + idCategoria,
            method: "GET",
            success: function (data) {
                if (!data || data.length === 0) {
                    $("#contenedorProductos").html(
                        "<p class='text-muted mt-2'>No hay productos para esta categoría.</p>"
                    );
                    return;
                }

                let html = `
                    <label class="form-label fw-bold">Productos</label>
                    <select id="selectProducto" class="form-select" required>
                        <option value="">Seleccione un producto</option>
                `;
                data.forEach(p => {
                    html += `<option value="${p.id}">${p.nombre}</option>`;
                });
                html += `</select>`;

                $("#contenedorProductos").html(html);
            }
        });

        $.ajax({
            url: "/api/subcategoriaPorCategoria/" + idCategoria,
            method: "GET",
            success: function (data) {
                if (!data || !data.id) {
                    $("#contenedorSubcategoria").html("");
                    $("#contenedorOpcionesExtras").html("");
                    return;
                }

                const html = `
                    <label class="form-label fw-bold mt-3">Subcategoría / Extras</label>
                    <select id="selectSubcategoria" class="form-select" disabled>
                        <option value="${data.id}" selected>${data.nombre}</option>
                    </select>
                    <input type="hidden" id="subcategoriaHidden" name="idSubcategoria" value="${data.id}">
                `;
                $("#contenedorSubcategoria").html(html);
                cargarOpcionesExtras(data.id);
            }
        });
    });

    document.addEventListener("DOMContentLoaded", function () {
        const params  = new URLSearchParams(window.location.search);
        const idOrden = params.get("idOrden");

        if (idOrden) {
            const div = document.getElementById("resultadoProceso");
            div.innerHTML = `
                <div class="alert alert-success p-2 mb-0">
                    🧾 Orden iniciada correctamente: <strong>#${idOrden}</strong>
                </div>
            `;
        }
    });

    $(document).on("change", ".extra-checkbox", function () {
        const idExtra   = $(this).val();
        const $cantidad = $("#cantidadExtra_" + idExtra);

        if (this.checked) {
            $cantidad.prop("disabled", false);
        } else {
            $cantidad.prop("disabled", true);
            $cantidad.val(1);
        }
    });

    $("#contenedorProductos").on("change", function () {
        $("#cantidadProducto").val("");
        $("#cantidadProducto").prop("disabled", false);
        $("#cantidadProducto").show();
        $("#btnAñadeItem").show();
    });

    $("#btnAñadeItem").on("click", function () {
        $("#btnConfirmaOrden").prop("disabled", false);
        $("#btnConfirmaOrden").show();

        const idOrden          = $("#idOrden").val();
        const idProducto       = $("#selectProducto").val();
        const cantidadProducto = $("#cantidadProducto").val();

        const extras = [];
        $(".extra-checkbox:checked").each(function () {
            const idExtra       = $(this).val();
            const cantidadExtra = $("#cantidadExtra_" + idExtra).val() || 1;
            extras.push({
                id_extra: parseInt(idExtra),
                cantidad: parseInt(cantidadExtra)
            });
        });

        $.ajax({
            url: "/admin/orden/agregarItem",
            type: "POST",
            data: {
                idOrden:          idOrden,
                idProducto:       idProducto,
                cantidadProducto: cantidadProducto,
                listaExtrasJson:  JSON.stringify(extras)
            },
            success: function (data) {
                console.log("Item agregado:", data);

                $("#selectCategoria").val('');
                $("#contenedorProductos").html('');
                $("#cantidadProducto").val('').hide();
                $("#contenedorOpcionesExtras").html('');
                $("#btnAñadeItem").hide();

                cargarResumenOrden();
            },
            error: function (xhr, status, error) {
                console.error("Error al agregar item:", error);
                alert("No se pudo agregar el producto a la orden.");
            }
        });
    });

    $("#btnConfirmaOrden").on("click", function () {
        mostrarConfirmacion(
            "¿Seguro que quieres continuar con la orden?",
            () => {
                $.ajax({
                    url: "/admin/orden/gestionar",
                    type: "POST",
                    data: {
                        idOrden:     $("#idOrden").val(),
                        tipoProceso: 2,
                        idRol:       1
                    },
                    success: function (resp) {
                        console.log("Preparaciones generadas:", resp.filas);
                        window.location.href = "/admin";
                    }
                });
            },
            () => { console.log("El usuario canceló la acción"); }
        );
    });

});