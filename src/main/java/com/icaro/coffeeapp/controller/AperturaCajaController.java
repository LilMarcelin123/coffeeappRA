package com.icaro.coffeeapp.controller;

import java.math.BigDecimal;
import java.util.Map;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import com.icaro.coffeeapp.service.AperturaCajaService;

import lombok.RequiredArgsConstructor;

/**
 * Pantalla de apertura de caja: fondo del dia y quien lo registra.
 * Es lo primero que ve el administrador despues del corte de la 01:00.
 */
@Controller
@RequiredArgsConstructor
public class AperturaCajaController {

    private final AperturaCajaService aperturaCajaService;

    @GetMapping("/admin/apertura")
    public String pantalla(Model model, Authentication authentication) {
        if (aperturaCajaService.cajaAbiertaHoy()) return "redirect:/admin/inicio";

        Map<String, Object> apertura = aperturaCajaService.consultar();
        model.addAttribute("dia", apertura != null ? apertura.get("n_dia") : null);
        model.addAttribute("nombreUsuario", authentication.getName());
        return "admin/apertura";
    }

    @PostMapping("/admin/apertura")
    public String registrar(@RequestParam(value = "fondo", required = false) String fondo,
                            @RequestParam(value = "responsable", required = false) String responsable,
                            Model model, Authentication authentication) {

        if (aperturaCajaService.cajaAbiertaHoy()) return "redirect:/admin/inicio";

        BigDecimal monto = aNumero(fondo);
        Map<String, Object> salida = monto == null
                ? Map.of("resultado", 0, "mensaje", "Captura el fondo de caja (puede ser 0).")
                : aperturaCajaService.registrar(monto, responsable, authentication.getName());

        if (salida.get("resultado") instanceof Number n && n.intValue() == 1) {
            return "redirect:/admin/inicio";
        }

        Map<String, Object> apertura = aperturaCajaService.consultar();
        model.addAttribute("dia", apertura != null ? apertura.get("n_dia") : null);
        model.addAttribute("nombreUsuario", authentication.getName());
        model.addAttribute("error", salida.get("mensaje"));
        model.addAttribute("fondo", fondo);
        model.addAttribute("responsable", responsable);
        return "admin/apertura";
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
