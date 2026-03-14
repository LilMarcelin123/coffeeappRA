/* ============================================================
   GestUser.js — Gestión de Usuarios
   Conecta con: /api/usuarios  y  /api/roles
   Spring Boot REST endpoints esperados:
     GET    /api/usuarios          → lista todos
     GET    /api/roles             → lista roles
     POST   /api/usuarios          → crear
     PUT    /api/usuarios/{id}     → editar
     DELETE /api/usuarios/{id}     → eliminar
   ============================================================ */

const API_USERS = '/api/usuarios';
const API_ROLES = '/api/roles';

// ── Estado global ────────────────────────────────────────────
const state = {
  usuarios:    [],      // todos los usuarios cargados
  roles:       [],      // catálogo de roles
  filtrados:   [],      // resultado de búsqueda/filtro activo
  pagina:      1,
  porPagina:   10,
  modoEdicion: false,
  deleteId:    null,
  deleteNombre: null,
};


// ── Referencias DOM ───────────────────────────────────────────
const $ = id => document.getElementById(id);

const tbody         = $('tbodyUsuarios');
const searchInput   = $('searchInput');
const clearSearch   = $('clearSearch');
const filterRol     = $('filterRol');
const badgeTotal    = $('badgeTotal');
const emptyState    = $('emptyState');
const paginacion    = $('paginacion');

// Modal form
const modalOverlay  = $('modalOverlay');
const modalTitle    = $('modalTitle');
const modalIcon     = $('modalIcon');
const passHint      = $('passHint');
const formUsuario   = $('formUsuario');
const userId        = $('userId');
const inputUsername = $('inputUsername');
const inputEmail    = $('inputEmail');
const inputPassword = $('inputPassword');
const inputRol      = $('inputRol');
const rolPreview    = $('rolPreview');
const rolPreviewDesc= $('rolPreviewDesc');
const eyeIcon       = $('eyeIcon');

// Modal delete
const modalDeleteOverlay = $('modalDeleteOverlay');
const deleteUserName     = $('deleteUserName');

// Toast
const toast    = $('toast');
const toastMsg = $('toastMsg');
let toastTimer;

// ════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  cargarRoles().then(() => cargarUsuarios());
  bindEvents();
});

// ════════════════════════════════════════════════════════════
// API CALLS
// ════════════════════════════════════════════════════════════

async function cargarRoles() {
  try {
    const res = await fetch(API_ROLES);
    if (!res.ok) throw new Error('Error al obtener roles');
    state.roles = await res.json();
  } catch(e) {
    // Fallback mientras el endpoint /api/roles no exista
    state.roles = [
      { ID: 1, Nombre: 'Administrador',             Descripcion: 'Perfil con todos permisos'      },
      { ID: 2, Nombre: 'Operador_Salados',           Descripcion: 'Perfil con permisos limitados'  },
      { ID: 3, Nombre: 'Operador_Crepas_Waffles',    Descripcion: 'Perfil con permisos limitados'  },
      { ID: 4, Nombre: 'Operador_Bebidas_Calientes', Descripcion: 'Perfil con permisos limitados'  },
      { ID: 5, Nombre: 'Operador_Bebidas_Frias',     Descripcion: 'Perfil con permisos limitados'  },
      { ID: 6, Nombre: 'Operador_Fitness',           Descripcion: 'Perfil con permisos limitados'  },
    ];
  }
  poblarSelectRoles();
}

async function cargarUsuarios() {
  setLoading(true);
  try {
    const res = await fetch(API_USERS);
    if (!res.ok) throw new Error('Error al obtener usuarios');
    state.usuarios = await res.json();
    aplicarFiltros();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--red);">
      <i class="fa-solid fa-circle-exclamation"></i> Error al cargar usuarios
    </td></tr>`;
    showToast('No se pudieron cargar los usuarios', 'error');
  }
}

async function crearUsuario(data) {
  // Controller usa @RequestParam → enviar como form params, NO JSON
  var params = new URLSearchParams();
  params.append('username',  data.username);
  params.append('password',  data.password);
  params.append('telefono',  data.telefono);
  params.append('id_rol',    data.id_rol);

  var res = await fetch(API_USERS, { method: 'POST', body: params });
  var json = await res.json().catch(function() { return {}; });
  if (!res.ok) throw new Error(json.mensaje || 'Error al crear usuario');
  return json;
}

async function editarUsuario(id, data) {
  // Controller usa @RequestParam → enviar como form params, NO JSON
  var params = new URLSearchParams();
  params.append('username',  data.username);
  params.append('telefono',  data.telefono);
  params.append('id_rol',    data.id_rol);
  if (data.password) params.append('password', data.password);

  var res = await fetch(API_USERS + '/' + id, { method: 'PUT', body: params });
  var json = await res.json().catch(function() { return {}; });
  if (!res.ok) throw new Error(json.mensaje || 'Error al actualizar usuario');
  return json;
}

async function eliminarUsuario(id) {
  const res = await fetch(`${API_USERS}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar usuario');
}

