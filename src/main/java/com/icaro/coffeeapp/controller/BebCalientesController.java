package com.icaro.coffeeapp.controller;

import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class BebCalientesController {

    @GetMapping("/bebcalientes/iniciobc")
    public String bebcalientesInicio(Model model, HttpSession session) {

        if (session.getAttribute("nombreUsuario") == null) {
            return "redirect:/login";
        }

        model.addAttribute("nombreUsuario", session.getAttribute("nombreUsuario"));
        model.addAttribute("nombreNegocio", session.getAttribute("nombreNegocio"));
        model.addAttribute("rolNombre",     "Bebidas Calientes");

        return "bebcalientes/iniciobc";   
    }
}