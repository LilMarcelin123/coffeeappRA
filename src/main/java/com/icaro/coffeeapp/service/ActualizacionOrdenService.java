package com.icaro.coffeeapp.service;

import java.util.Map;

import org.springframework.stereotype.Service;

import com.icaro.coffeeapp.client.EvolutionApiClient;
import com.icaro.coffeeapp.service.MensajeEstatusBuilder.Estatus;

import lombok.extern.slf4j.Slf4j;

/**
 * Orquesta el flujo "enviar actualización de estatus al cliente":
 * valida orden WhatsApp -> construye mensaje -> envía -> registra historial.
 */
@Service
@Slf4j
public class ActualizacionOrdenService {

    private final ProcedimientosAlmacenados sp;
    private final EvolutionApiClient evolutionApiClient;
    private final MensajeEstatusBuilder mensajeBuilder;

    public ActualizacionOrdenService(ProcedimientosAlmacenados sp,
                                     EvolutionApiClient evolutionApiClient,
                                     MensajeEstatusBuilder mensajeBuilder) {
        this.sp = sp;
        this.evolutionApiClient = evolutionApiClient;
        this.mensajeBuilder = mensajeBuilder;
    }

    public static final class Resultado {
        public final boolean ok;
        public final String  mensaje;
        public final Integer idActualizacion;
        private Resultado(boolean ok, String mensaje, Integer idActualizacion) {
            this.ok = ok; this.mensaje = mensaje; this.idActualizacion = idActualizacion;
        }
        static Resultado exito(String msg, Integer id) { return new Resultado(true, msg, id); }
        static Resultado fallo(String motivo)          { return new Resultado(false, motivo, null); }
    }

    public Resultado enviarActualizacion(Integer idOrden, String estatusRaw,
            String tiempoEstimado, String telefonoRepartidor, String usuarioAdmin) {

        final Estatus estatus;
        try {
            estatus = Estatus.desde(estatusRaw);
        } catch (Exception e) {
            return Resultado.fallo("Estatus inválido: " + estatusRaw);
        }

        Map<String, Object> datos = sp.spDatosEnvioOrden(idOrden);
        if (datos == null || datos.isEmpty()) {
            return Resultado.fallo("La orden #" + idOrden + " no existe.");
        }

        String source  = str(datos.get("source"));
        String waPhone = str(datos.get("wa_phone"));

        if (!"WHATSAPP".equalsIgnoreCase(source)) {
            return Resultado.fallo("La orden #" + idOrden + " no proviene de WhatsApp.");
        }
        if (waPhone.isBlank()) {
            return Resultado.fallo("La orden #" + idOrden + " no tiene número de WhatsApp registrado.");
        }

        final String mensaje = mensajeBuilder.construir(estatus, tiempoEstimado, telefonoRepartidor);

        boolean enviado = false;
        try {
            enviado = evolutionApiClient.enviarMensaje(waPhone, mensaje);
        } catch (Exception e) {
            log.error("Error enviando actualización WhatsApp (orden {}): {}", idOrden, e.getMessage());
        }

        Integer idActualizacion = sp.spRegistrarActualizacion(
                idOrden, estatus.name(), mensaje,
                tiempoEstimado, telefonoRepartidor, usuarioAdmin, enviado);

        if (!enviado) {
            return Resultado.fallo("No se pudo enviar el mensaje por WhatsApp. Se registró el intento en el historial.");
        }

        log.info("Actualización '{}' enviada a orden {} por {}", estatus, idOrden, usuarioAdmin);
        return Resultado.exito(mensaje, idActualizacion);
    }

    private String str(Object o) {
        return (o == null) ? "" : o.toString().trim();
    }
}
