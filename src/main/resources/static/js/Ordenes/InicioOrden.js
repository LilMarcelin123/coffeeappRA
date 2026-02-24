/**
 * TomaOrden.js
 * Módulo principal para la toma de órdenes en Rincón Arboledas.
 *
 * Estructura:
 *   1. Imports
 *   2. Constantes y configuración
 *   3. Selectores del DOM
 *   4. Funciones de utilidad
 *   5. Funciones de UI / render
 *   6. Funciones de red (AJAX)
 *   7. Manejadores de eventos
 *   8. Inicialización
 */

// ─────────────────────────────────────────────────────────────
// 1. IMPORTS
// ─────────────────────────────────────────────────────────────
import { mensajesAlert, mostrarConfirmacion } from '../FuncionesGenerales.js';


// ─────────────────────────────────────────────────────────────
// 2. CONSTANTES Y CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────
const ENDPOINTS = {
    productosPorCategoria:    (id) => `/api/productosPorCategoria/${id}`,
    subcategoriaPorCategoria: (id) => `/api/subcategoriaPorCategoria/${id}`,
    opcionesPorSubcategoria:  (id) => `/api/opcionesPorSubcategoria/${id}`,
    resumenOrden:              '/admin/orden/resumen',
    agregarItem:               '/admin/orden/agregarItem',
    eliminarItem:              '/admin/orden/eliminarItem',
    confirmarOrden:            '/admin/orden/gestionar',
    redireccionInicio:         '/admin/inicio',
};

const TEXTO_RESUMEN_VACIO = `
    <div class="resumen-empty">
        <i class="bi bi-bag"></i>
        Sin productos aún
    </div>`;

const TOTAL_VACIO = '$0.00';


// ─────────────────────────────────────────────────────────────
// 3. SELECTORES DEL DOM
// ─────────────────────────────────────────────────────────────
const $selectCategoria           = () => $('#selectCategoria');
const $selectProducto            = () => $('#selectProducto');
const $contenedorProductos       = () => $('#contenedorProductos');
const $contenedorSubcategoria    = () => $('#contenedorSubcategoria');
const $contenedorOpcionesExtras  = () => $('#contenedorOpcionesExtras');
const $contenedorResumenOrden    = () => $('#contenedorResumenOrden');
const $cantidadProducto          = () => $('#cantidadProducto');
const $comentarioProducto        = () => $('#comentarioProducto');
const $wrapCantidad              = () => $('#wrapCantidad');
const $wrapComentario            = () => $('#wrapComentario');
const $btnAñadeItem              = () => $('#btnAñadeItem');
const $btnConfirmaOrden          = () => $('#btnConfirmaOrden');
const $totalOrdenVista           = () => $('#totalOrdenVista');
const $idOrden                   = () => $('#idOrden');
const $tplResumenItem            = () => document.getElementById('tplResumenItem');


// ─────────────────────────────────────────────────────────────
// 4. FUNCIONES DE UTILIDAD
// ─────────────────────────────────────────────────────────────

/**
 * Formatea un número como moneda con prefijo $.
 * @param {number} valor
 * @returns {string}
 */
function formatearMoneda(valor) {
    return `$${Number(valor).toFixed(2)}`;
}

/**
 * Obtiene los extras seleccionados como array de objetos.
 * @returns {{ id_extra: number, cantidad: number }[]}
 */
function obtenerExtrasSeleccionados() {
    const extras = [];

    $('.extra-checkbox:checked').each(function () {
        const idExtra  = parseInt($(this).val(), 10);
        const cantidad = parseInt($(`#cantidadExtra_${idExtra}`).val() || 1, 10);
        extras.push({ id_extra: idExtra, cantidad });
    });

    return extras;
}

/**
 * Valida que haya producto y cantidad válida antes de agregar.
 * @returns {boolean}
 */
