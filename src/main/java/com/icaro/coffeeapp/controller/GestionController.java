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
import org.springframework.web.bind.annotation.PathVariable;
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

    @GetMapping("/admin/gestion/cierres")
    public String cierres(Model model, Authentication authentication) {
        model.addAttribute("nombreUsuario", authentication.getName());
        model.addAttribute("hoyNegocio", hoyNegocio().toString());
        return "admin/cierres";
    }

    /**
     * Cierres del periodo: el resumen por dia y los cortes individuales.
     * Van juntos en una sola respuesta porque la pantalla necesita los dos
     * a la vez y pedirlos por separado solo duplicaria viajes.
     */
    @GetMapping("/admin/gestion/cierres/datos")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> datosCierres(
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta) {

        LocalDate dHasta = parseOHoy(hasta);
        LocalDate dDesde = parseO(desde, dHasta);
        if (dDesde.isAfter(dHasta)) { LocalDate t = dDesde; dDesde = dHasta; dHasta = t; }

        return ResponseEntity.ok(Map.of(
                "ok",     true,
                "desde",  dDesde.toString(),
                "hasta",  dHasta.toString(),
                "dias",   procedimientosAlmacenados.spGestionModulo(3, dDesde, dHasta),
                "cortes", procedimientosAlmacenados.spGestionModulo(4, dDesde, dHasta)));
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

    // ── Productos ───────────────────────────────────────────

    @GetMapping("/admin/gestion/productos")
    public String productos(Model model, Authentication authentication) {
        model.addAttribute("nombreUsuario", authentication.getName());
        model.addAttribute("hoyNegocio", hoyNegocio().toString());
        return "admin/productos";
    }

    /**
     * Ranking, categorias y no vendidos en una sola respuesta: las
     * tres tablas se pintan juntas y pedirlas por separado solo
     * agregaria tres viajes para mostrar la misma pantalla.
     */
    @GetMapping("/admin/gestion/productos/datos")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> productosDatos(
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta) {

        LocalDate dHasta = parseOHoy(hasta);
        LocalDate dDesde = parseO(desde, dHasta);
        if (dDesde.isAfter(dHasta)) { LocalDate t = dDesde; dDesde = dHasta; dHasta = t; }

        Map<String, Object> salida = new java.util.LinkedHashMap<>();
        salida.put("ok", true);
        salida.put("desde", dDesde.toString());
        salida.put("hasta", dHasta.toString());
        salida.put("ranking",    procedimientosAlmacenados.spGestionProductos(1, dDesde, dHasta));
        salida.put("categorias", procedimientosAlmacenados.spGestionProductos(2, dDesde, dHasta));
        salida.put("sinVenta",   procedimientosAlmacenados.spGestionProductos(3, dDesde, dHasta));

        return ResponseEntity.ok(salida);
    }

    // ── Ritmo ───────────────────────────────────────────────

    @GetMapping("/admin/gestion/ritmo")
    public String ritmo(Model model, Authentication authentication) {
        model.addAttribute("nombreUsuario", authentication.getName());
        model.addAttribute("hoyNegocio", hoyNegocio().toString());
        return "admin/ritmo";
    }

    /**
     * El mapa y su divisor van juntos: el mapa se lee como promedio
     * por dia abierto y sin el segundo no se puede pintar nada.
     */
    @GetMapping("/admin/gestion/ritmo/datos")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> ritmoDatos(
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta) {

        LocalDate dHasta = parseOHoy(hasta);
        LocalDate dDesde = parseO(desde, dHasta);
        if (dDesde.isAfter(dHasta)) { LocalDate t = dDesde; dDesde = dHasta; dHasta = t; }

        Map<String, Object> salida = new java.util.LinkedHashMap<>();
        salida.put("ok", true);
        salida.put("desde", dDesde.toString());
        salida.put("hasta", dHasta.toString());
        salida.put("mapa",  procedimientosAlmacenados.spGestionRitmo(1, dDesde, dHasta));
        salida.put("dias",  procedimientosAlmacenados.spGestionRitmo(2, dDesde, dHasta));

        return ResponseEntity.ok(salida);
    }

    @GetMapping("/admin/gestion/bitacora")
    public String bitacora(Model model, Authentication authentication) {
        model.addAttribute("nombreUsuario", authentication.getName());
        model.addAttribute("hoyNegocio", hoyNegocio().toString());
        return "admin/bitacora";
    }

    /**
     * Calendario del periodo y ordenes del mismo. Van juntos porque el
     * calendario pinta los totales y la lista se arma al picar un dia.
     */
    @GetMapping("/admin/gestion/bitacora/datos")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> datosBitacora(
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta) {

        LocalDate dHasta = parseOHoy(hasta);
        LocalDate dDesde = parseO(desde, dHasta);
        if (dDesde.isAfter(dHasta)) { LocalDate t = dDesde; dDesde = dHasta; dHasta = t; }

        return ResponseEntity.ok(Map.of(
                "ok",      true,
                "desde",   dDesde.toString(),
                "hasta",   dHasta.toString(),
                "dias",    procedimientosAlmacenados.spGestionModulo(2, dDesde, dHasta),
                "ordenes", procedimientosAlmacenados.spGestionModulo(5, dDesde, dHasta)));
    }

    /** Detalle de una orden: lo unico que abre en modal dentro del modulo. */
    @GetMapping("/admin/gestion/orden/{idOrden}")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> detalleOrden(@PathVariable Integer idOrden) {
        Map<String, Object> detalle = procedimientosAlmacenados.spDetalleOrden(idOrden);
        if (detalle.get("orden") == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(detalle);
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
