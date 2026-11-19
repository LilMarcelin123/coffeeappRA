/* ================================================================
   CajaPestanas.js — pestañas de Caja (Reportes & Arqueo)

   Bootstrap cambia de pestaña solo (data-bs-toggle="tab"). Aquí se
   recuerda cuál está abierta en la URL (#movimientos, #ventas,
   #historial) para que recargar la página o volver a ella abra la
   misma, y el boton "atrás" del navegador no saque de Caja.
   Sin hash abre Arqueo.
   ================================================================ */
(function () {
    "use strict";

    const nav = document.getElementById("cajaPestanas");
    if (!nav || !window.bootstrap?.Tab) return;

    function abrirDesdeHash() {
        const id  = (location.hash || "").replace("#", "");
        const btn = id && document.getElementById("tab-" + id);
        if (btn) window.bootstrap.Tab.getOrCreateInstance(btn).show();
    }

    nav.addEventListener("shown.bs.tab", e => {
        const id = e.target.id.replace("tab-", "");
        history.replaceState(null, "", id === "arqueo" ? location.pathname + location.search : "#" + id);
    });

    window.addEventListener("hashchange", abrirDesdeHash);
    abrirDesdeHash();
})();
