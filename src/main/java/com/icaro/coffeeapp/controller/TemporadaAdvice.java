package com.icaro.coffeeapp.controller;

import java.time.LocalDate;
import java.time.MonthDay;
import java.time.ZoneId;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

/**
 * Decoracion de temporada.
 *
 * Pone un atributo `tema` en todas las pantallas para que la vista solo
 * tenga que decir cual es; nadie mas calcula fechas. Con `auto` se
 * enciende solo del 1 de octubre al 2 de noviembre, que en Mexico cubre
 * Halloween y Dia de Muertos.
 *
 * Se puede forzar desde application.properties:
 *   app.temporada=halloween   → siempre encendido (util para probar)
 *   app.temporada=ninguna     → siempre apagado
 *   app.temporada=auto        → por calendario (predeterminado)
 */
@ControllerAdvice
public class TemporadaAdvice {

    private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

    private static final MonthDay INICIO = MonthDay.of(10, 1);
    private static final MonthDay FIN    = MonthDay.of(11, 2);

    @Value("${app.temporada:auto}")
    private String configurado;

    @ModelAttribute("tema")
    public String tema() {
        if (configurado == null || configurado.isBlank() || "auto".equalsIgnoreCase(configurado)) {
            return enTemporada() ? "halloween" : "ninguna";
        }
        return configurado.toLowerCase();
    }

    private boolean enTemporada() {
        MonthDay hoy = MonthDay.from(LocalDate.now(ZONA));
        return !hoy.isBefore(INICIO) && !hoy.isAfter(FIN);
    }
}
