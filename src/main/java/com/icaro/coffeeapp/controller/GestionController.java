package com.icaro.coffeeapp.controller;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import com.icaro.coffeeapp.service.ProcedimientosAlmacenados;

import lombok.RequiredArgsConstructor;

/**
 * Modulo de Gestion: cortes, ventas por dia y productos.
 *
 * El dia de negocio va de las 01:00 a las 01:00, asi que antes de esa
 * hora "hoy" sigue siendo el dia anterior. Esa regla se aplica aqui y
 * en las vistas de la base; no debe repetirse en el navegador.
 */
@Controller
@RequiredArgsConstructor
public class GestionController {

    private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");
    private static final int    HORA_CORTE = 1;

    private final ProcedimientosAlmacenados procedimientosAlmacenados;

    /** Dia de negocio en curso. */
    private LocalDate hoyNegocio() {
        return LocalDateTime.now(ZONA).minusHours(HORA_CORTE).toLocalDate();
    }

    @GetMapping("/admin/gestion")
    public String panel(Model model, Authentication authentication) {
        model.addAttribute("nombreUsuario", authentication.getName());
        model.addAttribute("hoyNegocio", hoyNegocio().toString());
        return "admin/gestion";
    }

    /**
     * KPIs del periodo con su comparativo.
     * Sin fechas, responde por el dia de negocio en curso.
     */
    @GetMapping("/admin/gestion/kpis")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> kpis(
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta) {

        LocalDate dHasta = parseOHoy(hasta);
        LocalDate dDesde = parseO(desde, dHasta);
        if (dDesde.isAfter(dHasta)) { LocalDate t = dDesde; dDesde = dHasta; dHasta = t; }

        List<Map<String, Object>> filas =
                procedimientosAlmacenados.spGestionModulo(1, dDesde, dHasta);

        if (filas.isEmpty()) return ResponseEntity.status(500).body(Map.of("ok", false));

        Map<String, Object> kpis = new java.util.LinkedHashMap<>(filas.get(0));
        kpis.put("ok", true);
        return ResponseEntity.ok(kpis);
    }

    /** Venta por dia del periodo, para la grafica y la Bitacora. */
    @GetMapping("/admin/gestion/ventas-dia")
    @ResponseBody
    public ResponseEntity<List<Map<String, Object>>> ventasPorDia(
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta) {

        LocalDate dHasta = parseOHoy(hasta);
        LocalDate dDesde = parseO(desde, dHasta);
        if (dDesde.isAfter(dHasta)) { LocalDate t = dDesde; dDesde = dHasta; dHasta = t; }

        return ResponseEntity.ok(procedimientosAlmacenados.spGestionModulo(2, dDesde, dHasta));
    }

    private LocalDate parseOHoy(String valor) {
        try {
            return (valor == null || valor.isBlank()) ? hoyNegocio() : LocalDate.parse(valor);
        } catch (Exception e) {
            return hoyNegocio();
        }
    }

    private LocalDate parseO(String valor, LocalDate porDefecto) {
        try {
            return (valor == null || valor.isBlank()) ? porDefecto : LocalDate.parse(valor);
        } catch (Exception e) {
            return porDefecto;
        }
    }
}
