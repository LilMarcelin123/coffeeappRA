package com.icaro.coffeeapp.service;

import org.springframework.stereotype.Service;

/**
 * Construye los mensajes de actualización de estatus que se envían al cliente
 * por WhatsApp. Centraliza las plantillas (única fuente de verdad del texto).
 * Lógica pura, sin dependencias de infraestructura.
 */
@Service
public class MensajeEstatusBuilder {

    public enum Estatus {
        EN_PREPARACION, EN_CAMINO, ENTREGADO, CERRADA;

        public static Estatus desde(String valor) {
            if (valor == null) throw new IllegalArgumentException("Estatus nulo");
            return Estatus.valueOf(valor.trim().toUpperCase());
        }
    }

    public String construir(Estatus estatus, String tiempoEstimado, String telefonoRepartidor) {
        final String tiempo = limpiar(tiempoEstimado);
        final String tel    = limpiar(telefonoRepartidor);

        switch (estatus) {
            case EN_PREPARACION:
                return "Hola 👋, el estatus de tu orden es: *EN PREPARACIÓN*. ⏱ Tiempo estimado: "
                        + (tiempo.isEmpty() ? "el indicado por la cafetería" : tiempo) + ".";
            case EN_CAMINO: {
                StringBuilder sb = new StringBuilder("Hola 👋, tu pedido ya va *EN CAMINO* 🚗.");
                if (!tiempo.isEmpty()) sb.append(" ⏱ Tiempo estimado: ").append(tiempo).append('.');
                if (!tel.isEmpty())    sb.append(" 📞 Contacto del repartidor: ").append(tel);
                return sb.toString();
            }
            case ENTREGADO: {
                StringBuilder sb = new StringBuilder("¡Tu pedido llegó! 🎉 El repartidor ya está en tu ubicación.");
                if (!tel.isEmpty()) sb.append(" 📞 Contacto: ").append(tel);
                return sb.toString();
            }
            case CERRADA:
                return "✨ Gracias por tu pedido. Esperamos que disfrutes tu comida ❤️ ¡Te esperamos pronto!";
            default:
                throw new IllegalArgumentException("Estatus no soportado: " + estatus);
        }
    }

    private String limpiar(String s) {
        return (s == null) ? "" : s.trim();
    }
}
