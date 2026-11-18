package com.icaro.coffeeapp.config;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.icaro.coffeeapp.service.AperturaCajaService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

/**
 * Candado de apertura de caja.
 *
 * Mientras no se haya registrado el fondo del dia de negocio en curso,
 * el administrador no puede tomar ordenes ni abrir ningun modulo:
 * cualquier pantalla lo regresa a Inicio, donde el modal fijo de
 * apertura le pide el fondo, y cualquier llamada de fondo (fetch)
 * recibe 428 con el motivo.
 *
 * Las pantallas de cocina y de area NO pasan por aqui: no toman
 * ordenes, y la tele de cocina no debe quedarse trabada esperando
 * a que alguien abra caja.
 */
@Component
@RequiredArgsConstructor
public class AperturaCajaInterceptor implements HandlerInterceptor {

    /** Donde vive el modal de apertura. */
    static final String INICIO   = "/admin/inicio";
    /** Donde se registra la apertura. */
    static final String APERTURA = "/admin/apertura";

    private final AperturaCajaService aperturaCajaService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
                             Object handler) throws Exception {

        if (!esAdministrador()) return true;
        if (aperturaCajaService.cajaAbiertaHoy()) return true;

        if (esNavegacion(request)) {
            response.sendRedirect(request.getContextPath() + INICIO);
        } else {
            response.setStatus(428); // Precondition Required
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(
                "{\"resultado\":0,\"apertura\":false,"
              + "\"mensaje\":\"Primero registra el fondo de caja del dia.\","
              + "\"redirect\":\"" + INICIO + "\"}");
        }
        return false;
    }

    private boolean esAdministrador() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMINISTRADOR".equals(a.getAuthority()));
    }

    /** Una pantalla que se abre en el navegador, no un fetch de fondo. */
    private boolean esNavegacion(HttpServletRequest request) {
        if (!"GET".equalsIgnoreCase(request.getMethod())) return false;
        if ("XMLHttpRequest".equalsIgnoreCase(request.getHeader("X-Requested-With"))) return false;

        String modo = request.getHeader("Sec-Fetch-Mode");
        if (modo != null) return "navigate".equalsIgnoreCase(modo);

        String accept = request.getHeader("Accept");
        return accept != null && accept.contains("text/html");
    }
}
