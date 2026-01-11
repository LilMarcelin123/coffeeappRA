import { mensajesAlert, mostrarConfirmacion2 } from '../FuncionesGenerales.js';

let modalConfirmCerrar = null;
let modalConfirmReabrir = null;

function abrirModalSeguro(modalId) {
  document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
  document.body.classList.remove("modal-open");
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("padding-right");

  const el = document.getElementById(modalId);
  const modal = bootstrap.Modal.getOrCreateInstance(el, { backdrop: true, keyboard: true });
  modal.show();
  return modal;
}

$(document).ready(function () {
	
	
	
	$("#btnModalOrden").on("click", function () {
	  mostrarConfirmacion2(
	    "¿Seguro que quieres iniciar una orden?",
	    () => { 
	      $.ajax({
	        url: "/procesoInicialOrden",
	        type: "GET",
	        data: { tipoProceso: 1 },
	        success: function (data) {
	          const idOrden = data.idOrden;
	          window.location.href = "/admin/tomaOrden?idOrden=" + idOrden;
	        },
	        error: function () {
	          alert("No se pudo iniciar la orden, intenta de nuevo.");
	        }
	      });
	    }, 
	    () => { 
	      console.log("El usuario canceló la acción");
	    }
	  );
	});


  // ---- Modal confirmación cierre ----
  const modalElCerrar = document.getElementById("modalConfirmCerrar");
  modalConfirmCerrar = bootstrap.Modal.getOrCreateInstance(modalElCerrar);

  modalElCerrar.addEventListener("hidden.bs.modal", function () {
    document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
  });

  // ---- Modal confirmación reabrir ----
  const modalElReabrir = document.getElementById("modalConfirmReabrir");
  modalConfirmReabrir = bootstrap.Modal.getOrCreateInstance(modalElReabrir);

  modalElReabrir.addEventListener("hidden.bs.modal", function () {
    document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
  });

  // ---- Cargar tabla pendientes ----
  cargarPendientes();

  // Select all
  $("#chkAll").on("change", function () {
    const checked = $(this).is(":checked");
    $(".chkRow").prop("checked", checked);
    actualizarBotonesAccion();
  });

  // Abrir modal CERRAR con seleccionadas
  $("#btnCerrarSeleccionadas").on("click", function () {
    const ids = obtenerIdsSeleccionados();
    if (ids.length === 0) return;

    renderListaConfirmacion(ids); // usa tu lista de cierre
    modalConfirmCerrar = abrirModalSeguro("modalConfirmCerrar");
  });

  // Confirmar cierre
  $("#btnConfirmarCerrar").on("click", function () {
    const ids = obtenerIdsSeleccionados();
    if (ids.length === 0) {
      modalConfirmCerrar.hide();
      return;
    }
    cerrarOrdenes(ids);
  });


  $("#btnReabrirSeleccionadas").on("click", function () {
    const ids = obtenerIdsSeleccionados();
    if (ids.length === 0) return;

    renderListaReabrir(ids);
    modalConfirmReabrir = abrirModalSeguro("modalConfirmReabrir");
  });

  // Confirmar reabrir
  $("#btnConfirmarReabrir").on("click", function () {
    const ids = obtenerIdsSeleccionados();
    if (ids.length === 0) {
      modalConfirmReabrir.hide();
      return;
    }

    modalConfirmReabrir.hide();  
    reabrirOrdenes(ids);
  });

});

// ---------------- Funciones tabla ----------------

function cargarPendientes() {
  $.ajax({
    url: "/admin/orden/pendientes",
    type: "GET",
    success: function (lista) {
      renderPendientes(lista);
    },
    error: function (xhr) {
      console.log("Error pendientes:", xhr.responseText);
    }
  });
}

