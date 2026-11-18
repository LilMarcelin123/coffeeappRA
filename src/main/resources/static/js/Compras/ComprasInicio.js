/* ════════════════════════════════════════════════════════════
   ComprasInicio.js — Compras del día, en la pantalla de Inicio
   Rincón Arboledas

   Alta rápida de compras con concepto, monto y de dónde salió el
   dinero. Si salió de caja, sp_gestion_compras anota también la
   salida y el arqueo la descuenta solo: aquí no se suma nada que
   no venga ya sumado del servidor, salvo los totales de la lista.
   ════════════════════════════════════════════════════════════ */

import { mensajesAlert, mostrarConfirmacion2 } from '../FuncionesGenerales.js';

const API = "/admin/compras";

const ORIGEN = {
    CAJA  : { texto: "Caja",  clase: "compras-chip--caja"  },
    FUERA : { texto: "Fuera", clase: "compras-chip--fuera" },
};

// La lista se refresca sola por si otra persona anota desde otro equipo.
const REFRESCO_MS = 60000;

const estado = { enviando: false, cuantas: null };

/* ── Arranque ─────────────────────────────────────────────── */
function init() {
    const form = document.getElementById("formCompra");
    if (!form) return;

    form.addEventListener("submit", registrarCompra);
    document.getElementById("compraOrigen").addEventListener("change", alCambiarOrigen);
    document.getElementById("tbodyCompras").addEventListener("click", alClicEnCompras);

    alCambiarOrigen();
    prepararCajon();
    cargarCompras();

    setInterval(() => {
        if (document.hidden) return;
        if (document.querySelector(".modal.show")) return;
        cargarCompras();
    }, REFRESCO_MS);
}

/* ── Cajón lateral ────────────────────────────────────────── */
/**
 * Offcanvas de Bootstrap: abre/cierra con la pestaña (data-bs-toggle),
 * el botón » y Esc. Aquí solo se acompaña: la pestaña se recorre con
 * el cajón y, al abrir, se refresca la lista y se enfoca el concepto.
 */
function prepararCajon() {
    const cajon   = document.getElementById("cajonCompras");
    const pestana = document.getElementById("pestanaCompras");
    if (!cajon || !pestana) return;

    cajon.addEventListener("show.bs.offcanvas", () => {
        pestana.classList.add("is-abierta");
        pestana.setAttribute("aria-expanded", "true");
        pestana.title = "Ocultar compras";
        cargarCompras();
    });
    cajon.addEventListener("shown.bs.offcanvas", () => {
        document.getElementById("compraConcepto")?.focus();
    });
    cajon.addEventListener("hide.bs.offcanvas", () => {
        pestana.classList.remove("is-abierta");
        pestana.setAttribute("aria-expanded", "false");
        pestana.title = "Compras del día";
    });
}

/** Cuántas compras van hoy, en el globito del carrito. */
function pintarContador(n) {
    const num = document.getElementById("comprasContador");
    if (!num) return;

    num.textContent = n > 99 ? "99+" : String(n);
    num.hidden = n === 0;

    // Salta solo cuando sube, no en cada refresco
    if (estado.cuantas !== null && n > estado.cuantas) {
        num.classList.remove("is-salta");
        void num.offsetWidth;
        num.classList.add("is-salta");
    }
    estado.cuantas = n;

    const pestana = document.getElementById("pestanaCompras");
    if (pestana) pestana.setAttribute("aria-label",
        `Compras del día: ${n} ${n === 1 ? "compra" : "compras"}`);
}

/* ── Formulario ───────────────────────────────────────────── */
/** "De otra manera" pide decir de dónde salió el dinero. */
function alCambiarOrigen() {
    const fuera = document.getElementById("compraOrigen").value === "FUERA";
    const campo = document.getElementById("campoOrigenDetalle");

    campo.hidden = !fuera;
    document.getElementById("compraOrigenDetalle").required = fuera;
    if (!fuera) document.getElementById("compraOrigenDetalle").value = "";
}

