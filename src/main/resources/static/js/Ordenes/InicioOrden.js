import { mensajesAlert, mostrarConfirmacion } from '../FuncionesGenerales.js';

$(document).ready(function() {
	$("#btnConfirmaOrden").prop("disabled", true);
	$("#btnConfirmaOrden").hide();
	$("#cantidadProducto").prop("disabled", true);
	$("#cantidadProducto").hide();
	
	$(document).on("change", "#selectCategoria", function() {
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
			success: function(data) {

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
			success: function(data) {
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

                    <!-- hidden para enviar en form -->
                    <input type="hidden" id="subcategoriaHidden" name="idSubcategoria" value="${data.id}">
                `;

				$("#contenedorSubcategoria").html(html);

				cargarOpcionesExtras(data.id);
			}
		});

	});
	
	
	
	
	
	
	
	
	
	
	document.addEventListener("DOMContentLoaded", function () {
	        const params = new URLSearchParams(window.location.search);
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
	
	
	
	
	
	

});


function cargarOpcionesExtras(idSubcategoria) {

	$.ajax({
		url: "/api/opcionesPorSubcategoria/" + idSubcategoria,
		method: "GET",
		success: function(data) {

			if (!data || data.length === 0) {
				$("#contenedorOpcionesExtras").html(
					"<p class='text-muted mt-2'>Esta subcategoría no tiene extras disponibles.</p>"
				);
				return;
			}

			let html = `
                <label class="form-label fw-bold mt-3">Opciones Extras</label>
            `;

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
                                   min="1"
                                   max="10"
                                   value="1"
                                   disabled>
                        </div>
                    </div>
                `;
			});

			$("#contenedorOpcionesExtras").html(html);
		},
		error: function() {
			$("#contenedorOpcionesExtras").html(
				"<p class='text-danger mt-2'>Error cargando extras.</p>"
			);
		}
	});
}


$(document).on("change", ".extra-checkbox", function() {
	const idExtra = $(this).val();
	const $cantidad = $("#cantidadExtra_" + idExtra);

	if (this.checked) {
		$cantidad.prop("disabled", false);
	} else {
		$cantidad.prop("disabled", true);
		$cantidad.val(1);
	}
});



$('#contenedorProductos').on("change",function() {
	$("#cantidadProducto").val("");
	console.log("HERE");
	const idExtra = $(this).val();
	$("#cantidadProducto").prop("disabled", false);

	$("#cantidadProducto").show();

});




$("#btnAñadeItem").on("click", function () {

	$("#btnConfirmaOrden").prop("disabled", false);
	$("#btnConfirmaOrden").show();
	
	    const idOrden = $("#idOrden").val();          
	    const idProducto = $("#selectProducto").val(); 
	    const cantidadProducto = $("#cantidadProducto").val(); // input number

	    console.log("HERE");
	    console.log("idOrden:", idOrden);
	    console.log("idProducto:", idProducto);
	    console.log("cantidadProducto:", cantidadProducto);

	    const extras = [];

		    $(".extra-checkbox:checked").each(function () {
		        const idExtra = $(this).val(); // viene de value="${o.id}"
		        const cantidadExtra = $("#cantidadExtra_" + idExtra).val() || 1;

		        extras.push({
		            id_extra: parseInt(idExtra),
		            cantidad: parseInt(cantidadExtra)
		        });
		    });

		    console.log("extras construidos:", extras);
		    console.log("JSON que se mandará:", JSON.stringify(extras));

		    $.ajax({
		        url: "/admin/orden/agregarItem",
		        type: "POST",
		        data: {
		            idOrden: idOrden,
		            idProducto: idProducto,
		            cantidadProducto: cantidadProducto,
		            listaExtrasJson: JSON.stringify(extras)
		        },
		        success: function (data) {
		            console.log("Item agregado:", data);
		            $("#mensajeItem").html(`
		                <div class="alert alert-success p-2 mb-0">
		                    Producto agregado. ID item: <strong>${data.idItem}</strong>
		                </div>
		            `);
					
					$("#selectCategoria").val('');
					$("#selectProducto").val('');
					$("#cantidadProducto").val('1');
					$("#contenedorOpcionesExtras").html('');

					
					
		        },
		        error: function (xhr, status, error) {
		            console.error("Error al agregar item:", error);
		            console.log("Respuesta completa:", xhr.responseText);
		            alert("No se pudo agregar el producto a la orden.");
		        }
		    });

		});
		
		$("#btnConfirmaOrden").on("click", function () {
		  console.log("CONFIRMA ORDEN");

		  mostrarConfirmacion(
		    "¿Seguro que quieres continuar con la orden?",
		    () => { 
		      console.log("El usuario confirmó la acción"); 

		    }, 
		    () => { 
		      console.log("El usuario canceló la acción"); 

		    }
		  );
		});

		
		

