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
	        @RequestParam("listaExtrasJson") String listaExtrasJson) {

	//    log.info(">>> agregarItem() idOrden={}, idProducto={}, cantidadProducto={}, listaExtrasJson={}",
	  //          idOrden, idProducto, cantidadProducto, listaExtrasJson);

	    Integer idItem = procedimientosAlmacenados.spAgregarItemConExtras(
	            idOrden,
	            idProducto,
	            cantidadProducto,
	            listaExtrasJson
	    );

	    return Map.of(
	            "idItem", idItem,
	            "mensaje", "Item agregado correctamente"
	    );
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
	    
	  
	    
	    
	    
}