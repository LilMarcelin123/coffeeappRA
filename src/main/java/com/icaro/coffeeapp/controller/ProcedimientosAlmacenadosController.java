package com.icaro.coffeeapp.controller;

import java.io.IOException;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.math.BigDecimal;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import com.icaro.coffeeapp.service.ProcedimientosAlmacenados;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

@Controller
@Slf4j
public class ProcedimientosAlmacenadosController {
	
	@Autowired
	ObjectMapper objectMapper;
	
	@Autowired
	ProcedimientosAlmacenados procedimientosAlmacenados;

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
}