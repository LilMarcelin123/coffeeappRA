/* ════════════════════════════════════════════════════════════
   Caja.js — Arqueo y movimientos de caja
   Rincón Arboledas

   El turno, el fondo y lo que deberia haber en caja los calcula
   sp_gestion_caja. Aqui no se suma nada: solo se pinta lo que
   responde el servidor y se manda lo que la cajera escribio.
   ════════════════════════════════════════════════════════════ */

import { mostrarConfirmacion2 } from '../FuncionesGenerales.js';

const API = {
    resumen     : "/admin/caja/resumen",
    movimientos : "/admin/caja/movimientos",
    arqueos     : "/admin/caja/arqueos",
};

const CATEGORIA = {
    PROVEEDOR : "Proveedor",
    BANCO     : "Banco",
    GASTO     : "Gasto chico",
    CAMBIO    : "Cambio",
    OTRO      : "Otro",
};

const estado = {
    tipo     : "SALIDA",   // el movimiento que mas hacen
    venta    : null,
    esperado : null,
    enviando : false,
};

/* Se tapan la venta en efectivo y el esperado, no el fondo ni los
   movimientos: esos la cajera ya los conoce. Tapar solo el esperado
   no serviria de nada, porque se saca sumando los demas recuadros. */
const TAPADOS = ["cajaVenta", "cajaEsperado"];

let modalArqueo = null;

/* ── Arranque ─────────────────────────────────────────────── */
export function initCaja() {
    if (!document.getElementById("formMovimiento")) return;

    modalArqueo = bootstrap.Modal.getOrCreateInstance(
        document.getElementById("modalArqueo"), { backdrop: "static" });

    enlazarEventos();
    refrescarTurno();
    prepararRangoArqueos();
    cargarArqueos();
}

function enlazarEventos() {
    document.querySelectorAll(".mov-tipo__btn").forEach(btn => {
        btn.addEventListener("click", () => seleccionarTipo(btn.dataset.tipo));
    });

    document.getElementById("formMovimiento")
            .addEventListener("submit", registrarMovimiento);

    document.getElementById("tbodyMovimientos")
            .addEventListener("click", alClicEnMovimientos);

    document.getElementById("btnVerEsperado")
            .addEventListener("click", alternarEsperado);

    document.getElementById("btnAbrirArqueo")
            .addEventListener("click", abrirArqueo);

    document.getElementById("btnConfirmarArqueo")
            .addEventListener("click", confirmarArqueo);

    document.getElementById("btnBuscarArqueos")
            .addEventListener("click", cargarArqueos);
}

/* ── Turno en curso ───────────────────────────────────────── */
async function refrescarTurno() {
    const [resumen, movimientos] = await Promise.all([
        pedir(API.resumen),
        pedir(API.movimientos),
    ]);

    pintarResumen(resumen);
    pintarMovimientos(movimientos ?? []);
}

function pintarResumen(r) {
    if (!r) return;

    estado.venta    = Number(r.p_venta_efectivo ?? 0);
    estado.esperado = Number(r.p_esperado ?? 0);

    texto("cajaFondo",    dinero(r.p_fondo));
    texto("cajaEntradas", dinero(r.p_entradas));
    texto("cajaSalidas",  dinero(r.p_salidas));

    pintarTapados();

    const desde   = hora(r.t_desde);
    const arqueos = Number(r.n_arqueos_hoy ?? 0);
    texto("cajaSubtitulo",
          arqueos > 0
              ? `Turno en curso desde las ${desde} · ${arqueos} arqueo${arqueos !== 1 ? "s" : ""} hoy`
              : `Turno en curso desde las ${desde} · primer arqueo del día`);
}

/** Un solo interruptor para los dos recuadros que delatan el conteo. */
function alternarEsperado() {
    const destapar = document.getElementById("cajaEsperado").dataset.oculto === "1";

    TAPADOS.forEach(id => { document.getElementById(id).dataset.oculto = destapar ? "0" : "1"; });
    document.querySelector("#btnVerEsperado i").className =
        destapar ? "bi bi-eye-slash-fill" : "bi bi-eye-fill";

    pintarTapados();
}

function pintarTapados() {
    const valores = { cajaVenta: estado.venta, cajaEsperado: estado.esperado };

    TAPADOS.forEach(id => {
        const tile = document.getElementById(id);
        tile.textContent = tile.dataset.oculto === "1" ? "••••" : dinero(valores[id]);
    });
}

