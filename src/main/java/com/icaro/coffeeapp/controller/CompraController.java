package com.icaro.coffeeapp.controller;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import com.icaro.coffeeapp.service.CompraService;

import lombok.RequiredArgsConstructor;

/**
 * Compras del dia.
 *
 * Se capturan desde Inicio y el condensado se ve en Caja. Vive bajo
 * /admin/**, asi que SecurityConfig ya lo reserva al Administrador.
 * El dia de negocio lo decide la base cuando no llega uno.
 */
@Controller
@RequiredArgsConstructor
public class CompraController {

    private final CompraService compraService;

    // ── Consultas ───────────────────────────────────────────────

    /** Compras activas de un dia de negocio (ISO). Sin dia, las de hoy. */
    @GetMapping("/admin/compras")
    @ResponseBody
    public List<Map<String, Object>> delDia(@RequestParam(required = false) String dia) {
        return compraService.delDia(parse(dia));
    }

    /** Venta del dia contra compras de caja y de fuera, y el resultado. */
    @GetMapping("/admin/compras/condensado")
    @ResponseBody
    public Map<String, Object> condensado(@RequestParam(required = false) String dia) {
        return compraService.condensado(parse(dia));
    }

    // ── Escritura ───────────────────────────────────────────────

    /** Anota una compra. Si salio de caja, el procedimiento anota su salida. */
    @PostMapping("/admin/compras")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> registrar(
            @RequestBody CompraDTO cuerpo, Authentication authentication) {

        Map<String, Object> salida = compraService.registrar(
                cuerpo.concepto(), cuerpo.monto(), cuerpo.origen(),
                cuerpo.origenDetalle(), authentication.getName());

        return respuesta(salida);
    }

    /** Cancela una compra mientras no haya entrado en un arqueo. */
    @DeleteMapping("/admin/compras/{idCompra}")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> cancelar(
            @PathVariable int idCompra, Authentication authentication) {

        return respuesta(compraService.cancelar(idCompra, authentication.getName()));
    }

    // ── Apoyos ──────────────────────────────────────────────────

    /**
     * resultado 1 es exito; 0 es un rechazo con motivo (monto invalido,
     * compra ya arqueada) y -1 una falla de la base.
     */
    private ResponseEntity<Map<String, Object>> respuesta(Map<String, Object> salida) {
        int resultado = salida.get("resultado") instanceof Number n ? n.intValue() : -1;

        if (resultado == 1)  return ResponseEntity.ok(salida);
        if (resultado == 0)  return ResponseEntity.badRequest().body(salida);
        return ResponseEntity.internalServerError().body(salida);
    }

    private LocalDate parse(String iso) {
        try {
            return (iso == null || iso.isBlank()) ? null : LocalDate.parse(iso);
        } catch (java.time.format.DateTimeParseException e) {
            return null;
        }
    }

    /** origen: CAJA o FUERA. origenDetalle es obligatorio con FUERA. */
    public record CompraDTO(String concepto, BigDecimal monto,
                            String origen, String origenDetalle) { }
}
