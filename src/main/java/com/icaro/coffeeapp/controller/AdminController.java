package com.icaro.coffeeapp.controller;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class AdminController {

    @GetMapping("/admin/inicio")
    public String adminInicio(Model model, Authentication authentication) {

        String nombreUsuario = authentication.getName();
        model.addAttribute("nombreUsuario", nombreUsuario);

        return "admin/inicio"; 
    }
    

    
}
