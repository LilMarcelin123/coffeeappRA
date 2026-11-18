package com.icaro.coffeeapp.controller;

import java.math.BigDecimal;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import com.icaro.coffeeapp.service.AperturaCajaService;

import lombok.RequiredArgsConstructor;

/**
 * Apertura de caja: fondo del dia y quien lo registra.
 *
 * No tiene pantalla propia: se captura en un modal fijo dentro de
 * Inicio del administrador (fragmentos/apertura.html), que aparece
 * mientras no exista la apertura del dia de negocio en curso.
 */
@Controller
@RequiredArgsConstructor
public class AperturaCajaController {

    private final AperturaCajaService aperturaCajaService;

    /** Por si alguien la abre a mano: el modal vive en Inicio. */
    @GetMapping("/admin/apertura")
    public String pantalla() {
        return "redirect:/admin/inicio";
    }

    /** Registra el fondo del dia. Responde { resultado, mensaje }. */
    @PostMapping("/admin/apertura")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> registrar(
            @RequestParam(value = "fondo", required = false) String fondo,
            @RequestParam(value = "responsable", required = false) String responsable,
            Authentication authentication) {

        if (aperturaCajaService.cajaAbiertaHoy()) {
            return ResponseEntity.ok(Map.of("resultado", 1, "mensaje", "La caja de hoy ya estaba abierta."));
        }

        BigDecimal monto = aNumero(fondo);
        if (monto == null) {
            return ResponseEntity.badRequest().body(
                    Map.of("resultado", 0, "mensaje", "Captura el fondo de caja (puede ser 0)."));
        }

        Map<String, Object> salida = aperturaCajaService.registrar(
                monto, responsable, authentication.getName());

        int resultado = salida.get("resultado") instanceof Number n ? n.intValue() : -1;
        if (resultado == 1) return ResponseEntity.ok(salida);
        if (resultado == 0) return ResponseEntity.badRequest().body(salida);
        return ResponseEntity.internalServerError().body(salida);
    }

    private BigDecimal aNumero(String texto) {
        if (texto == null || texto.isBlank()) return null;
        try {
            return new BigDecimal(texto.trim().replace("$", "").replace(",", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
