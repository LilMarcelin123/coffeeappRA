package com.icaro.coffeeapp.scheduler;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.icaro.coffeeapp.service.ProcedimientosAlmacenados;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Cierre automatico del dia.
 *
 * El dia de negocio va de las 01:00 a las 01:00 del dia siguiente: lo que se
 * vende el 03 hasta la 01:00 del 04 pertenece al 03. Por eso la tarea corre a
 * la 01:00 y archiva el dia anterior.
 *
 * Railway reinicia el contenedor cuando despliega o cuando le toca mantenimiento.
 * Si eso pasa justo a la 01:00, ese cierre no ocurre y el dia se queda sin corte
 * para siempre. Por eso cada corrida repasa los ultimos dias y archiva lo que
 * haya quedado vivo; un dia ya archivado no genera nada.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CierreDiaScheduler {

    private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

    /** La 01:00 parte el dia: antes de esa hora, seguimos en el dia anterior. */
    private static final int HORA_CORTE = 1;

    /**
     * Dias hacia atras que se revisan en cada corrida. Cada intento es barato:
     * si ese dia ya no tiene ordenes vivas, el procedimiento no hace nada.
     */
    private static final int DIAS_A_REVISAR = 15;

    private final ProcedimientosAlmacenados procedimientosAlmacenados;

    @Value("${cierre.automatico.enabled:true}")
    private boolean habilitado;

    /** Todos los dias a la 01:00 hora de Ciudad de Mexico. */
    @Scheduled(cron = "0 0 1 * * *", zone = "America/Mexico_City")
    public void cierreProgramado() {
        ejecutarPendientes("cierre programado");
    }

    /**
     * Al arrancar: recupera lo que se haya perdido mientras la app estaba caida.
     * Corre una sola vez, no compite con la tarea de la 01:00 porque el
     * procedimiento no deja cerrar dos veces el mismo dia.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void cierreAlArrancar() {
        ejecutarPendientes("arranque de la aplicacion");
    }

    /** Dia de negocio al que pertenece un momento dado. */
    static LocalDate diaDeNegocio(LocalDateTime momento) {
        return momento.minusHours(HORA_CORTE).toLocalDate();
    }

    private void ejecutarPendientes(String motivo) {
        if (!habilitado) {
            log.info("Cierre automatico deshabilitado por configuracion ({})", motivo);
            return;
        }

        // El dia en curso no se toca: solo los que ya terminaron.
        LocalDate ultimoPorCerrar   = diaDeNegocio(LocalDateTime.now(ZONA)).minusDays(1);
        LocalDate primeroPorCerrar  = ultimoPorCerrar.minusDays(DIAS_A_REVISAR - 1L);

        // Se recorren todos los dias del rango, no solo el ultimo sin cerrar:
        // en El Rincon cortan varias veces al dia, asi que "ya hay un cierre
        // de ese dia" no significa que no queden ordenes por archivar.
        // Un dia sin ordenes vivas simplemente no genera nada.
        for (LocalDate dia = primeroPorCerrar; !dia.isAfter(ultimoPorCerrar); dia = dia.plusDays(1)) {
            cerrarDia(dia, motivo);
        }
    }

    private void cerrarDia(LocalDate dia, String motivo) {
        try {
            Map<String, Object> res = procedimientosAlmacenados
                    .spEjecutarCierreDia("sistema", "Cierre automatico (" + motivo + ")", dia);

            int resultado = res.get("resultado") instanceof Integer i ? i : -1;
            String mensaje = String.valueOf(res.getOrDefault("mensaje", "sin mensaje"));

            // resultado 0 no es falla: es un dia sin ventas o ya cerrado.
            if (resultado == 1)      log.info("Cierre automatico {}: {}", dia, mensaje);
            else if (resultado == 0) log.info("Cierre automatico {} omitido: {}", dia, mensaje);
            else                     log.error("Cierre automatico {} fallo: {}", dia, mensaje);

        } catch (Exception e) {
            // Un dia que truena no debe frenar los siguientes.
            log.error("Cierre automatico {} lanzo excepcion: {}", dia, e.getMessage(), e);
        }
    }
}
