package com.icaro.coffeeapp.controller;

import java.util.Map;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import com.icaro.coffeeapp.service.AperturaCajaService;

import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
public class AdminController {

    private final AperturaCajaService aperturaCajaService;

    @GetMapping("/admin/inicio")
    public String adminInicio(Model model, Authentication authentication) {

        String nombreUsuario = authentication.getName();
        model.addAttribute("nombreUsuario", nombreUsuario);

        // Sin apertura del dia, Inicio se pinta con el modal fijo de
        // apertura encima y sin sus scripts (nada se puede tocar).
        boolean pendiente = !aperturaCajaService.cajaAbiertaHoy();
        model.addAttribute("aperturaPendiente", pendiente);
        if (pendiente) {
            Map<String, Object> apertura = aperturaCajaService.consultar();
            model.addAttribute("diaApertura", apertura != null ? apertura.get("n_dia") : null);
        }

        return "admin/inicio";
    }
}
