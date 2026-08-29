package com.icaro.coffeeapp.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import com.icaro.coffeeapp.service.ActualizacionOrdenService;
import com.icaro.coffeeapp.service.ActualizacionOrdenService.Resultado;
import com.icaro.coffeeapp.service.ProcedimientosAlmacenados;

import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;

/**
 * Endpoints REST para actualización de estatus de pedidos WhatsApp.
 * Controller delgado: la lógica vive en ActualizacionOrdenService.
 */
@RestController
@Slf4j
public class ActualizacionOrdenController {

    private final ActualizacionOrdenService actualizacionService;
    private final ProcedimientosAlmacenados sp;

    public ActualizacionOrdenController(ActualizacionOrdenService actualizacionService,
                                        ProcedimientosAlmacenados sp) {
        this.actualizacionService = actualizacionService;
        this.sp = sp;
    }

    /** Cocina marca/desmarca un item. Unica fuente de verdad del estado de preparacion. */
    @PostMapping("/orden/item/estado")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> marcarItem(
            @RequestParam("idOrdenItem") Integer idOrdenItem,
            @RequestParam("estado")      String  estado) {
        if (idOrdenItem == null || estado == null || estado.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "mensaje", "Faltan parametros."));
        }
        Map<String, Object> r = sp.spMarcarItemPreparacion(idOrdenItem, estado);
        Map<String, Object> salida = new java.util.HashMap<>(r);
        salida.put("ok", !r.isEmpty());
        return ResponseEntity.ok(salida);
    }

    /** Estados de los items de todas las ordenes pendientes (para Administracion). */
    @GetMapping("/admin/orden/items-estado")
    @ResponseBody
    public ResponseEntity<List<Map<String, Object>>> itemsEstado() {
        return ResponseEntity.ok(sp.obtenerItemsOrdenesPendientes());
    }

    /** Devuelve los datos de entrega/pago de una orden WhatsApp para mostrar en pantalla. */
    @GetMapping("/admin/orden/{idOrden}/info-whatsapp")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> infoWhatsapp(
            @org.springframework.web.bind.annotation.PathVariable("idOrden") Integer idOrden) {
        if (idOrden == null) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "mensaje", "Falta idOrden."));
        }
        Map<String, Object> info = sp.obtenerInfoWhatsapp(idOrden);
        if (info == null || info.isEmpty()) {
            return ResponseEntity.ok(Map.of("ok", false, "mensaje", "Orden no encontrada."));
        }
        info.put("ok", true);
        return ResponseEntity.ok(info);
    }

    @PostMapping("/admin/orden/actualizacion/enviar")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> enviarActualizacion(
            @RequestParam("idOrden")                              Integer idOrden,
            @RequestParam("estatus")                              String  estatus,
            @RequestParam(value = "tiempoEstimado",     required = false) String tiempoEstimado,
            @RequestParam(value = "telefonoRepartidor", required = false) String telefonoRepartidor,
            HttpSession session) {

        Object usuario = session.getAttribute("nombreUsuario");
        String usuarioAdmin = (usuario != null) ? usuario.toString() : "desconocido";

        if (idOrden == null || estatus == null || estatus.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "ok", false,
                    "mensaje", "Faltan parámetros obligatorios (idOrden, estatus)."));
        }

        Resultado r = actualizacionService.enviarActualizacion(
                idOrden, estatus, tiempoEstimado, telefonoRepartidor, usuarioAdmin);

        if (r.ok) {
            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "mensaje", r.mensaje,
                    "idActualizacion", r.idActualizacion));
        }
        return ResponseEntity.ok(Map.of("ok", false, "mensaje", r.mensaje));
    }

    @GetMapping("/admin/orden/actualizacion/historial")
    @ResponseBody
    public List<Map<String, Object>> historial(@RequestParam("idOrden") Integer idOrden) {
        return sp.spHistorialActualizaciones(idOrden);
    }
}