function validarItemParaAgregar() {
    const idProducto = $selectProducto().val();
    const cantidad   = parseInt($cantidadProducto().val(), 10);

    if (!idProducto || !cantidad || cantidad < 1) {
        alert('Selecciona un producto e ingresa una cantidad válida.');
        return false;
    }

    return true;
}


// ─────────────────────────────────────────────────────────────
// 5. FUNCIONES DE UI / RENDER
// ─────────────────────────────────────────────────────────────

/**
 * Muestra los campos de cantidad, comentario y botón de añadir.
 */
function mostrarCamposCaptura() {
    $wrapCantidad().show();
    $wrapComentario().show();
    $cantidadProducto().val('').prop('disabled', false);
    $comentarioProducto().val('');
    $btnAñadeItem().show();
}

/**
 * Oculta y limpia los campos de captura.
 */
function ocultarCamposCaptura() {
    $wrapCantidad().hide();
    $wrapComentario().hide();
    $cantidadProducto().val('');
    $comentarioProducto().val('');
    $btnAñadeItem().hide();
}

/**
 * Limpia todos los campos de selección y captura
 * al terminar de agregar un ítem.
 */
function limpiarFormulario() {
    $selectCategoria().val('');
    $contenedorProductos().html('');
    $contenedorSubcategoria().html('');
    $contenedorOpcionesExtras().html('');
    ocultarCamposCaptura();
}

/**
 * Renderiza el HTML del selector de productos.
 * @param {{ id: number, nombre: string }[]} productos
 * @returns {string}
 */
function buildHTMLSelectorProductos(productos) {
    const opciones = productos
        .map(p => `<option value="${p.id}">${p.nombre}</option>`)
        .join('');

    return `
        <div class="mb-3">
            <label class="form-label-custom">
                <i class="bi bi-box me-1"></i> Producto
            </label>
            <select id="selectProducto" class="form-select">
                <option value="">Seleccione un producto</option>
                ${opciones}
            </select>
        </div>`;
}

/**
 * Renderiza el HTML del bloque de extras opcionales.
 * @param {{ id: number, nombre: string, precio: number }[]} opciones
 * @returns {string}
 */
function buildHTMLExtras(opciones) {
    const filas = opciones.map(o => `
        <div class="extra-row">
            <div class="form-check mb-0">
                <input class="form-check-input extra-checkbox"
                       type="checkbox"
                       value="${o.id}"
                       id="extra_${o.id}">
                <label class="form-check-label" for="extra_${o.id}" style="font-size:.88rem;">
                    ${o.nombre}
                    <span style="color:var(--cafe-mid); font-weight:700;">
                        +${formatearMoneda(o.precio)}
                    </span>
                </label>
            </div>
            <input type="number"
                   class="form-control form-control-sm extra-qty"
                   id="cantidadExtra_${o.id}"
                   min="1" max="10" value="1"
                   style="width:70px;"
                   disabled>
        </div>`).join('');

    return `
        <div class="extras-wrap mt-3">
            <div class="form-label-custom mb-2">
                <i class="bi bi-plus-circle me-1"></i> Extras opcionales
            </div>
            ${filas}
        </div>`;
}

/**
 * Construye y añade un nodo de ítem al resumen usando el template.
 * @param {Object} item
 * @param {HTMLElement} contenedor
 */
function appendResumenItem(item, contenedor) {
    const {
        cantidad    = 0,
        producto    = '',
        extras      = '',
        comentario  = '',
        total_item  = 0,
        id_orden_item,
    } = item;

    const node      = $tplResumenItem().content.cloneNode(true);
    const extrasEl  = node.querySelector('.extras');

    node.querySelector('.cantidad').textContent   = `${cantidad}x`;
    node.querySelector('.producto').textContent   = String(producto);
    node.querySelector('.total-item').textContent = formatearMoneda(total_item);

    const extrasTxt   = String(extras).trim();
    const comentTxt   = String(comentario).trim();
    let   extrasLabel = '';

    if (extrasTxt)  extrasLabel += extrasTxt;
    if (comentTxt)  extrasLabel += (extrasLabel ? ' · ' : '') + `Nota: ${comentTxt}`;

    if (extrasLabel) {
        extrasEl.style.display = 'block';
        extrasEl.textContent   = extrasLabel;
    }

    node.querySelector('.btn-eliminar-item')
        .addEventListener('click', () => eliminarItem(id_orden_item));

    contenedor.appendChild(node);
}

