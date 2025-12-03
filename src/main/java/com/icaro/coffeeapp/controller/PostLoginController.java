package com.icaro.coffeeapp.controller;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.Collection;

@Controller
public class PostLoginController {

    @GetMapping("/postLogin")
    public String redirigirSegunRol(Authentication authentication) {

        Collection<? extends GrantedAuthority> authorities = authentication.getAuthorities();

        boolean isAdmin           = hasRole(authorities, "ROLE_ADMINISTRADOR");
        boolean isSalados         = hasRole(authorities, "ROLE_OPERADOR_SALADOS");
        boolean isCrepasWaffles   = hasRole(authorities, "ROLE_OPERADOR_CREPAS_WAFFLES");
        boolean isBebCalientes    = hasRole(authorities, "ROLE_OPERADOR_BEBIDAS_CALIENTES");
        boolean isBebFrias        = hasRole(authorities, "ROLE_OPERADOR_BEBIDAS_FRIAS");
        boolean isFitness         = hasRole(authorities, "ROLE_OPERADOR_FITNESS");

        if (isAdmin) {
            return "redirect:/admin/inicio";
        } else if (isSalados) {
            return "redirect:/salados/iniciosa";
        } else if (isCrepasWaffles) {
            return "redirect:/crepas/iniciocr";
        } else if (isBebCalientes) {
            return "redirect:/bebcalientes/iniciobc";
        } else if (isBebFrias) {
            return "redirect:/bebfrias/iniciobf";
        } else if (isFitness) {
            return "redirect:/fitness/iniciofit";
        }

        // fallback
        return "redirect:/login?error";
    }

    private boolean hasRole(Collection<? extends GrantedAuthority> authorities, String role) {
        return authorities.stream().anyMatch(a -> a.getAuthority().equals(role));
    }
}
