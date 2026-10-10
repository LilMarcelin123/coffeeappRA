package com.icaro.coffeeapp.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

/**
 * Lo que toda pantalla necesita saber antes de dibujarse: en que
 * ambiente corre y de quien es el negocio.
 *
 * Ambiente. Produccion, staging y demo son la misma pantalla pixel por
 * pixel, y asi es como alguien termina cobrando una orden de verdad en
 * el de pruebas, o peor, probando en el de verdad. Por eso solo
 * produccion va sin banda. Se configura con APP_AMBIENTE y el valor por
 * omision es `staging`: si alguien despliega sin configurar nada, lo
 * peor que pasa es una banda de mas, no una pantalla de produccion
 * falsa.
 *
 * Marca. El nombre, el logo y la foto salen de propiedades, no del
 * codigo: el mismo jar sirve para el Rincon, para la Cueva y para el
 * demo que se le ensena a un prospecto. Los valores por omision son los
 * del Rincon para no romper lo que ya estaba desplegado.
 */
@ControllerAdvice
public class AmbienteAdvice {

    @Value("${app.ambiente:staging}")
    private String configurado;

    @Value("${negocio.nombre:Mi Negocio}")
    private String negocioNombre;

    @Value("${negocio.logo:/img/arboledasLogo.jpg}")
    private String negocioLogo;

    @Value("${negocio.portada:/img/IMG_1450.jpg}")
    private String negocioPortada;

    /** true solo cuando el ambiente esta declarado como produccion. */
    @ModelAttribute("esProduccion")
    public boolean esProduccion() {
        return "produccion".equalsIgnoreCase(limpio());
    }

    /** true en el ambiente de demostracion para prospectos. */
    @ModelAttribute("esDemo")
    public boolean esDemo() {
        return "demo".equalsIgnoreCase(limpio());
    }

    /** produccion | demo | staging. Cualquier otra cosa cae en staging. */
    @ModelAttribute("ambiente")
    public String ambiente() {
        if (esProduccion()) return "produccion";
        if (esDemo())       return "demo";
        return "staging";
    }

    /**
     * Nombre del negocio para titulos, encabezados y pies.
     *
     * Ojo: las pantallas que vienen de un controlador que ya mete
     * `nombreNegocio` en el modelo usan ese; el del modelo gana sobre
     * este. Aqui esta para las que no lo traen.
     */
    @ModelAttribute("nombreNegocio")
    public String nombreNegocio() {
        return negocioNombre;
    }

    @ModelAttribute("logoNegocio")
    public String logoNegocio() {
        return negocioLogo;
    }

    @ModelAttribute("portadaNegocio")
    public String portadaNegocio() {
        return negocioPortada;
    }

    private String limpio() {
        return configurado == null ? "" : configurado.trim();
    }
}
