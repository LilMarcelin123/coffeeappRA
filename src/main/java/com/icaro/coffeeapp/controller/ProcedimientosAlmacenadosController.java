package com.icaro.coffeeapp.controller;

import java.io.IOException;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.math.BigDecimal;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import com.icaro.coffeeapp.service.ExcelService;
import com.icaro.coffeeapp.service.ProcedimientosAlmacenados;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@Controller
@Slf4j
public class ProcedimientosAlmacenadosController {
	
	@Autowired
	ObjectMapper objectMapper;
	
	@Autowired
	ProcedimientosAlmacenados procedimientosAlmacenados;
	
	@Autowired
	ExcelService excelService;

	@GetMapping("/procesoInicialOrden")
	public void procesoInicialOrden(HttpServletRequest request, HttpServletResponse response) throws IOException {

	    Integer tipoProceso = Integer.parseInt(request.getParameter("tipoProceso"));

	    Integer idOrden = procedimientosAlmacenados.spIniciaOrdenInt(tipoProceso);

	    response.setContentType("application/json");
	    response.setCharacterEncoding("UTF-8");

	    try (OutputStream out = response.getOutputStream()) {
	        objectMapper.writeValue(out, 
	            Map.of("idOrden", idOrden)
	        );
	        out.flush();
	    }
	}
	
	
	@PostMapping("/admin/orden/agregarItem")
	@ResponseBody
	public Map<String, Object> agregarItem(
	        @RequestParam("idOrden") Integer idOrden,
	        @RequestParam("idProducto") Integer idProducto,
	        @RequestParam("cantidadProducto") Integer cantidadProducto,
	        @RequestParam("listaExtrasJson") String listaExtrasJson,
	        @RequestParam(value = "comentario", required = false) String comentario) {

	    Integer idItem = procedimientosAlmacenados.spAgregarItemConExtras(
	            idOrden, idProducto, cantidadProducto, listaExtrasJson, comentario
	    );

	    Map<String, Object> response = new HashMap<>();
	    response.put("idItem",  idItem);
	    response.put("mensaje", idItem != null ? "Item agregado correctamente" : "Error al agregar item");
	    return response;
	}
	
	
	

	@PostMapping("/admin/orden/gestionar")
	@ResponseBody
	public Map<String, Object> gestionarOrden(
	        @RequestParam("idOrden") Integer idOrden,
	        @RequestParam("tipoProceso") Integer tipoProceso,
	        @RequestParam(value = "idRol", required = false) Integer idRol,
	        @RequestParam(value = "pTipoPago", required = false) Integer pTipoPago
	) {
	    Integer filas = procedimientosAlmacenados.spGestionarOrden(idOrden, tipoProceso, idRol, pTipoPago);

	    Map<String, Object> response = new HashMap<>();
	    response.put("filas", filas);
	    response.put("idOrden", idOrden);
	    response.put("tipoProceso", tipoProceso);
	    response.put("pTipoPago", pTipoPago);

	    return response;
	}


	
	@GetMapping("/admin/orden/resumen")
	@ResponseBody
	public List<Map<String, Object>> resumenOrden(@RequestParam("idOrden") Integer idOrden) {
	    return procedimientosAlmacenados.spResumenOrden(idOrden);
	}
	
	
	// ── Guardar nombre del cliente en la orden ────────────────────
	@PostMapping("/admin/orden/nombreCliente")
	@ResponseBody
	public ResponseEntity<Map<String, Object>> guardarNombreCliente(
	        @RequestParam("idOrden")       Integer idOrden,
	        @RequestParam(value = "nombreCliente", required = false) String nombreCliente) {

	    procedimientosAlmacenados.spGuardarNombreCliente(idOrden, nombreCliente);
	    return ResponseEntity.ok(Map.of("ok", true));
	}
	
	

