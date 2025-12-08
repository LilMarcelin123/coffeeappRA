package com.icaro.coffeeapp.controller;

import java.io.IOException;
import java.io.OutputStream;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

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
}	
