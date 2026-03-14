package com.icaro.coffeeapp.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import com.icaro.coffeeapp.model.SecurityUser;

import java.util.Collection;

@Controller
public class PostLoginController {

    @GetMapping("/postLogin")
    public String redirigirSegunRol(Authentication authentication, HttpServletRequest request) {

        if (authentication == null) return "redirect:/login?error";

        HttpSession session = request.getSession();
        SecurityUser securityUser = (SecurityUser) authentication.getPrincipal();

        session.setAttribute("nombreUsuario", authentication.getName());
        session.setAttribute("idRol",         securityUser.getIdRol());
        session.setAttribute("nombreNegocio", "Rincón Arboledas");

        System.out.println(">>> Usuario:     " + authentication.getName());
        System.out.println(">>> Authorities: " + authentication.getAuthorities());
        System.out.println(">>> idRol:       " + securityUser.getIdRol());

    
        Collection<? extends GrantedAuthority> authorities = authentication.getAuthorities();

        if (hasRole(authorities, "ROLE_ADMINISTRADOR"))              return "redirect:/admin/inicio";
        if (hasRole(authorities, "ROLE_OPERADOR_SALADOS"))           return "redirect:/salados/iniciosa";
        if (hasRole(authorities, "ROLE_OPERADOR_CREPAS_WAFFLES"))    return "redirect:/crepas/iniciocr";
        if (hasRole(authorities, "ROLE_OPERADOR_BEBIDAS_CALIENTES")) return "redirect:/bebcalientes/iniciobc";
        if (hasRole(authorities, "ROLE_OPERADOR_BEBIDAS_FRIAS"))     return "redirect:/bebfrias/iniciobf";
        if (hasRole(authorities, "ROLE_OPERADOR_FITNESS"))           return "redirect:/fitness/iniciofit";

        return "redirect:/login?error";
    }

    private boolean hasRole(Collection<? extends GrantedAuthority> authorities, String role) {
        return authorities.stream().anyMatch(a -> a.getAuthority().equals(role));
    }
}