// ════════════════════════════════════════════════════════════
// RENDER
// ════════════════════════════════════════════════════════════

function renderTabla() {
  const total   = state.filtrados.length;
  const inicio  = (state.pagina - 1) * state.porPagina;
  const fin     = inicio + state.porPagina;
  const pagData = state.filtrados.slice(inicio, fin);

  badgeTotal.textContent = `${total} usuario${total !== 1 ? 's' : ''}`;

  if (total === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    paginacion.innerHTML = '';
    return;
  }

  emptyState.style.display = 'none';

  tbody.innerHTML = pagData.map(function(u) {
    // SP devuelve id_rol + nombre_rol del JOIN con sys_roles_usuario
    var rolId    = u.id_rol || 0;
    var rolLabel = (u.nombre_rol || 'Sin rol').replace(/_/g, ' ');
    var rolClase = rolId === 1 ? 'rol-admin' : 'rol-op';
    var initials = (u.username || '?').slice(0, 2).toUpperCase();
    var corona   = rolId === 1
      ? '<i class="fa-solid fa-crown"></i>'
      : '<i class="fa-solid fa-user"></i>';
    return '<tr data-id="' + u.id + '">' +
      '<td><span class="gu-id">' + u.id + '</span></td>' +
      '<td><span class="gu-username"><span class="gu-avatar">' + initials + '</span>' + esc(u.username) + '</span></td>' +
      '<td><span class="gu-email">' + esc(u.telefono || u.email || '—') + '</span></td>' +
      '<td><span class="gu-rol-badge ' + rolClase + '">' + corona + ' ' + rolLabel + '</span></td>' +
      '<td><div class="gu-actions-cell">' +
        '<button class="gu-action-btn edit" onclick="abrirEditar(' + u.id + ')" title="Editar"><i class="fa-solid fa-pen"></i></button>' +
        '<button class="gu-action-btn delete" onclick="abrirEliminar(' + u.id + ',\'' + esc(u.username) + '\')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>' +
      '</div></td></tr>';
  }).join('');

  renderPaginacion(total);
}

