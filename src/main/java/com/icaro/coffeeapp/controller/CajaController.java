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

import com.icaro.coffeeapp.service.CajaService;

import lombok.RequiredArgsConstructor;

/**
 * Arqueos de caja.
 *
 * El monto y el turno los decide la base: aqui solo llega lo que la
 * cajera escribio y se devuelve tal cual respondio el procedimiento.
 */
@Controller
@RequiredArgsConstructor
public class CajaController {

    private final CajaService cajaService;

    // ── Consultas ───────────────────────────────────────────────

    /** Fondo, ventas en efectivo del turno, entradas, salidas y esperado. */
    @GetMapping("/admin/caja/resumen")
    @ResponseBody
    public Map<String, Object> resumen() {
        return cajaService.resumenDelTurno();
    }

    /** La libreta del turno en curso. */
    @GetMapping("/admin/caja/movimientos")
    @ResponseBody
    public List<Map<String, Object>> movimientos() {
        return cajaService.movimientosDelTurno();
    }

    /** Arqueos ya firmados. Sin fechas, los del dia de negocio en curso. */
    @GetMapping("/admin/caja/arqueos")
    @ResponseBody
    public List<Map<String, Object>> arqueos(
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta) {

        LocalDate dDesde = parse(desde);
        LocalDate dHasta = parse(hasta);
        if (dDesde != null && dHasta != null && dDesde.isAfter(dHasta)) {
            LocalDate t = dDesde; dDesde = dHasta; dHasta = t;
        }
        return cajaService.historialArqueos(dDesde, dHasta);
    }

    /** Detalle de un arqueo: los movimientos que quedaron sellados en el. */
    @GetMapping("/admin/caja/arqueos/{idArqueo}/movimientos")
    @ResponseBody
    public List<Map<String, Object>> movimientosDeArqueo(@PathVariable int idArqueo) {
        return cajaService.movimientosDeArqueo(idArqueo);
    }

    // ── Escritura ───────────────────────────────────────────────

    /** Anota una salida o entrada de efectivo. */
    @PostMapping("/admin/caja/movimientos")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> registrarMovimiento(
            @RequestBody MovimientoDTO cuerpo, Authentication authentication) {

        Map<String, Object> salida = cajaService.registrarMovimiento(
                cuerpo.tipo(), cuerpo.categoria(), cuerpo.monto(),
                cuerpo.concepto(), authentication.getName());

        return respuesta(salida);
    }

    /** Cierra el turno con lo contado en caja. */
    @PostMapping("/admin/caja/arqueos")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> registrarArqueo(
            @RequestBody ArqueoDTO cuerpo, Authentication authentication) {

        Map<String, Object> salida = cajaService.registrarArqueo(
                cuerpo.contado(), cuerpo.observaciones(), authentication.getName());

        return respuesta(salida);
    }

    /** Borra un movimiento mientras no se haya arqueado. */
    @DeleteMapping("/admin/caja/movimientos/{idMovimiento}")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> borrarMovimiento(@PathVariable int idMovimiento) {
        return respuesta(cajaService.borrarMovimiento(idMovimiento));
    }

    // ── Apoyos ──────────────────────────────────────────────────

    /**
     * resultado 1 es exito; 0 es un rechazo con motivo (monto invalido,
     * movimiento ya arqueado) y -1 una falla de la base.
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

    public record MovimientoDTO(String tipo, String categoria,
                                BigDecimal monto, String concepto) { }

    public record ArqueoDTO(BigDecimal contado, String observaciones) { }
}