/* ── Movimientos ──────────────────────────────────────────── */
function seleccionarTipo(tipo) {
    estado.tipo = tipo;
    document.querySelectorAll(".mov-tipo__btn").forEach(btn => {
        const activo = btn.dataset.tipo === tipo;
        btn.classList.toggle("active", activo);
        btn.setAttribute("aria-pressed", String(activo));
    });
}

async function registrarMovimiento(evento) {
    evento.preventDefault();
    if (estado.enviando) return;

    const monto = Number(document.getElementById("movMonto").value);
    if (!(monto > 0)) { avisar("Captura un monto mayor a cero.", "advertencia"); return; }

    const cuerpo = {
        tipo      : estado.tipo,
        categoria : document.getElementById("movCategoria").value,
        monto     : monto,
        concepto  : document.getElementById("movConcepto").value.trim(),
    };

    bloquear("btnAnotar", true);
    estado.enviando = true;

    const salida = await enviar(API.movimientos, "POST", cuerpo);

    estado.enviando = false;
    bloquear("btnAnotar", false);

    if (!salida?.ok) { avisar(salida?.mensaje ?? "No se pudo anotar el movimiento.", "error"); return; }

    document.getElementById("movMonto").value    = "";
    document.getElementById("movConcepto").value = "";
    document.getElementById("movMonto").focus();

    await refrescarTurno();
}

