/* ================================================================
   Avisos.js — avisos cortos para todo el sistema

   Toast de Bootstrap 5 que se crea solo: no depende de que la
   pantalla tenga un modal de alertas. Reemplaza a alert(), que
   bloquea la pantalla y en tablet se ve fuera de lugar.

     import { avisar } from '../Comun/Avisos.js';
     avisar("No se pudo agregar el producto.", "error");

   Tipos: exito · error · advertencia · info. Los errores se quedan
   más tiempo en pantalla. El texto se pinta como texto (no HTML).
   También queda en window.Avisos para scripts clásicos.
   Estilos en css/base.css.
   ================================================================ */

const ICONOS = {
    exito       : "bi-check-circle-fill",
    error       : "bi-x-octagon-fill",
    advertencia : "bi-exclamation-triangle-fill",
    info        : "bi-info-circle-fill",
};
const DURACION = { exito: 3000, info: 4000, advertencia: 6000, error: 7000 };

function contenedor() {
    let c = document.getElementById("rinconAvisos");
    if (!c) {
        c = document.createElement("div");
        c.id = "rinconAvisos";
        c.className = "toast-container position-fixed bottom-0 end-0 p-3 rincon-avisos";
        c.setAttribute("aria-live", "polite");
        c.setAttribute("aria-atomic", "false");
        document.body.appendChild(c);
    }
    return c;
}

export function avisar(mensaje, tipo = "info") {
    if (!ICONOS[tipo]) tipo = "info";

    const toast = document.createElement("div");
    toast.className = `toast rincon-aviso rincon-aviso--${tipo}`;
    toast.setAttribute("role", tipo === "error" ? "alert" : "status");

    const cuerpo = document.createElement("div");
    cuerpo.className = "toast-body";
    cuerpo.innerHTML = `<i class="bi ${ICONOS[tipo]} rincon-aviso__icono" aria-hidden="true"></i>`;

    const texto = document.createElement("span");
    texto.className = "rincon-aviso__texto";
    texto.textContent = String(mensaje ?? "");
    cuerpo.appendChild(texto);

    const cerrar = document.createElement("button");
    cerrar.type = "button";
    cerrar.className = "btn-close";
    cerrar.setAttribute("aria-label", "Cerrar aviso");
    cerrar.dataset.bsDismiss = "toast";
    cuerpo.appendChild(cerrar);

    toast.appendChild(cuerpo);
    contenedor().appendChild(toast);

    if (window.bootstrap?.Toast) {
        const t = window.bootstrap.Toast.getOrCreateInstance(toast, { delay: DURACION[tipo] });
        toast.addEventListener("hidden.bs.toast", () => toast.remove());
        t.show();
    } else {
        // Sin Bootstrap: se muestra igual y se quita solo
        toast.classList.add("show");
        cerrar.addEventListener("click", () => toast.remove());
        setTimeout(() => toast.remove(), DURACION[tipo]);
    }
}

/**
 * Marca un botón como ocupado mientras corre una acción, para que
 * no se mande dos veces. Devuelve una función que lo libera.
 *   const liberar = ocupar(btn, "Enviando…"); ... liberar();
 */
export function ocupar(boton, texto) {
    if (!boton) return () => {};
    const original = boton.innerHTML;
    boton.disabled = true;
    boton.classList.add("is-ocupado");
    boton.setAttribute("aria-busy", "true");
    if (texto) {
        boton.innerHTML = `<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>${texto}`;
    }
    return () => {
        boton.disabled = false;
        boton.classList.remove("is-ocupado");
        boton.removeAttribute("aria-busy");
        boton.innerHTML = original;
    };
}

window.Avisos = { avisar, ocupar };
