

$(document).ready(function() { 
	

	
	$("#btnModalOrden").on("click", function() {
	console.log("ORDEN");

	
//	const modal = new bootstrap.Modal(document.getElementById("modalConfirmación"));
//	modal.show();
	
	
//	$("#modalConfirmación").modal("show");
	   window.location.href = "/admin/tomaOrden";

	});
	
	$("#btnModalGestCat").on("click", function() {
		console.log("GEST CAT");
	});
	
	$("#btnModalGestUser").on("click", function() {
		console.log("GEST USER");
	});

	

  });