/**
 * Renderiza la lista completa del resumen de orden.
 * @param {Object[]} lista
 */
function renderResumenOrden(lista) {
    const contenedor = $contenedorResumenOrden()[0];
    contenedor.innerHTML = '';

    if (!lista || lista.length === 0) {
        contenedor.innerHTML = TEXTO_RESUMEN_VACIO;
        $totalOrdenVista().text(TOTAL_VACIO);
        return;
    }

    let total = 0;

    lista.forEach(item => {
        total += Number(item.total_item || 0);
        appendResumenItem(item, contenedor);
    });

    $totalOrdenVista().text(formatearMoneda(total));
}


// ─────────────────────────────────────────────────────────────
// 6. FUNCIONES DE RED (AJAX)
// ─────────────────────────────────────────────────────────────

/**
 * Carga el resumen de la orden desde el servidor y lo renderiza.
 */
function cargarResumenOrden() {
    const idOrden = $idOrden().val();

    $.ajax({
        url:     ENDPOINTS.resumenOrden,
        type:    'GET',
        data:    { idOrden },
        success: function (lista) {
            renderResumenOrden(lista);

            if (lista && lista.length > 0) {
                $btnConfirmaOrden().prop('disabled', false).show();
            }
        },
        error: function (xhr) {
            console.error('Error al cargar el resumen:', xhr.responseText);
        },
    });
}

/**
 * Elimina un ítem de la orden y recarga el resumen.
 * @param {number} idOrdenItem
 */
function eliminarItem(idOrdenItem) {
    $.ajax({
        url:     ENDPOINTS.eliminarItem,
        type:    'POST',
        data:    { idOrdenItem },
        success: function () {
            cargarResumenOrden();
        },
        error: function (xhr) {
            console.error('Error eliminando item:', xhr.responseText);
            alert('No se pudo eliminar el producto.');
        },
    });
}

/**
 * Agrega el ítem seleccionado a la orden activa.
 */
function agregarItemOrden() {
    if (!validarItemParaAgregar()) return;

    const payload = {
        idOrden:          $idOrden().val(),
        idProducto:       $selectProducto().val(),
        cantidadProducto: $cantidadProducto().val(),
        listaExtrasJson:  JSON.stringify(obtenerExtrasSeleccionados()),
        comentario:       $comentarioProducto().val() || '',
    };

    $.ajax({
        url:     ENDPOINTS.agregarItem,
        type:    'POST',
        data:    payload,
        success: function (data) {
            console.log('Item agregado:', data);
            limpiarFormulario();
            $btnConfirmaOrden().prop('disabled', false).show();
            cargarResumenOrden();
        },
        error: function (xhr) {
            console.error('Error al agregar item:', xhr.responseText);
            alert('No se pudo agregar el producto a la orden.');
        },
    });
}

/**
 * Confirma y envía la orden a cocina.
 */
function confirmarOrden() {
    const payload = {
        idOrden:     $idOrden().val(),
        tipoProceso: 2,
        idRol:       1,
    };

    $.ajax({
        url:     ENDPOINTS.confirmarOrden,
        type:    'POST',
        data:    payload,
        success: function (resp) {
            console.log('Preparaciones generadas:', resp.filas);
            window.location.href = ENDPOINTS.redireccionInicio;
        },
        error: function (xhr) {
            console.error('Error confirmando orden:', xhr.responseText);
        },
    });
}

/**
 * Carga los productos disponibles para una categoría.
 * @param {number|string} idCategoria
 */