function renderPaginacion(total) {
  const totalPags = Math.ceil(total / state.porPagina);
  if (totalPags <= 1) { paginacion.innerHTML = ''; return; }

  let html = `<button class="gu-page-btn" onclick="irPagina(${state.pagina - 1})"
    ${state.pagina === 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;

  for (let p = 1; p <= totalPags; p++) {
    if (totalPags > 7 && p > 2 && p < totalPags - 1 && Math.abs(p - state.pagina) > 1) {
      if (p === 3 || p === totalPags - 2) html += `<span class="gu-page-btn" style="cursor:default;opacity:.4">…</span>`;
      continue;
    }
    html += `<button class="gu-page-btn ${p === state.pagina ? 'active' : ''}" onclick="irPagina(${p})">${p}</button>`;
  }

  html += `<button class="gu-page-btn" onclick="irPagina(${state.pagina + 1})"
    ${state.pagina === totalPags ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;

  paginacion.innerHTML = html;
}

// ════════════════════════════════════════════════════════════
// FILTROS / BÚSQUEDA
// ════════════════════════════════════════════════════════════

function aplicarFiltros() {
  const txt    = searchInput.value.toLowerCase().trim();
  const rolVal = filterRol.value;

  state.filtrados = state.usuarios.filter(function(u) {
    var rolId     = String(u.id_rol || '');
    var rolNombre = (u.nombre_rol || '').toLowerCase();
    var matchTxt  = !txt
      || (u.username || '').toLowerCase().includes(txt)
      || (u.telefono || u.email || '').toLowerCase().includes(txt)
      || rolNombre.includes(txt);
    var matchRol = !rolVal || rolId === rolVal;
    return matchTxt && matchRol;
  });

  state.pagina = 1;
  renderTabla();
}

function irPagina(p) {
  const total = Math.ceil(state.filtrados.length / state.porPagina);
  if (p < 1 || p > total) return;
  state.pagina = p;
  renderTabla();
}

// ════════════════════════════════════════════════════════════
// MODAL FORM — Abrir / Cerrar
// ════════════════════════════════════════════════════════════

function abrirCrear() {
  state.modoEdicion = false;
  formUsuario.reset();
  clearErrors();
  userId.value = '';
  modalTitle.textContent = 'Nuevo Usuario';
  modalIcon.innerHTML = '<i class="fa-solid fa-user-plus"></i>';
  passHint.style.display = 'none';
  inputPassword.required = true;
  rolPreview.style.display = 'none';
  abrirModal(modalOverlay);
}

function abrirEditar(id) {
  const u = state.usuarios.find(x => x.id === id);
  if (!u) return;

  state.modoEdicion = true;
  clearErrors();
  userId.value          = u.id;
  inputUsername.value   = u.username || '';
  inputEmail.value      = u.telefono || u.email || '';
  inputPassword.value   = '';
  inputPassword.required = false;

  const rolId = String(u.id_rol || u.idrol || u.idrole || '');
  inputRol.value = rolId;
  mostrarDescRol(parseInt(rolId));

  modalTitle.textContent = 'Editar Usuario';
  modalIcon.innerHTML = '<i class="fa-solid fa-user-pen"></i>';
  passHint.style.display = 'inline';
  abrirModal(modalOverlay);
}

function abrirEliminar(id, nombre) {
  state.deleteId     = id;
  state.deleteNombre = nombre;
  deleteUserName.textContent = nombre;
  abrirModal(modalDeleteOverlay);
}

function abrirModal(overlay) {
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function cerrarModales() {
  modalOverlay.classList.remove('active');
  modalDeleteOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

// ════════════════════════════════════════════════════════════
// SUBMIT FORM
// ════════════════════════════════════════════════════════════

formUsuario.addEventListener('submit', async e => {
  e.preventDefault();
  if (!validarForm()) return;

  const data = {
    username: inputUsername.value.trim(),
    telefono: inputEmail.value.trim(),
    id_rol:   parseInt(inputRol.value),
  };
  if (inputPassword.value.trim()) {
    data.password = inputPassword.value.trim();
  }

  const btn = $('btnSubmitModal');
  btn.disabled = true;
  btn.innerHTML = '<span class="gu-spinner"></span> Guardando...';

  try {
    if (state.modoEdicion) {
      await editarUsuario(userId.value, data);
      showToast(`Usuario "${data.username}" actualizado`, 'success');
    } else {
      await crearUsuario(data);
      showToast(`Usuario "${data.username}" creado`, 'success');
    }
    cerrarModales();
    await cargarUsuarios();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar';
  }
});

// Confirmar eliminar
$('btnConfirmDelete').addEventListener('click', async () => {
  const btn = $('btnConfirmDelete');
  btn.disabled = true;
  btn.innerHTML = '<span class="gu-spinner"></span> Eliminando...';
  try {
    await eliminarUsuario(state.deleteId);
    showToast(`Usuario "${state.deleteNombre}" eliminado`, 'success');
    cerrarModales();
    await cargarUsuarios();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-trash"></i> Eliminar';
  }
});

// ════════════════════════════════════════════════════════════
// VALIDACIÓN
// ════════════════════════════════════════════════════════════

function validarForm() {
  clearErrors();
  let ok = true;

  if (!inputUsername.value.trim()) {
    setError('errUsername', 'El usuario es requerido');
    inputUsername.classList.add('invalid');
    ok = false;
  }

  // Validar teléfono — solo dígitos, mínimo 10
  var telVal = inputEmail.value.trim().replace(/\D/g, '');
  if (!telVal || telVal.length < 10) {
    setError('errEmail', 'Ingresa un número válido (mín. 10 dígitos)');
    inputEmail.classList.add('invalid');
    ok = false;
  }

  if (!state.modoEdicion && !inputPassword.value.trim()) {
    setError('errPassword', 'La contraseña es requerida');
    inputPassword.classList.add('invalid');
    ok = false;
  } else if (inputPassword.value && inputPassword.value.length < 6) {
    setError('errPassword', 'Mínimo 6 caracteres');
    inputPassword.classList.add('invalid');
    ok = false;
  }

  if (!inputRol.value) {
    setError('errRol', 'Selecciona un rol');
    inputRol.classList.add('invalid');
    ok = false;
  }

  return ok;
}

function setError(id, msg) { $(id).textContent = msg; }

function clearErrors() {
  ['errUsername','errEmail','errPassword','errRol'].forEach(id => { $(id).textContent = ''; });
  [inputUsername, inputEmail, inputPassword, inputRol].forEach(el => el.classList.remove('invalid'));
}

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

function poblarSelectRoles() {
  // Service Java devuelve: { ID, Nombre, Descripcion }
  filterRol.innerHTML = '<option value="">Todos los roles</option>';
  state.roles.forEach(function(r) {
    var opt = document.createElement('option');
    opt.value = r.ID;
    opt.textContent = r.Nombre.replace(/_/g, ' ');
    filterRol.appendChild(opt);
  });

  inputRol.innerHTML = '<option value="">-- Selecciona un rol --</option>';
  state.roles.forEach(function(r) {
    var opt = document.createElement('option');
    opt.value = r.ID;
    opt.textContent = r.Nombre.replace(/_/g, ' ');
    inputRol.appendChild(opt);
  });
}

function mostrarDescRol(id) {
  var rol = state.roles.find(function(r) { return r.ID === id; });
  if (rol && rol.Descripcion) {
    rolPreviewDesc.textContent = rol.Descripcion;
    rolPreview.style.display = 'flex';
  } else {
    rolPreview.style.display = 'none';
  }
}

function setLoading(on) {
  if (on) {
    tbody.innerHTML = `<tr class="gu-loading-row"><td colspan="5">
      <span class="gu-spinner"></span> Cargando usuarios...
    </td></tr>`;
    emptyState.style.display = 'none';
  }
}

function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, tipo = 'success') {
  clearTimeout(toastTimer);
  toastMsg.textContent = msg;
  toast.className = `gu-toast ${tipo}`;
  // forzar reflow para reiniciar animación
  void toast.offsetWidth;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ════════════════════════════════════════════════════════════
// EVENTOS
// ════════════════════════════════════════════════════════════

function bindEvents() {
  // Búsqueda
  searchInput.addEventListener('input', aplicarFiltros);
  clearSearch.addEventListener('click', () => { searchInput.value = ''; aplicarFiltros(); });

  // Filtro rol
  filterRol.addEventListener('change', aplicarFiltros);

  // Botón nuevo
  $('btnNuevo').addEventListener('click', abrirCrear);

  // Cerrar modales
  $('btnCloseModal').addEventListener('click', cerrarModales);
  $('btnCancelModal').addEventListener('click', cerrarModales);
  $('btnCloseDelete').addEventListener('click', cerrarModales);
  $('btnCancelDelete').addEventListener('click', cerrarModales);

  // Clic fuera del modal
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) cerrarModales(); });
  modalDeleteOverlay.addEventListener('click', e => { if (e.target === modalDeleteOverlay) cerrarModales(); });

  // Toggle password
  $('togglePass').addEventListener('click', () => {
    const isPass = inputPassword.type === 'password';
    inputPassword.type = isPass ? 'text' : 'password';
    eyeIcon.className  = isPass ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  });

  // Preview descripción rol
  inputRol.addEventListener('change', () => {
    mostrarDescRol(parseInt(inputRol.value));
    inputRol.classList.remove('invalid');
    $('errRol').textContent = '';
  });

  // Limpiar errores en tiempo real
  inputUsername.addEventListener('input', () => { inputUsername.classList.remove('invalid'); $('errUsername').textContent=''; });
  inputEmail.addEventListener('input',    () => { inputEmail.classList.remove('invalid');    $('errEmail').textContent='';    });
  inputPassword.addEventListener('input', () => { inputPassword.classList.remove('invalid'); $('errPassword').textContent=''; });

  // ESC cierra
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModales(); });
}

// Exponer al HTML (onclick inline)
window.abrirEditar   = abrirEditar;
window.abrirEliminar = abrirEliminar;
window.irPagina      = irPagina;