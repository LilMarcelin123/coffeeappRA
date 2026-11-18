/* ================================================================
   PersonajesOrden.js — personaje de temporada por orden
   El Rincon en las Arboledas

   Complemento visual del numero de orden, NUNCA su reemplazo: el
   folio sigue siendo el dato oficial y se pinta igual que siempre.
   El personaje solo ayuda a reconocer una orden de un vistazo
   ("¿ya salio la del reno?") cuando hay varias en cola.

   Una sola regla para Administracion y Cocina, sin guardar nada en
   la base: el personaje sale del folio del dia y del tema que pone
   TemporadaAdvice en <body data-tema>.

       personaje = lista[(folio - 1) mod 12]

   Folio 1 = Santa, 2 = reno ... 12 = angelito, 13 = Santa otra vez.
   Fuera de temporada (o tema sin set) no se pinta nada.

   Script clasico: queda en window.PersonajeOrden para que lo usen
   tanto TomaOrden.js (modulo) como OperadorPantalla.js (clasico).
   ================================================================ */
(function () {
    "use strict";

    const SETS = {
        navidad: {
            carpeta: "/img/personajes/navidad/",
            lista: [
                ["01-santa",        "Santa"],
                ["02-reno",         "Reno"],
                ["03-muneco-nieve", "Muñeco de nieve"],
                ["04-pinguino",     "Pingüino"],
                ["05-duende",       "Duende"],
                ["06-galleta",      "Galleta"],
                ["07-oso-polar",    "Oso polar"],
                ["08-pinata",       "Piñata"],
                ["09-borreguito",   "Borreguito"],
                ["10-estrella",     "Estrella"],
                ["11-arbolito",     "Arbolito"],
                ["12-angelito",     "Angelito"]
            ]
        }
    };

    function temaActual() {
        return (document.body && document.body.dataset.tema) || "ninguna";
    }

    /** { src, nombre } para un folio, o null si no aplica. */
    function para(folio) {
        const set = SETS[temaActual()];
        const n   = Number(folio);
        if (!set || !Number.isInteger(n) || n < 1) return null;

        const total = set.lista.length;
        const [archivo, nombre] = set.lista[(n - 1) % total];
        return { src: set.carpeta + archivo + ".webp", nombre: nombre };
    }

    /**
     * Pone, cambia o quita el personaje dentro de `contenedor`.
     * Con `ancla` se coloca justo despues de ese elemento (el numero),
     * para que nada se meta entre el folio y su personaje.
     */
    function pintar(contenedor, folio, variante, ancla) {
        if (!contenedor) return;
        const p = para(folio);
        let img = contenedor.querySelector(".personaje-orden");

        if (!p) { if (img) img.remove(); return; }

        if (!img) {
            img = document.createElement("img");
            img.className = "personaje-orden" + (variante ? " personaje-orden--" + variante : "");
            img.alt = "";                       // decorativo: el numero es el dato
            img.setAttribute("aria-hidden", "true");
            img.decoding = "async";
            img.width = 64; img.height = 64;    // reserva espacio, el CSS da el tamaño
            contenedor.appendChild(img);
        }
        // Siempre pegado al numero, aunque otros elementos se inserten despues
        if (ancla && ancla.parentNode === contenedor && img.previousElementSibling !== ancla) {
            ancla.after(img);
        }
        if (img.getAttribute("src") !== p.src) img.src = p.src;
        img.title = p.nombre;
    }

    window.PersonajeOrden = { para: para, pintar: pintar };
})();