function cargarProductosPorCategoria(idCategoria) {
    $.ajax({
        url:     ENDPOINTS.productosPorCategoria(idCategoria),
        method:  'GET',
        success: function (data) {
            if (!data || data.length === 0) {
                $contenedorProductos().html(
                    "<p class='text-muted mt-2' style='font-size:.85rem'>Sin productos en esta categoría.</p>"
                );
                return;
            }
            $contenedorProductos().html(buildHTMLSelectorProductos(data));
        },
    });
}

/**
 * Carga la subcategoría y sus extras para una categoría.
 * @param {number|string} idCategoria
 */
function cargarSubcategoriaYExtras(idCategoria) {
    $.ajax({
        url:     ENDPOINTS.subcategoriaPorCategoria(idCategoria),
        method:  'GET',
        success: function (data) {
            if (!data || !data.id) {
                $contenedorSubcategoria().html('');
                $contenedorOpcionesExtras().html('');
                return;
            }

            $contenedorSubcategoria().html(
                `<input type="hidden" id="subcategoriaHidden" value="${data.id}">`
            );

            cargarOpcionesExtras(data.id);
        },
    });
}

/**
 * Carga los extras opcionales de una subcategoría.
 * @param {number|string} idSubcategoria
 */
function cargarOpcionesExtras(idSubcategoria) {
    $.ajax({
        url:     ENDPOINTS.opcionesPorSubcategoria(idSubcategoria),
        method:  'GET',
        success: function (data) {
            if (!data || data.length === 0) {
                $contenedorOpcionesExtras().html(
                    "<p class='text-muted mt-2' style='font-size:.85rem'>Sin extras disponibles.</p>"
                );
                return;
            }
            $contenedorOpcionesExtras().html(buildHTMLExtras(data));
        },
        error: function () {
            $contenedorOpcionesExtras().html(
                "<p class='text-danger mt-2' style='font-size:.85rem'>Error cargando extras.</p>"
            );
        },
    });
}


// ─────────────────────────────────────────────────────────────
// 7. MANEJADORES DE EVENTOS
// ─────────────────────────────────────────────────────────────

/**
 * Registra todos los listeners de la página.
 */
function registrarEventos() {

    // Cambio de categoría
    $(document).on('change', '#selectCategoria', function () {
        ocultarCamposCaptura();
        $contenedorProductos().html('');
        $contenedorSubcategoria().html('');
        $contenedorOpcionesExtras().html('');

        const idCategoria = $(this).val();
        if (!idCategoria) return;

        cargarProductosPorCategoria(idCategoria);
        cargarSubcategoriaYExtras(idCategoria);
    });

    // Selección de producto → mostrar campos de captura
    $(document).on('change', '#selectProducto', function () {
        $(this).val() ? mostrarCamposCaptura() : ocultarCamposCaptura();
    });

    // Toggle cantidad de extra al marcar/desmarcar checkbox
    $(document).on('change', '.extra-checkbox', function () {
        const id = $(this).val();
        $(`#cantidadExtra_${id}`).prop('disabled', !this.checked);
        if (!this.checked) $(`#cantidadExtra_${id}`).val(1);
    });

    // Añadir ítem a la orden
    $btnAñadeItem().on('click', agregarItemOrden);

    // Confirmar orden con modal de confirmación
    $btnConfirmaOrden().on('click', function () {
        mostrarConfirmacion(
            '¿Confirmas el envío de la orden a cocina?',
            confirmarOrden,
            () => console.log('Envío cancelado por el usuario.')
        );
    });
}


// ─────────────────────────────────────────────────────────────
// 8. INICIALIZACIÓN
// ─────────────────────────────────────────────────────────────

$(document).ready(function () {
    ocultarCamposCaptura();
    $btnConfirmaOrden().prop('disabled', true).hide();

    cargarResumenOrden();
    registrarEventos();
});