function pintarMovimientos(lista) {
    const tbody = document.getElementById("tbodyMovimientos");

    if (!lista.length) {
        tbody.innerHTML = `
            <tr><td colspan="7">
                <div class="empty-state">
                    <i class="bi bi-journal"></i>
                    <span>Sin movimientos en este turno</span>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(m => {
        const salida = m.n_tipo === "SALIDA";
        return `
            <tr>
                <td style="font-size:.82rem;color:var(--text-muted);">${esc(m.n_hora)}</td>
                <td><span class="${salida ? "badge-salida" : "badge-entrada"}">
                    <i class="bi ${salida ? "bi-box-arrow-up-right" : "bi-box-arrow-in-down-left"}"></i>
                    ${salida ? "Salida" : "Entrada"}</span></td>
                <td style="font-size:.82rem;">${esc(CATEGORIA[m.n_categoria] ?? m.n_categoria)}</td>
                <td style="font-size:.82rem;">${esc(m.n_concepto) || "—"}</td>
                <td style="font-size:.78rem;color:var(--text-muted);">${esc(m.n_usuario)}</td>
                <td class="${salida ? "td-salida" : "td-entrada"}">${salida ? "−" : "+"}${dinero(m.p_monto)}</td>
                <td style="text-align:right;">
                    <button class="btn-borrar-mov" data-borrar="${m.id_movimiento}"
                            title="Borrar este movimiento" aria-label="Borrar movimiento">
                        <i class="bi bi-trash3"></i>
                    </button>
                </td>
            </tr>`;
    }).join("");
}

async function alClicEnMovimientos(evento) {
    const boton = evento.target.closest("[data-borrar]");
    if (!boton) return;

    if (!confirm("¿Borrar este movimiento? Solo se puede mientras no se arquee.")) return;

    const salida = await enviar(`${API.movimientos}/${boton.dataset.borrar}`, "DELETE");
    if (!salida?.ok) { avisar(salida?.mensaje ?? "No se pudo borrar.", "advertencia"); return; }

    await refrescarTurno();
}

/* ── Arqueo ───────────────────────────────────────────────── */
function abrirArqueo() {
    document.getElementById("arqContado").value      = "";
    document.getElementById("arqObservaciones").value = "";
    document.getElementById("arqResultado").className = "arqueo-resultado";
    document.getElementById("btnConfirmarArqueo").disabled = false;
    document.getElementById("btnConfirmarArqueo").textContent = "Registrar arqueo";
    modalArqueo.show();
    setTimeout(() => document.getElementById("arqContado").focus(), 300);
}

async function confirmarArqueo() {
    const contado = Number(document.getElementById("arqContado").value);
    if (!(contado >= 0) || document.getElementById("arqContado").value === "") {
        avisar("Captura cuánto dinero hay en caja.", "advertencia");
        return;
    }

    bloquear("btnConfirmarArqueo", true);

    const salida = await enviar(API.arqueos, "POST", {
        contado,
        observaciones : document.getElementById("arqObservaciones").value.trim(),
    });

    if (!salida?.ok) {
        bloquear("btnConfirmarArqueo", false);
        avisar(salida?.mensaje ?? "No se pudo registrar el arqueo.", "error");
        return;
    }

    mostrarDiferencia(Number(salida.p_diferencia ?? 0), salida.mensaje);
    document.getElementById("btnConfirmarArqueo").disabled = true;

    await refrescarTurno();
    await cargarArqueos();
}

function mostrarDiferencia(diferencia, mensaje) {
    const caja  = document.getElementById("arqResultado");
    const clase = Math.abs(diferencia) < 1 ? "cuadra" : diferencia > 0 ? "sobra" : "falta";

    caja.className = `arqueo-resultado visible arqueo-resultado--${clase}`;
    caja.innerHTML = `
        <div class="arqueo-resultado__cifra">${diferencia > 0 ? "+" : ""}${dinero(diferencia)}</div>
        <div class="arqueo-resultado__texto">${esc(mensaje)}</div>`;
}

/* ── Historial ────────────────────────────────────────────── */
function prepararRangoArqueos() {
    const hoy = document.body.dataset.hoyNegocio;
    if (!hoy) return;
    document.getElementById("arqDesde").value = hoy;
    document.getElementById("arqHasta").value = hoy;
}

async function cargarArqueos() {
    const desde = document.getElementById("arqDesde").value;
    const hasta = document.getElementById("arqHasta").value;
    const query = new URLSearchParams();
    if (desde) query.set("desde", desde);
    if (hasta) query.set("hasta", hasta);

    const lista = await pedir(`${API.arqueos}?${query}`) ?? [];
    const tbody = document.getElementById("tbodyArqueos");

    if (!lista.length) {
        tbody.innerHTML = `
            <tr><td colspan="6">
                <div class="empty-state">
                    <i class="bi bi-clock-history"></i>
                    <span>Sin arqueos en este rango</span>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(a => {
        const dif   = Number(a.p_diferencia ?? 0);
        const clase = Math.abs(dif) < 1 ? "dif-cuadra" : dif > 0 ? "dif-sobra" : "dif-falta";
        return `
            <tr>
                <td style="font-size:.82rem;">${esc(String(a.d_dia_negocio).substring(0, 10))}</td>
                <td style="font-size:.82rem;color:var(--text-muted);">${esc(a.n_hora)}</td>
                <td class="td-total">${dinero(a.p_esperado)}</td>
                <td class="td-total">${dinero(a.p_contado)}</td>
                <td class="td-total ${clase}">${dif > 0 ? "+" : ""}${dinero(dif)}</td>
                <td style="font-size:.78rem;color:var(--text-muted);">${esc(a.n_usuario)}</td>
            </tr>`;
    }).join("");
}

/* ── Plomeria ─────────────────────────────────────────────── */
async function pedir(url) {
    try {
        const respuesta = await fetch(url);
        if (!respuesta.ok) throw new Error(respuesta.status);
        return await respuesta.json();
    } catch (error) {
        console.error("caja:", url, error);
        return null;
    }
}

/** Devuelve siempre { ok, ...cuerpo } para no repetir el try/catch arriba. */
async function enviar(url, metodo, cuerpo) {
    try {
        const respuesta = await fetch(url, {
            method  : metodo,
            headers : cuerpo ? { "Content-Type": "application/json" } : undefined,
            body    : cuerpo ? JSON.stringify(cuerpo) : undefined,
        });
        const datos = await respuesta.json().catch(() => ({}));
        return { ok: respuesta.ok, ...datos };
    } catch (error) {
        console.error("caja:", url, error);
        return { ok: false, mensaje: "No hay conexión con el servidor." };
    }
}

function dinero(valor) {
    return `$${Number(Math.abs(valor ?? 0)).toLocaleString("es-MX", {
        minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function hora(marca) {
    if (!marca) return "01:00";
    return String(marca).replace("T", " ").substring(11, 16) || "01:00";
}

function texto(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
}

function bloquear(id, ocupado) {
    const el = document.getElementById(id);
    if (el) el.disabled = ocupado;
}

function esc(valor) {
    if (valor == null) return "";
    return String(valor)
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function avisar(mensaje, tipo) {
    mostrarConfirmacion2(mensaje, () => {}, () => {}, tipo);
}