async function registrarCompra(evento) {
    evento.preventDefault();
    if (estado.enviando) return;

    const concepto = valor("compraConcepto");
    const monto    = Number(document.getElementById("compraMonto").value);
    const origen   = document.getElementById("compraOrigen").value;
    const detalle  = valor("compraOrigenDetalle");

    if (!concepto)               return avisar("Escribe qué se compró.", "advertencia", "compraConcepto");
    if (!(monto > 0))            return avisar("Captura un monto mayor a cero.", "advertencia", "compraMonto");
    if (origen === "FUERA" && !detalle)
        return avisar("Escribe de dónde salió el dinero.", "advertencia", "compraOrigenDetalle");

    estado.enviando = true;
    bloquear("btnAnotarCompra", true);

    const salida = await enviar(API, "POST", {
        concepto,
        monto,
        origen,
        origenDetalle : origen === "FUERA" ? detalle : null,
    });

    estado.enviando = false;
    bloquear("btnAnotarCompra", false);

    if (!salida?.ok) { avisar(salida?.mensaje ?? "No se pudo anotar la compra.", "error"); return; }

    // El origen se queda como estaba: casi siempre anotan varias
    // compras seguidas pagadas igual.
    document.getElementById("compraConcepto").value = "";
    document.getElementById("compraMonto").value    = "";
    document.getElementById("compraConcepto").focus();

    await cargarCompras();
}

/* ── Lista del día ────────────────────────────────────────── */
async function cargarCompras() {
    const lista = await pedir(API);
    if (lista === null) return;   // sin conexión: se deja lo que había
    pintarCompras(lista);
}

function pintarCompras(lista) {
    const caja  = suma(lista.filter(c => c.n_origen_pago === "CAJA"));
    const fuera = suma(lista.filter(c => c.n_origen_pago === "FUERA"));

    texto("comprasTotal", dinero(caja + fuera));
    texto("comprasCaja",  dinero(caja));
    texto("comprasFuera", dinero(fuera));
    pintarContador(lista.length);

    const tbody = document.getElementById("tbodyCompras");

    if (!lista.length) {
        tbody.innerHTML = `
            <tr><td colspan="5">
                <div class="compras-vacio">
                    <i class="bi bi-bag"></i>
                    <span>Sin compras anotadas hoy</span>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(c => {
        const origen   = ORIGEN[c.n_origen_pago] ?? { texto: c.n_origen_pago, clase: "" };
        const arqueada = Number(c.f_arqueada) === 1;
        const detalle  = c.n_origen_detalle
            ? `<small class="compras-detalle">${esc(c.n_origen_detalle)}</small>` : "";

        const accion = arqueada
            ? `<span class="compras-sellada" title="Ya entró en un arqueo: no se puede cancelar">
                   <i class="bi bi-lock-fill"></i></span>`
            : `<button class="compras-cancelar" type="button" data-cancelar="${c.id_compra}"
                       title="Cancelar esta compra" aria-label="Cancelar compra">
                   <i class="bi bi-x-circle"></i></button>`;

        return `
            <tr>
                <td class="compras-hora">${esc(c.n_hora)}</td>
                <td>${esc(c.n_concepto)}</td>
                <td><span class="compras-chip ${origen.clase}">${esc(origen.texto)}</span>${detalle}</td>
                <td class="compras-monto-celda">${dinero(c.p_monto)}</td>
                <td class="text-end">${accion}</td>
            </tr>`;
    }).join("");
}

function alClicEnCompras(evento) {
    const boton = evento.target.closest("[data-cancelar]");
    if (!boton) return;

    mostrarConfirmacion2(
        "¿Cancelar esta compra? Si salió de caja, también se quita su salida.",
        () => cancelarCompra(boton.dataset.cancelar),
        () => {});
}

async function cancelarCompra(idCompra) {
    const salida = await enviar(`${API}/${idCompra}`, "DELETE");
    if (!salida?.ok) { avisar(salida?.mensaje ?? "No se pudo cancelar la compra.", "advertencia"); return; }

    await cargarCompras();
}

/* ── Plomería ─────────────────────────────────────────────── */
async function pedir(url) {
    try {
        const respuesta = await fetch(url);
        if (!respuesta.ok) throw new Error(respuesta.status);
        return await respuesta.json();
    } catch (error) {
        console.error("compras:", url, error);
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
        console.error("compras:", url, error);
        return { ok: false, mensaje: "No hay conexión con el servidor." };
    }
}

function suma(lista) {
    return lista.reduce((total, c) => total + Number(c.p_monto ?? 0), 0);
}

function dinero(valor) {
    return `$${Number(valor ?? 0).toLocaleString("es-MX", {
        minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function valor(id) {
    return document.getElementById(id).value.trim();
}

function texto(id, contenido) {
    const el = document.getElementById(id);
    if (el) el.textContent = contenido;
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

/** mensajesAlert espera "texto|clase-de-fondo". */
const COLOR_AVISO = {
    error       : "bg-danger",
    advertencia : "bg-warning",
    exito       : "bg-success",
};

function avisar(mensaje, tipo, enfocar) {
    mensajesAlert(`${mensaje}|${COLOR_AVISO[tipo] ?? "bg-secondary"}`);
    if (enfocar) document.getElementById(enfocar)?.focus();
}

init();