function renderPendientes(lista) {
  const tbody = document.getElementById("tbodyPendientes");
  const tpl = document.getElementById("tplPendienteRow");

  tbody.innerHTML = "";

  (lista || []).forEach(o => {
    const idOrden = o.id_orden;
    const node = tpl.content.cloneNode(true);
    const tr = node.querySelector("tr");

    tr.dataset.idOrden = idOrden;

    node.querySelector(".col-id").textContent = idOrden ?? "";
    node.querySelector(".col-hora").textContent = o.t_hora_creacion ?? "";
    node.querySelector(".col-total").textContent =
      (o.p_total != null) ? `$${Number(o.p_total).toFixed(2)}` : "$0.00";
    node.querySelector(".col-resumen").textContent = o.resumen ?? "";

    const chk = node.querySelector(".chkRow");

    chk.addEventListener("change", function () {
      const total = $("#tbodyPendientes .chkRow").length;
      const marcados = $("#tbodyPendientes .chkRow:checked").length;
      $("#chkAll").prop("checked", total > 0 && marcados === total);

      actualizarBotonesAccion();
    });

    tr.addEventListener("click", function (e) {
      const tag = e.target.tagName.toLowerCase();
      if (tag === "input" || tag === "button" || tag === "a") return;

      chk.checked = !chk.checked;

      const total = $("#tbodyPendientes .chkRow").length;
      const marcados = $("#tbodyPendientes .chkRow:checked").length;
      $("#chkAll").prop("checked", total > 0 && marcados === total);

      actualizarBotonesAccion();
    });

    tbody.appendChild(node);
  });

  $("#chkAll").prop("checked", false);
  actualizarBotonesAccion();
}

function obtenerIdsSeleccionados() {
  const ids = [];
  $("#tbodyPendientes tr").each(function () {
    const tr = this;
    const chk = tr.querySelector(".chkRow");
    if (chk && chk.checked) ids.push(Number(tr.dataset.idOrden));
  });
  return ids;
}

function actualizarBotonesAccion() {
  const ids = obtenerIdsSeleccionados();
  const disabled = ids.length === 0;

  $("#btnCerrarSeleccionadas").prop("disabled", disabled);
  $("#btnReabrirSeleccionadas").prop("disabled", disabled);
}

function renderListaConfirmacion(ids) {
  const ul = document.getElementById("listaOrdenesSeleccionadas");
  ul.innerHTML = "";
  ids.forEach(id => {
    const li = document.createElement("li");
    li.textContent = `Orden #${id}`;
    ul.appendChild(li);
  });
}

function renderListaReabrir(ids) {
  const ul = document.getElementById("listaOrdenesReabrir");
  ul.innerHTML = "";
  ids.forEach(id => {
    const li = document.createElement("li");
    li.textContent = `Orden #${id}`;
    ul.appendChild(li);
  });
}

function cerrarOrdenes(ids) {
  $("#btnConfirmarCerrar").prop("disabled", true);

  const requests = ids.map(idOrden =>
    $.ajax({
      url: "/admin/orden/gestionar",
      type: "POST",
      data: { idOrden: idOrden, tipoProceso: 1, idRol: 1 }
    })
  );

  $.when.apply($, requests)
    .done(function () {
      $("#btnConfirmarCerrar").prop("disabled", false);
      modalConfirmCerrar.hide();
      cargarPendientes();
    })
    .fail(function (xhr) {
      $("#btnConfirmarCerrar").prop("disabled", false);
      console.log("Error cerrando:", xhr.responseText);
      alert("No se pudieron cerrar una o más órdenes.");
    });
}

function reabrirOrdenes(ids) {
  $("#btnConfirmarReabrir").prop("disabled", true);
  console.log('entra: '+ids);
  const requests = ids.map(idOrden =>
    $.ajax({
      url: "/admin/orden/gestionar",
      type: "POST",
      data: { idOrden: idOrden, tipoProceso: 5, idRol: 1 }
    })

  );

  $.when.apply($, requests)
    .always(function () {                 
      $("#btnConfirmarReabrir").prop("disabled", false);
      modalConfirmReabrir.hide();        
      cargarPendientes();
    });
}


