package com.icaro.coffeeapp.controller;

import java.io.IOException;
import java.io.OutputStream;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import com.icaro.coffeeapp.service.ProcedimientosAlmacenados;
import com.icaro.coffeeapp.utils.ConexionJDBC;
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
	        @RequestParam(value = "idRol", required = false) Integer idRol
	) {

	    Integer filas = procedimientosAlmacenados.spGestionarOrden(idOrden, tipoProceso, idRol);

	    return Map.of(
	            "filas", filas,
	            "idOrden", idOrden,
	            "tipoProceso", tipoProceso
	    );
	}

	
	@GetMapping("/admin/orden/resumen")
	@ResponseBody
	public List<Map<String, Object>> resumenOrden(@RequestParam("idOrden") Integer idOrden) {
	    return procedimientosAlmacenados.spResumenOrden(idOrden);
	}

	
	@GetMapping("/admin/orden/pendientes")
	@ResponseBody
	public List<Map<String, Object>> getOrdenesPendientes() {
	    return procedimientosAlmacenados.spGestionarOrdenSelect(null, 4, null);
	}

	

	
}	
