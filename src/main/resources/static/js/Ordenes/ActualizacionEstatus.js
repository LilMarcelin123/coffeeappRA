(function (window, $) {
    "use strict";

    const ENDPOINTS = {
        enviar:    "/admin/orden/actualizacion/enviar",
        historial: "/admin/orden/actualizacion/historial",
    };

    const ESTATUS = {
        EN_PREPARACION: { clase: "prep",    label: "En preparación", campos: ["tiempo"] },
        EN_CAMINO:      { clase: "camino",  label: "En camino",      campos: ["tiempo", "telefono"] },
        ENTREGADO:      { clase: "entreg",  label: "Entregado",      campos: ["telefono"] },
        CERRADA:        { clase: "cerrada", label: "Cerrada",        campos: [] },
    };

    let _modal = null, _ordenActual = null, _estatusActual = null;
    const $el = (id) => document.getElementById(id);
    function esc(s) { return $("<span>").text(s ?? "").html(); }

    function formatearFecha(valor) {
        if (!valor) return "";
        let d;
        if (typeof valor === "number" || /^\d+$/.test(String(valor))) {
            d = new Date(Number(valor));
        } else {
            d = new Date(String(valor).replace(" ", "T"));
        }
        if (isNaN(d.getTime())) return String(valor);
        const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return `${d.getDate()}/${meses[d.getMonth()]} ${hh}:${mm}`;
    }

    function construirPreview(estatus, tiempo, telefono) {
        const t = (tiempo || "").trim(), tel = (telefono || "").trim();
        switch (estatus) {
            case "EN_PREPARACION":
                return `Hola 👋, el estatus de tu orden es: *EN PREPARACIÓN*. ⏱ Tiempo estimado: ${t || "el indicado por la cafetería"}.`;
            case "EN_CAMINO": {
                let m = "Hola 👋, tu pedido ya va *EN CAMINO* 🚗.";
                if (t)   m += ` ⏱ Tiempo estimado: ${t}.`;
                if (tel) m += ` 📞 Contacto del repartidor: ${tel}`;
                return m;
            }
            case "ENTREGADO": {
                let m = "¡Tu pedido llegó! 🎉 El repartidor ya está en tu ubicación.";
                if (tel) m += ` 📞 Contacto: ${tel}`;
                return m;
            }
            case "CERRADA":
                return "✨ Gracias por tu pedido. Esperamos que disfrutes tu comida ❤️ ¡Te esperamos pronto!";
            default: return "";
        }
    }

    function aplicarSeleccionEstatus(estatus) {
        _estatusActual = estatus;
        const meta = ESTATUS[estatus];
        document.querySelectorAll(".ae-estatus-opt").forEach(opt => {
            opt.className = "ae-estatus-opt";
            if (opt.dataset.estatus === estatus) opt.classList.add("is-active--" + meta.clase);
        });
        $el("aeCampoTiempo").classList.toggle("is-visible", meta.campos.includes("tiempo"));
        $el("aeCampoTelefono").classList.toggle("is-visible", meta.campos.includes("telefono"));
        limpiarErrores();
        actualizarPreview();
        $el("aeBtnEnviar").disabled = false;
    }

    function actualizarPreview() {
        if (!_estatusActual) return;
        const texto = construirPreview(_estatusActual, $el("aeInputTiempo").value, $el("aeInputTelefono").value);
        $el("aePreviewTexto").textContent = texto;
        $el("aePreview").classList.add("is-visible");
    }

    function limpiarErrores() {
        $el("aeCampoTiempo").classList.remove("has-error");
        $el("aeCampoTelefono").classList.remove("has-error");
    }

    function validar() {
        if (!_estatusActual) return false;
        const meta = ESTATUS[_estatusActual];
        let ok = true;
        limpiarErrores();
        if (meta.campos.includes("telefono")) {
            const tel = $el("aeInputTelefono").value.trim();
            if (tel && !/^\d{10}$/.test(tel)) { $el("aeCampoTelefono").classList.add("has-error"); ok = false; }
        }
        return ok;
    }

    function enviar() {
        if (!_ordenActual || !_estatusActual) return;
        if (!validar()) return;
        const btn = $el("aeBtnEnviar"), htmlOriginal = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Enviando…';
        $.ajax({
            url: ENDPOINTS.enviar, type: "POST",
            data: {
                idOrden: _ordenActual.idOrden, estatus: _estatusActual,
                tiempoEstimado: $el("aeInputTiempo").value.trim(),
                telefonoRepartidor: $el("aeInputTelefono").value.trim(),
            },
            success: function (resp) {
                if (resp && resp.ok) {
                    notificar("success", "Actualización enviada al cliente.");
                    cargarHistorial(_ordenActual.idOrden);
                    $el("aeInputTiempo").value = ""; $el("aeInputTelefono").value = "";
                    actualizarPreview();
                } else {
                    notificar("error", (resp && resp.mensaje) || "No se pudo enviar la actualización.");
                }
            },
            error: function (xhr) {
                console.error("[ActualizacionEstatus] error envío:", xhr.responseText);
                notificar("error", "Error de conexión al enviar la actualización.");
            },
            complete: function () { btn.disabled = false; btn.innerHTML = htmlOriginal; }
        });
    }

    function cargarHistorial(idOrden) {
        const cont = $el("aeTimeline");
        cont.innerHTML = '<div class="ae-timeline-empty">Cargando…</div>';
        $.ajax({
            url: ENDPOINTS.historial, type: "GET", data: { idOrden },
            success: function (lista) { renderTimeline(lista); },
            error: function () { cont.innerHTML = '<div class="ae-timeline-empty">No se pudo cargar el historial.</div>'; }
        });
    }

    function claseEstatus(e) { return (ESTATUS[e] && ESTATUS[e].clase) || "cerrada"; }

    function renderTimeline(lista) {
        const cont = $el("aeTimeline");
        cont.innerHTML = "";
        if (!lista || lista.length === 0) {
            cont.innerHTML = '<div class="ae-timeline-empty">Aún no se han enviado actualizaciones.</div>';
            return;
        }
        lista.forEach(item => {
            const estatus = item.n_estatus || "CERRADA";
            const clase = claseEstatus(estatus);
            const label = (ESTATUS[estatus] && ESTATUS[estatus].label) || estatus;
            const enviado = String(item.b_enviado) === "1";
            const meta = [];
            meta.push(esc(formatearFecha(item.t_fecha_hora)));
            if (item.n_usuario_admin) meta.push("por " + esc(item.n_usuario_admin));
            if (!enviado) meta.push('<span class="ae-timeline-noenviado">no entregado</span>');
            cont.insertAdjacentHTML("beforeend", `
                <div class="ae-timeline-item">
                    <span class="ae-timeline-dot ae-timeline-dot--${clase}"></span>
                    <div><span class="ae-badge ae-badge--${clase}">${esc(label)}</span></div>
                    <div class="ae-timeline-msg">${esc(item.n_mensaje || "")}</div>
                    <div class="ae-timeline-meta">${meta.join(" · ")}</div>
                </div>`);
        });
    }

    function notificar(tipo, mensaje) {
        if (typeof window.mensajesAlert === "function") window.mensajesAlert(tipo, mensaje);
        else { console.log(`[${tipo}] ${mensaje}`); if (tipo === "error") alert(mensaje); }
    }

    function abrirModal(orden) {
        _ordenActual = orden; _estatusActual = null;
        $el("aeOrdenId").textContent = "#" + orden.idOrden;
        $el("aeOrdenCliente").textContent = orden.cliente || "—";
        $el("aeOrdenTelefono").textContent = orden.telefono || "—";
        document.querySelectorAll(".ae-estatus-opt").forEach(o => o.className = "ae-estatus-opt");
        $el("aeCampoTiempo").classList.remove("is-visible", "has-error");
        $el("aeCampoTelefono").classList.remove("is-visible", "has-error");
        $el("aeInputTiempo").value = ""; $el("aeInputTelefono").value = "";
        $el("aePreview").classList.remove("is-visible");
        $el("aeBtnEnviar").disabled = true;
        cargarHistorial(orden.idOrden);
        _modal = bootstrap.Modal.getOrCreateInstance($el("modalActualizacionEstatus"), { backdrop: true, keyboard: true });
        _modal.show();
    }

    function init() {
        document.querySelectorAll(".ae-estatus-opt").forEach(opt => {
            opt.addEventListener("click", () => aplicarSeleccionEstatus(opt.dataset.estatus));
        });
        ["aeInputTiempo", "aeInputTelefono"].forEach(id => {
            const e = $el(id); if (e) e.addEventListener("input", actualizarPreview);
        });
        const btn = $el("aeBtnEnviar"); if (btn) btn.addEventListener("click", enviar);
        const el = $el("modalActualizacionEstatus");
        if (el) el.addEventListener("hidden.bs.modal", function () {
            document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
            document.body.classList.remove("modal-open");
            document.body.style.removeProperty("overflow");
            document.body.style.removeProperty("padding-right");
        });
    }

    window.ActualizacionEstatus = { init, abrirModal };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

})(window, jQuery);