	@GetMapping("/admin/orden/pendientes")
	@ResponseBody
	public List<Map<String, Object>> getOrdenesPendientes() {
	    // Para listar pendientes no se necesita pTipoPago
	    return procedimientosAlmacenados.spGestionarOrdenSelect(null, 4, null, null);
	}
	
	
	@PostMapping("/admin/orden/eliminarItem")
	@ResponseBody
	public Map<String, Object> eliminarItem(
	        @RequestParam("idOrdenItem") Integer idOrdenItem) {

	    Integer filas = procedimientosAlmacenados.spEliminarItem(idOrdenItem);

	    Map<String, Object> response = new HashMap<>();
	    response.put("filas", filas);
	    response.put("idOrdenItem", idOrdenItem);
	    return response;
	}
	
	
	
	@GetMapping("/admin/catalogo/vistaRoles")
	@ResponseBody
	public List<Map<String, Object>> vistaRoles() {
	    return procedimientosAlmacenados.obtenerRoles();
	}

	@PostMapping("/admin/catalogo/gestionar")
	@ResponseBody
	public Map<String, Object> gestionarCatalogo(
	        @RequestParam Integer tipoProceso,
	        @RequestParam(required = false) String nombre,
	        @RequestParam(required = false) Double precio,
	        @RequestParam(required = false) String descripcion,
	        @RequestParam(required = false) Integer rol,
	        @RequestParam(required = false) Integer id
	) {
	    java.math.BigDecimal bdPrecio = (precio == null) ? null : java.math.BigDecimal.valueOf(precio);

	    int filas = procedimientosAlmacenados.spGestionCatalogo(
	            tipoProceso,
	            nombre,
	            bdPrecio,
	            descripcion,
	            rol,
	            id
	    );

	    return Map.of(
	            "ok", filas != -1,
	            "filas", filas,
	            "tipoProceso", tipoProceso,
	            "id", id == null ? 0 : id
	    );
	}

	@GetMapping("/admin/catalogo/vista")
	@ResponseBody
	public List<Map<String, Object>> obtenerVistaCatalogo(
	        @RequestParam("tipoProceso") Integer tipoProceso
	) {
	    return procedimientosAlmacenados.spVistaCatalogos(tipoProceso);
	}
	
	

	    @GetMapping("/admin/reportes")
	    public String vistaReportes(Model model, HttpSession session) {
	        model.addAttribute("nombreUsuario", session.getAttribute("nombreUsuario"));
	        model.addAttribute("nombreNegocio", session.getAttribute("nombreNegocio"));
	        return "admin/reportes";   // → templates/admin/reportes.html
	    }


	    @GetMapping("/admin/reportes/detalle")
	    @ResponseBody
	    public List<Map<String, Object>> detalleOrdenes(
	            @RequestParam(value = "idTipoPago", required = false) Integer idTipoPago) {

	        return procedimientosAlmacenados.spReportes(1, idTipoPago);
	    }

	   
	    @GetMapping("/admin/reportes/corte")
	    @ResponseBody
	    public List<Map<String, Object>> corteOrdenes() {
	        return procedimientosAlmacenados.spReportes(2, null);
	    }

	   

