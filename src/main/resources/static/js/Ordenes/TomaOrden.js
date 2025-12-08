

$(document).ready(function() { 
	

	
	$("#btnModalOrden").on("click", function () {
	    console.log("ORDEN");

	    $.ajax({
	        url: "/procesoInicialOrden",
	        type: "GET",
	        data: { tipoProceso: 1 }, 
			success: function (data) {
			    console.log("Respuesta procesoInicialOrden:", data);
			    
			    const idOrden = data.idOrden;
				window.location.href = "/admin/tomaOrden?idOrden=" + idOrden;
			},
	        error: function (xhr, status, error) {
	            console.error("Error al iniciar orden:", error);
	            alert("No se pudo iniciar la orden, intenta de nuevo.");
	        }
	    });
	});

	$("#btnModalGestCat").on("click", function() {
		console.log("GEST CAT");
	});
	
	$("#btnModalGestUser").on("click", function() {
		console.log("GEST USER");
	});

	

  });