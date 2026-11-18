/* ================================================================
   AperturaCaja.js — modal fijo de apertura de caja (Inicio admin)

   Solo se carga cuando falta la apertura del dia. Abre el modal,
   valida, pide confirmacion y registra. Al terminar recarga Inicio:
   ya con la caja abierta, el panel carga normal.
   ================================================================ */
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);

    const modalEl   = $("modalAperturaCaja");
    if (!modalEl) return;

    const captura   = $("aperturaPasoCaptura");
    const confirmar = $("aperturaPasoConfirmar");
    const fondo     = $("aperturaFondo");
    const nombre    = $("aperturaResponsable");
    const btnOk     = $("aperturaConfirmar");

    const dinero = (n) => "$" + Number(n).toLocaleString("es-MX",
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    function error(el, texto) {
        el.textContent = texto || "";
        el.hidden = !texto;
    }

    function paso(cual) {
        captura.hidden   = cual !== "captura";
        confirmar.hidden = cual !== "confirmar";
        (cual === "captura" ? fondo : btnOk).focus();
    }

    // ── Abrir: fijo, no se cierra ───────────────────────────────
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: "static", keyboard: false });
    modalEl.addEventListener("shown.bs.modal", () => fondo.focus());
    modalEl.addEventListener("hide.bs.modal", (e) => { if (!modalEl.dataset.listo) e.preventDefault(); });
    modal.show();

    // ── Paso 1 → 2 ──────────────────────────────────────────────
    captura.addEventListener("submit", (e) => {
        e.preventDefault();
        const monto = parseFloat(fondo.value);

        if (fondo.value.trim() === "" || isNaN(monto) || monto < 0) {
            error($("aperturaError"), "Captura el fondo de caja (puede ser 0).");
            fondo.focus(); return;
        }
        if (monto > 20000) {
            error($("aperturaError"), "Ese fondo es demasiado alto. Revisa el monto.");
            fondo.focus(); return;
        }
        if (nombre.value.trim().length < 3) {
            error($("aperturaError"), "Escribe el nombre de quien registra el fondo.");
            nombre.focus(); return;
        }

        error($("aperturaError"), "");
        error($("aperturaErrorConf"), "");
        $("aperturaConfMonto").textContent  = dinero(monto);
        $("aperturaConfNombre").textContent = nombre.value.trim();
        paso("confirmar");
    });

    $("aperturaCorregir").addEventListener("click", () => paso("captura"));

    // ── Paso 2 · registrar ──────────────────────────────────────
    btnOk.addEventListener("click", async () => {
        btnOk.disabled = true;
        const cuerpo = new URLSearchParams({ fondo: fondo.value.trim(), responsable: nombre.value.trim() });

        try {
            const r = await fetch("/admin/apertura", {
                method: "POST",
                headers: { "Accept": "application/json",
                           "Content-Type": "application/x-www-form-urlencoded" },
                body: cuerpo
            });
            const datos = await r.json().catch(() => ({}));

            if (r.ok && Number(datos.resultado) === 1) {
                modalEl.dataset.listo = "1";
                window.location.reload();
                return;
            }
            error($("aperturaErrorConf"), datos.mensaje || "No se pudo registrar. Intenta de nuevo.");
        } catch (e) {
            error($("aperturaErrorConf"), "Sin conexión con el sistema. Intenta de nuevo.");
        }
        btnOk.disabled = false;
    });
})();
