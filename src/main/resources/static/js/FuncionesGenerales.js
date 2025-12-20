

// FuncionesGenerales.js
export function mensajesAlert(mensaje) {
  const mensajeDividido = mensaje.split('|');
  
  // Actualiza el texto del mensaje
  $("#mensajeGenerico").text(mensajeDividido[0]);

  // Aplica clases modernas al encabezado del modal
  $("#modalColor")
    .removeClass()
    .addClass(`modal-header bg-gradient ${mensajeDividido[1]} text-white d-flex align-items-center`);

  // Muestra el modal
  $('#modalAlertas').modal('show');
}



export function mostrarConfirmacion(mensaje, onContinuar, onRegresar) {
  // Setea el mensaje dinámico
  document.getElementById("mensajeConfirmacion").textContent = mensaje;

  // Asigna callbacks a los botones
  const btnContinuar = document.getElementById("btnContinuar");
  const btnRegresar = document.getElementById("btnRegresar");

  btnContinuar.onclick = () => {
    if (onContinuar) onContinuar();
    $('#modalConfirmacion').modal('hide');
  };

  btnRegresar.onclick = () => {
    if (onRegresar) onRegresar();
    $('#modalConfirmacion').modal('hide');
  };

  // Muestra el modal
  $('#modalConfirmacion').modal('show');
}