	    @GetMapping("/admin/reportes/excel")
	    public ResponseEntity<byte[]> descargarExcel(
	            @RequestParam(value = "idTipoPago", required = false) Integer idTipoPago) {

	        try {
	            List<Map<String, Object>> datos = procedimientosAlmacenados.spReportes(1, idTipoPago);
	            byte[] archivo = excelService.generarExcelDetalle(datos);

	            String nombreArchivo = "detalle_ordenes_" + java.time.LocalDate.now() + ".xlsx";

	            return ResponseEntity.ok()
	                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + nombreArchivo + "\"")
	                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
	                    .body(archivo);

	        } catch (Exception e) {
	            e.printStackTrace();
	            return ResponseEntity.internalServerError().build();
	        }
	    }
	    
	    
	    
	    
	    
	    
	 // ── Vista panel operador ──────────────────────────────────
	    @GetMapping("/operador/inicio")
	    public String vistaOperador(Model model, HttpSession session) {
	        if (session.getAttribute("nombreUsuario") == null) {
	            return "redirect:/login";
	        }
	        model.addAttribute("nombreUsuario", session.getAttribute("nombreUsuario"));
	        model.addAttribute("nombreNegocio", session.getAttribute("nombreNegocio"));
	        model.addAttribute("rolNombre",     session.getAttribute("rolNombre"));
	        return "operador/inicio";
	    }

	    // ── AJAX: órdenes + ítems por rol (proceso 7) ────────────
	    @GetMapping("/operador/ordenes")
	    @ResponseBody
	    public ResponseEntity<Map<String, List<Map<String, Object>>>> ordenesOperador(
	            HttpSession session) {

	        if (session.getAttribute("nombreUsuario") == null) {
	            return ResponseEntity.status(401).build();
	        }

	        Integer idRol = (Integer) session.getAttribute("idRol");

	        Map<String, List<Map<String, Object>>> data =
	                procedimientosAlmacenados.spOperadorOrdenes(idRol);

	        return ResponseEntity.ok(data);
	    }
	    
	  
	    
	    
	    
	    
	    
	    
	    
	    
	    
	    
	    
	    
	 // ════════════════════════════════════════════════════════════════════════════
	//  PEGAR ESTOS MÉTODOS DENTRO DE LA CLASE ProcedimientosAlmacenadosController
	//  Agregar estos imports al inicio del archivo si no los tienes:
