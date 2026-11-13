package com.icaro.coffeeapp.controller;

import java.time.LocalDate;
import java.time.MonthDay;
import java.time.ZoneId;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

/**
 * Decoracion de temporada.
 *
 * Pone un atributo `tema` en todas las pantallas para que la vista solo
 * tenga que decir cual es; nadie mas calcula fechas. Con `auto` el tema
 * sale del calendario:
 *
 *   halloween → 1 de octubre al 2 de noviembre (Halloween y Dia de Muertos)
 *   navidad   → 3 de noviembre al 6 de enero (de Muertos a Reyes)
 *
 * Se puede forzar desde application.properties:
 *   app.temporada=auto        → por calendario (predeterminado)
 *   app.temporada=halloween   → siempre Halloween (util para probar)
 *   app.temporada=navidad     → siempre Navidad (util para probar)
 *   app.temporada=ninguna     → siempre apagado
 *
 * El valor que sale de aqui se usa como nombre de fragmento en las
 * vistas, asi que SOLO puede ser uno de los conocidos: cualquier otra
 * cosa (un error de dedo en la configuracion) se trata como `ninguna`
 * en vez de tumbar la pantalla.
 */
@ControllerAdvice
public class TemporadaAdvice {

    private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

    public static final String NINGUNA = "ninguna";

    /** Una temporada y sus fechas. Si el fin es antes que el inicio, cruza el año. */
    private record Temporada(String tema, MonthDay inicio, MonthDay fin) {
        boolean incluye(MonthDay hoy) {
            if (!fin.isBefore(inicio)) {
                return !hoy.isBefore(inicio) && !hoy.isAfter(fin);
            }
            return !hoy.isBefore(inicio) || !hoy.isAfter(fin);
        }
    }

    private static final List<Temporada> CALENDARIO = List.of(
        new Temporada("halloween", MonthDay.of(10, 1),  MonthDay.of(11, 2)),
        new Temporada("navidad",   MonthDay.of(11, 3),  MonthDay.of(1, 6))
    );

    @Value("${app.temporada:auto}")
    private String configurado;

    @ModelAttribute("tema")
    public String tema() {
        return resolver(configurado, MonthDay.from(LocalDate.now(ZONA)));
    }

    /** Separado del reloj para poder probarlo con cualquier fecha. */
    static String resolver(String configurado, MonthDay hoy) {
        String valor = configurado == null ? "" : configurado.trim().toLowerCase();

        if (valor.isEmpty() || "auto".equals(valor)) {
            return CALENDARIO.stream()
                    .filter(t -> t.incluye(hoy))
                    .map(Temporada::tema)
                    .findFirst()
                    .orElse(NINGUNA);
        }
        return CALENDARIO.stream().anyMatch(t -> t.tema().equals(valor)) ? valor : NINGUNA;
    }
}
