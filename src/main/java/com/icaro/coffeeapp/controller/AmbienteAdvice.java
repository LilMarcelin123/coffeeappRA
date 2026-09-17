package com.icaro.coffeeapp.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

/**
 * En que ambiente corre la aplicacion.
 *
 * Staging y produccion son la misma pantalla pixel por pixel, y asi es
 * como alguien termina cobrando una orden de verdad en el de pruebas, o
 * peor, probando en el de verdad. Por eso staging lleva una banda
 * visible arriba de todo.
 *
 * Se configura con la variable APP_AMBIENTE. El valor por omision es
 * `staging`: si alguien despliega sin configurar nada, lo peor que
 * pasa es una banda de mas, no una pantalla de produccion falsa.
 */
@ControllerAdvice
public class AmbienteAdvice {

    @Value("${app.ambiente:staging}")
    private String configurado;

    /** true solo cuando el ambiente esta declarado como produccion. */
    @ModelAttribute("esProduccion")
    public boolean esProduccion() {
        return "produccion".equalsIgnoreCase(configurado == null ? "" : configurado.trim());
    }

    @ModelAttribute("ambiente")
    public String ambiente() {
        return esProduccion() ? "produccion" : "staging";
    }
}