//	    import org.springframework.web.bind.annotation.*;
//	    import org.springframework.http.HttpStatus;
	// ════════════════════════════════════════════════════════════════════════════


	    // ═════════════════════════════════════════════════════════════════════════
	    //  GESTIÓN DE USUARIOS
	    // ═════════════════════════════════════════════════════════════════════════

	    // ── Vista HTML ────────────────────────────────────────────────────────────
	    @GetMapping("/admin/usuarios")
	    public String vistaGestionUsuarios(Model model, HttpSession session) {
	        if (session.getAttribute("nombreUsuario") == null) return "redirect:/login";
	        model.addAttribute("nombreUsuario", session.getAttribute("nombreUsuario"));
	        model.addAttribute("nombreNegocio", session.getAttribute("nombreNegocio"));
	        return "admin/GestionUsuarios";   // → templates/admin/GestionUsuarios.html
	    }


	    // ── GET /api/usuarios  →  lista todos ─────────────────────────────────────
	    @GetMapping("/api/usuarios")
	    @ResponseBody
	    public ResponseEntity<List<Map<String, Object>>> listarUsuarios() {
	        List<Map<String, Object>> lista = procedimientosAlmacenados.spListarUsuarios();
	        return ResponseEntity.ok(lista);
	    }


	    // ── GET /api/usuarios/{id}  →  obtener uno (sin password) ────────────────
	    @GetMapping("/api/usuarios/{id}")
	    @ResponseBody
	    public ResponseEntity<Map<String, Object>> obtenerUsuario(
	            @PathVariable("id") Integer id) {

	        Map<String, Object> usuario = procedimientosAlmacenados.spObtenerUsuarioPorId(id);

	        if (usuario == null) {
	            return ResponseEntity.status(HttpStatus.NOT_FOUND)
	                    .body(Map.of("mensaje", "Usuario no encontrado"));
	        }
	        return ResponseEntity.ok(usuario);
	    }


	    // ── POST /api/usuarios  →  crear ──────────────────────────────────────────
	    @PostMapping("/api/usuarios")
	    @ResponseBody
	    public ResponseEntity<Map<String, Object>> crearUsuario(
	            @RequestParam("username")  String  username,
	            @RequestParam("password")  String  password,
	            @RequestParam("telefono")  String  telefono,
	            @RequestParam("id_rol")    Integer idRol) {

	        Map<String, Object> respuesta = procedimientosAlmacenados
	                .spCrearUsuario(username, password, telefono, idRol);

	        int resultado = (int) respuesta.get("resultado");

	        if (resultado == 0) {
	            return ResponseEntity.status(HttpStatus.CREATED).body(respuesta);
	        } else if (resultado == 1 || resultado == 2) {
	            // username o email duplicado → 409 Conflict
	            return ResponseEntity.status(HttpStatus.CONFLICT).body(respuesta);
	        } else {
	            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(respuesta);
	        }
	    }


	    // ── PUT /api/usuarios/{id}  →  editar ────────────────────────────────────
	    @PutMapping("/api/usuarios/{id}")
	    @ResponseBody
	    public ResponseEntity<Map<String, Object>> editarUsuario(
	            @PathVariable("id")                          Integer id,
	            @RequestParam("username")                    String  username,
	            @RequestParam(value = "password", required = false) String  password,
	            @RequestParam("telefono")                    String  telefono,
	            @RequestParam("id_rol")                      Integer idRol) {

	        Map<String, Object> respuesta = procedimientosAlmacenados
	                .spEditarUsuario(id, username, password, telefono, idRol);

	        int resultado = (int) respuesta.get("resultado");

	        if (resultado == 0) {
	            return ResponseEntity.ok(respuesta);
	        } else if (resultado == 1 || resultado == 2) {
	            return ResponseEntity.status(HttpStatus.CONFLICT).body(respuesta);
	        } else {
	            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(respuesta);
	        }
	    }


	    // ── DELETE /api/usuarios/{id}  →  eliminar ────────────────────────────────
	    @DeleteMapping("/api/usuarios/{id}")
	    @ResponseBody
	    public ResponseEntity<Map<String, Object>> eliminarUsuario(
	            @PathVariable("id") Integer id) {

	        Map<String, Object> respuesta = procedimientosAlmacenados.spEliminarUsuario(id);
	        int resultado = (int) respuesta.get("resultado");

	        if (resultado == 0) {
	            return ResponseEntity.ok(respuesta);
	        } else if (resultado == 3) {
	            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(respuesta);
	        } else {
	            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(respuesta);
	        }
	    }


	    // ── GET /api/roles  →  catálogo de roles ─────────────────────────────────
	    //  (el JS del frontend lo llama para poblar el <select>)
	    @GetMapping("/api/roles")
	    @ResponseBody
	    public ResponseEntity<List<Map<String, Object>>> listarRoles() {
	        List<Map<String, Object>> roles = procedimientosAlmacenados.obtenerRoles();
	        return ResponseEntity.ok(roles);
	    }


	    // ── GET /api/usuarios/verificar-username  →  disponibilidad ──────────────
	    //  Uso desde JS: /api/usuarios/verificar-username?username=jgarcia&idExcluir=0
	    @GetMapping("/api/usuarios/verificar-username")
	    @ResponseBody
	    public ResponseEntity<Map<String, Object>> verificarUsername(
	            @RequestParam("username")              String  username,
	            @RequestParam(value = "idExcluir", defaultValue = "0") Integer idExcluir) {

	        boolean disponible = procedimientosAlmacenados.spVerificarUsername(username, idExcluir);
	        return ResponseEntity.ok(Map.of("disponible", disponible));
	    }
	    
	    
	    
	 // ════════════════════════════════════════════════════════════════════════════
	//  AGREGAR A ProcedimientosAlmacenadosController.java
	// ════════════════════════════════════════════════════════════════════════════

	    // ─────────────────────────────────────────────────────────────────────────
	    // POST /api/acceso-modulo
	    // Valida la contraseña maestra antes de entrar a un módulo protegido.
	    // El frontend envía: password + modulo (nombre del módulo para el log)
	    // Spring responde:   { acceso: true/false, redirect: "/ruta" }
	    //
	    // Bloqueo por intentos: se guarda en HttpSession para no necesitar BD.
	    //   - Máximo 3 intentos fallidos → bloqueo 5 minutos
	    // ─────────────────────────────────────────────────────────────────────────
	    @PostMapping("/api/acceso-modulo")
	    @ResponseBody
	    public ResponseEntity<Map<String, Object>> validarAccesoModulo(
	            @RequestParam("password") String password,
	            @RequestParam("modulo")   String modulo,
	            HttpSession session) {

	        // ── Verificar bloqueo por intentos fallidos ──────────────────────────
	        Integer intentosFallidos = (Integer) session.getAttribute("accesoIntentos");
	        Long    bloqueadoHasta   = (Long)    session.getAttribute("accesoBloqueadoHasta");

	        if (bloqueadoHasta != null && System.currentTimeMillis() < bloqueadoHasta) {
	            long segundosRestantes = (bloqueadoHasta - System.currentTimeMillis()) / 1000;
	            return ResponseEntity.status(429).body(Map.of(
	                "acceso",  false,
	                "mensaje", "Demasiados intentos. Espera " + segundosRestantes + " segundos.",
	                "bloqueado", true
	            ));
	        }

	        // ── Validar contraseña contra BD ─────────────────────────────────────
	        boolean accesoCorrecto = procedimientosAlmacenados.spValidarAccesoModulo(password);

	        if (accesoCorrecto) {
	            // Limpiar contadores de intentos
	            session.removeAttribute("accesoIntentos");
	            session.removeAttribute("accesoBloqueadoHasta");

	            // Determinar ruta de redirección según módulo
	            String redirect = switch (modulo.toLowerCase()) {
	            case "usuarios"     -> "/admin/GestionUsuarios";
	            case "reportes"     -> "/admin/GeneracionReportes";
	            case "salida_stock" -> "";
	            default             -> "/admin/inicio";
	        };

	            System.out.println(">>> Acceso a modulo [" + modulo + "] por usuario: " + session.getAttribute("nombreUsuario"));

	            return ResponseEntity.ok(Map.of(
	                "acceso",   true,
	                "redirect", redirect,
	                "mensaje",  "Acceso concedido"
	            ));

	        } else {
	            // Incrementar contador de intentos fallidos
	            int intentos = (intentosFallidos == null ? 0 : intentosFallidos) + 1;
	            session.setAttribute("accesoIntentos", intentos);

	            if (intentos >= 3) {
	                // Bloquear 5 minutos
	                long bloqueo = System.currentTimeMillis() + (5 * 60 * 1000L);
	                session.setAttribute("accesoBloqueadoHasta", bloqueo);
	                session.removeAttribute("accesoIntentos");

	                System.out.println(">>> BLOQUEO acceso modulos. Usuario: " + session.getAttribute("nombreUsuario") + " - 3 intentos fallidos");

	                return ResponseEntity.status(429).body(Map.of(
	                    "acceso",    false,
	                    "mensaje",   "Demasiados intentos. Bloqueado por 5 minutos.",
	                    "bloqueado", true
	                ));
	            }

	            int restantes = 3 - intentos;
	            return ResponseEntity.status(401).body(Map.of(
	                "acceso",    false,
	                "mensaje",   "Contraseña incorrecta. Te quedan " + restantes + " intento(s).",
	                "bloqueado", false,
	                "intentos",  intentos
	            ));
	        }
	    }
	    
	    
	    
	    
	    @GetMapping("/util/generarHash")
	    @ResponseBody
	    public String generarHash(@RequestParam String pass) {
	        return new BCryptPasswordEncoder().encode(pass);
	    }
	    
	    
	    
	    
	    
	 // ════════════════════════════════════════════════════════════
	//  AGREGAR A ProcedimientosAlmacenadosController.java
	// ════════════════════════════════════════════════════════════


	    // Listar historial de cierres
	    @GetMapping("/api/cierres")
	    @ResponseBody
	    public ResponseEntity<List<Map<String, Object>>> listarCierres() {
	        return ResponseEntity.ok(procedimientosAlmacenados.spListarCierres());
	    }

	    // Ejecutar cierre del dia
	    @PostMapping("/api/cierres/ejecutar")
	    @ResponseBody
	    public ResponseEntity<Map<String, Object>> ejecutarCierre(
	            @RequestParam(value = "observaciones", required = false) String observaciones,
	            HttpSession session) {

	        String username = (String) session.getAttribute("nombreUsuario");
	        if (username == null) username = "sistema";

	        Map<String, Object> res = procedimientosAlmacenados.spEjecutarCierreDia(username, observaciones);
	        int resultado = (int) res.getOrDefault("resultado", -1);

	        if (resultado == 1)  return ResponseEntity.ok(res);
	        if (resultado == 0)  return ResponseEntity.status(400).body(res);
	        return ResponseEntity.status(500).body(res);
	    }
	    
	    
	    
	

	    // ════════════════════════════════════════════════════════════════════════
	    //  /admin/inventario/gestionar  — sp_gestion_inventario
	    //  Procesos de lectura (GET) y escritura (POST)
	    // ════════════════════════════════════════════════════════════════════════

	    /**
	     * GET /admin/inventario/gestionar?tipoProceso=N[&idInsumo=X&...]
	     *
	     * Procesos de solo lectura:
	     *   1  → listar insumos activos
	     *   6  → listar categorías de insumo
	     *   7  → listar unidades de medida
	     *   10 → log de movimientos (últimos 200)
	     */
	    @GetMapping("/admin/inventario/gestionar")
	    @ResponseBody
	    public ResponseEntity<List<Map<String, Object>>> gestionInventarioGet(
	            @RequestParam("tipoProceso")                          Integer    tipoProceso,
	            @RequestParam(value = "idInsumo",       required = false) Integer idInsumo,
	            @RequestParam(value = "nombre",         required = false) String  nombre,
	            @RequestParam(value = "idCategoria",    required = false) Integer idCategoria,
	            @RequestParam(value = "idUnidad",       required = false) Integer idUnidad,
	            @RequestParam(value = "stockInicial",   required = false) BigDecimal stockInicial,
	            @RequestParam(value = "stockMinimo",    required = false) BigDecimal stockMinimo,
	            @RequestParam(value = "cantidadEntrada",required = false) BigDecimal cantidadEntrada,
	            @RequestParam(value = "descripcion",    required = false) String  descripcion,
	            HttpSession session) {

	        String usuario = (String) session.getAttribute("nombreUsuario");

	        List<Map<String, Object>> resultado = procedimientosAlmacenados.spInvGestionar(
	                tipoProceso, idInsumo, nombre, idCategoria, idUnidad,
	                stockInicial, stockMinimo, cantidadEntrada, descripcion, usuario);

	        return ResponseEntity.ok(resultado);
	    }


	    /**
	     * POST /admin/inventario/gestionar
	     *
	     * Procesos de escritura:
	     *   2  → crear insumo
	     *   3  → editar insumo
	     *   4  → desactivar insumo (soft delete)
	     *   5  → entrada de stock
	     *   8  → crear categoría de insumo
	     *   9  → crear unidad de medida
	     */
	    @PostMapping("/admin/inventario/gestionar")
	    @ResponseBody
	    public ResponseEntity<Map<String, Object>> gestionInventarioPost(
	            @RequestParam("tipoProceso")                              Integer    tipoProceso,
	            @RequestParam(value = "idInsumo",        required = false) Integer  idInsumo,
	            @RequestParam(value = "nombre",          required = false) String   nombre,
	            @RequestParam(value = "idCategoria",     required = false) Integer  idCategoria,
	            @RequestParam(value = "idUnidad",        required = false) Integer  idUnidad,
	            @RequestParam(value = "stockInicial",    required = false) BigDecimal stockInicial,
	            @RequestParam(value = "stockMinimo",     required = false) BigDecimal stockMinimo,
	            @RequestParam(value = "cantidadEntrada", required = false) BigDecimal cantidadEntrada,
	            @RequestParam(value = "descripcion",     required = false) String   descripcion,
	            HttpSession session) {

	        String usuario = (String) session.getAttribute("nombreUsuario");

	        Map<String, Object> resultado = procedimientosAlmacenados.spInvGestionarEscritura(
	                tipoProceso, idInsumo, nombre, idCategoria, idUnidad,
	                stockInicial, stockMinimo, cantidadEntrada, descripcion, usuario);

	        int res = resultado.containsKey("resultado")
	                ? ((Number) resultado.get("resultado")).intValue() : 1;

	        HttpStatus status = (res == 1 || res == 0) ? HttpStatus.OK : HttpStatus.INTERNAL_SERVER_ERROR;
	        return ResponseEntity.status(status).body(resultado);
	    }


	    // ════════════════════════════════════════════════════════════════════════
	    //  /admin/inventario/recetas  — sp_gestion_recetas
	    //  Procesos de lectura (GET) y escritura (POST)
	    // ════════════════════════════════════════════════════════════════════════

	    /**
	     * GET /admin/inventario/recetas?tipoProceso=N[&idProducto=X&idInsumo=Y&...]
	     *
	     * Procesos de solo lectura:
	     *   1  → receta de un producto        (idProducto requerido)
	     *   5  → lista productos con receta
	     *   6  → receta de una opción/extra   (idProducto = id_subcategoria_opcion)
	     *   10 → lista opciones/extras con receta
	     */
	    @GetMapping("/admin/inventario/recetas")
	    @ResponseBody
	    public ResponseEntity<List<Map<String, Object>>> recetasGet(
	            @RequestParam("tipoProceso")                                Integer    tipoProceso,
	            @RequestParam(value = "idProducto",       required = false) Integer    idProducto,
	            @RequestParam(value = "idInsumo",         required = false) Integer    idInsumo,
	            @RequestParam(value = "cantidadRequerida",required = false) BigDecimal cantidadRequerida,
	            @RequestParam(value = "idProductoInsumo", required = false) Integer    idProductoInsumo) {

	        List<Map<String, Object>> resultado = procedimientosAlmacenados.spRecetasGestionar(
	                tipoProceso, idProducto, idInsumo, cantidadRequerida, idProductoInsumo);

	        return ResponseEntity.ok(resultado);
	    }


	    /**
	     * POST /admin/inventario/recetas
	     *
	     * Procesos de escritura:
	     *   2  → agregar insumo a receta de producto
	     *   3  → editar cantidad en receta de producto
	     *   4  → eliminar insumo de receta de producto
	     *   7  → agregar insumo a receta de opción/extra
	     *   8  → editar cantidad en receta de opción
	     *   9  → eliminar insumo de receta de opción
	     *
	     * Nota: el JS reutiliza los mismos parámetros para producto y opción.
	     *   - Para opciones, "idProductoInsumo" se mapea a idOpcionInsumo en el SP.
	     *   - El SP distingue el contexto por tipoProceso.
	     */
	    @PostMapping("/admin/inventario/recetas")
	    @ResponseBody
	    public ResponseEntity<Map<String, Object>> recetasPost(
	            @RequestParam("tipoProceso")                                Integer    tipoProceso,
	            @RequestParam(value = "idProducto",       required = false) Integer    idProducto,
	            @RequestParam(value = "idInsumo",         required = false) Integer    idInsumo,
	            @RequestParam(value = "cantidadRequerida",required = false) BigDecimal cantidadRequerida,
	            @RequestParam(value = "idProductoInsumo", required = false) Integer    idProductoInsumo,
	            @RequestParam(value = "idOpcionInsumo",   required = false) Integer    idOpcionInsumo) {

	        // Para procesos 7-9 (extras), el JS envía idOpcionInsumo.
	        // Lo unificamos en idProductoInsumo para que el SP lo reciba en param 5.
	        Integer idItem = (idProductoInsumo != null) ? idProductoInsumo : idOpcionInsumo;

	        Map<String, Object> resultado = procedimientosAlmacenados.spRecetasGestionarEscritura(
	                tipoProceso, idProducto, idInsumo, cantidadRequerida, idItem);

	        int res = resultado.containsKey("resultado")
	                ? ((Number) resultado.get("resultado")).intValue() : 1;

	        // resultado=0 puede ser "ya existe" (warning) pero HTTP 200 igual
	        HttpStatus status = (res >= 0) ? HttpStatus.OK : HttpStatus.INTERNAL_SERVER_ERROR;
	        return ResponseEntity.status(status).body(resultado);
	    }
	    
	    
	    
}