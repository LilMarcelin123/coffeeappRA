// ================================================================
// login.js
// Inicio de sesion — El Rincon en las Arboledas
//
// Antes era un <script> dentro de la plantilla. Hace dos cosas:
// mostrar la contrasena y retirar los avisos pasados unos segundos.
// ================================================================

const SEGUNDOS_AVISO = 4;

// ── Ver la contrasena ────────────────────────────────────────────
const ojo   = document.getElementById('verPassword');
const campo = document.getElementById('password');

if (ojo && campo) {
    ojo.addEventListener('click', () => {
        const oculta = campo.type === 'password';
        campo.type = oculta ? 'text' : 'password';

        ojo.querySelector('i').className = oculta ? 'bi bi-eye-slash' : 'bi bi-eye';
        ojo.setAttribute('aria-label', oculta ? 'Ocultar contraseña' : 'Mostrar contraseña');

        // Devolver el cursor al campo: si no, hay que volver a picarlo
        campo.focus();
    });
}

// ── Retirar avisos ───────────────────────────────────────────────
// Se desvanecen y despues se quitan del documento, para que no
// queden ocupando lugar ni los lea un lector de pantalla.
document.querySelectorAll('.aviso').forEach(aviso => {
    setTimeout(() => {
        aviso.classList.add('se-va');
        aviso.addEventListener('transitionend', () => aviso.remove(), { once: true });
    }, SEGUNDOS_AVISO * 1000);
});
