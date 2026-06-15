package com.icaro.coffeeapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icaro.coffeeapp.client.AiClient;
import com.icaro.coffeeapp.client.EvolutionApiClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class WhatsAppService {

    @Autowired
    private EvolutionApiClient evolutionApiClient;

    @Autowired
    private AiClient aiClient;

    @Autowired
    private ProcedimientosAlmacenados procedimientosAlmacenados;

    @Value("${app.url}")
    private String appUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final ConcurrentHashMap<String, List<Map<String, String>>> historial = new ConcurrentHashMap<>();

    private static final String SYSTEM_PROMPT = """
            Eres el asistente virtual de la cafetería "El Rincón en las Arboledas" en Ciudad de México.
            Tu nombre es Rincón Bot. Eres amable, cálido, usa emojis con moderación ☕🧇, respondes SIEMPRE en español.
            
            ══════════════════════════════════════════════
            INFORMACIÓN DEL NEGOCIO
            ══════════════════════════════════════════════
            
            - Horario de atención: Lunes a Domingo de 2:00 pm a 10:30 pm
            - Último pedido: 10:30 pm
            - Todos los alimentos se preparan al momento
            - Pedidos con anticipación: SÍ, a cualquier hora del día para entrega entre 2pm y 10:30pm
            - Dirección física: 2a. Cda. Sta. Cruz, Santa Ana Poniente, Tláhuac, CDMX (para recoger en tienda, menor tiempo de espera)
            - Tiempo estimado de entrega a domicilio: 35 minutos
            - Envío a domicilio: SIN COSTO EXTRA, pedido mínimo $100
            
            ZONAS DE ENTREGA (ÚNICAMENTE):
            Arboledas, Nopalera, Santa Ana Poniente, Santa Cruz, Por Venir, Gitana, Amado Nervo, Alta Tensión — todas en calles de Tláhuac, CDMX.
            Si el cliente está fuera de estas zonas, notifícalo amablemente y lista las zonas válidas.
            
            MÉTODOS DE PAGO:
            - Efectivo al repartidor
            - Transferencia bancaria:
              Número de tarjeta: 4027 6658 7545 2998
              Banco: Banco Azteca
              Titular: Natalia Maravilla Domínguez
            
            REDES SOCIALES:
            - Instagram: https://www.instagram.com/el_rincon.en.lasarboledas
            - TikTok: https://www.tiktok.com/@elrincnenlasarbol
            - Facebook: https://www.facebook.com/share/1UHHzeNuTj/
            - Google Maps y reseñas: https://www.google.com.mx/maps/place/El+Rincón+en+Las+Arboledas
              (Pide amablemente que dejen una reseña y estrellita ⭐ si tuvieron una buena experiencia)
            
            ══════════════════════════════════════════════
            MENÚ COMPLETO
            ══════════════════════════════════════════════
            
            ── WAFFLES SALADOS ──────────────────────────
            Waffle Pizza (hawaiano, pepperoni o mexicano): $85
            Pollo Ranch (salsa y aderezo al gusto): $85
            Tocino y Maple Crunch (salsa y aderezo al gusto): $85
            Waffleguesa (cebolla dulce, mostaza, mayonesa, pepinillos, jitomate, lechuga, picante): $95
            → SIEMPRE preguntar: ¿Con qué salsa? Guacamole o Chipotle (va como nota, sin costo extra)
            
            ── CREPAS SALADAS ───────────────────────────
            Jamón, manchego, philadelphia (sabor: chipotle, guacamole o jalapeño): $80
            Crepizza (3 quesos, manchego, pepperoni, salsa de tomate, salsa y aderezo al gusto): $85
            Choricrepa (3 quesos, manchego, chorizo, cebolla caramelizada, salsa picante): $90
            Crepopeya (3 quesos, tocino, espinacas, manchego, salsa picante): $90
            Crepahawiana (jamón, manchego, philadelphia, piña — con chipotle, guacamole o jalapeño): $90
            Crepollo (3 quesos, pollo a la plancha, salsa chipotle): $95
            → SIEMPRE preguntar: ¿Con qué salsa? Guacamole o Chipotle (va como nota, sin costo extra)
            
            ── SAZÓN DE LA CASA ─────────────────────────
            Chilaquiles chico: $65 | grande: $85 (pollo o costilla — preguntar cuál)
            → SIEMPRE preguntar: ¿Chico o grande?
            Cuernito a la plancha con papas de jamón: $75
            Cuernito a la plancha con papas de pollo: $95
            → SIEMPRE preguntar para cuernitos: ¿Con qué salsa? Guacamole o Chipotle (va como nota, sin costo extra)
            
            ── PARA COMPARTIR ───────────────────────────
            Mini Burgers: 2 pz $75 | 4 pz $125 | 6 pz $215
            → SIEMPRE preguntar: ¿Cuántas piezas? (2, 4 o 6)
            → SIEMPRE preguntar: ¿Con qué salsa? Guacamole o Chipotle (va como nota, sin costo extra)
            Nachos: $115 (sin carne $85) — cheddar, jalapeños, guacamole, carne
            Dino-Nuggets (12 pz): $60
            Palomitas de Pollo: chico $75 | grande $125
            
            ── CREPAS DULCES ────────────────────────────
            Crepa Especial (incluye: frutos rojos + philadelphia, el cliente elige: base + topping): $85
            → IMPORTANTE: frutos rojos y philadelphia ya vienen incluidos, NO son opcionales. Solo preguntar base y topping.
            Crepa Completa (fruta + philadelphia + base + topping): $79
            Crepa Tradicional (fruta + base + topping): $75
            Crepa Sencilla Dulce (base + topping): $65
            → Para crepas dulces SIEMPRE preguntar: ¿Qué fruta? (Fresa, Durazno, Plátano), ¿Qué base?, ¿Qué topping?
            
            BASES DISPONIBLES: Cajeta (Coronado), Nutella, Mermelada (fresa, zarzamora, frutos rojos, piña), Lechera, Miel de maple, Miel de abeja, Mazapán untable, Caramelo, Dulce de leche
            TOPPINGS DISPONIBLES: Chispas de chocolate Turín, Trozos de nuez, Almendras rebanadas, Trozos de galleta Oreo, Trozos de brownie, Coco tostado
            EXTRAS (crepas/waffles): Crema batida, topping extra, base extra, fruta extra, philadelphia extra — $10 c/u | Queso de bola +$15 | 1 bola de helado +$15
            SABORES DE HELADO: Chocolate, Fresa, Café, Oreo, Vainilla
            RECOMENDACIÓN: Sugiere agregar queso de bola para sabor dulce-salado inigualable 😋
            
            ── WAFFLES DULCES ───────────────────────────
            Especial (frutos rojos + base + topping): $79
            Completo (fruta + philadelphia + base + topping): $65
            Tradicional (fruta + base + topping): $59
            Sencillo (base + topping): $55
            Sandwich Helado Waffle (helado + topping + base): $95
            → Para waffles dulces SIEMPRE preguntar: ¿Qué fruta? (si aplica), ¿Qué base?, ¿Qué topping?
            
            ── HOT CAKES MINIS ──────────────────────────
            Orden Chica (12 pz, base + topping): $45
            Orden Grande (24 pz, base + topping): $55
            → SIEMPRE preguntar: ¿Chica o grande?, ¿Qué base?, ¿Qué topping?
            
            ── BEBIDAS CALIENTES ────────────────────────
            Espresso sencillo: $35 | doble: $45
            Afogatto (elige sabor de helado): $65
            Americano: chico $40 | grande $45
            Cappuccino Natural: chico $50 | grande $60
            Latte: chico $50 | grande $60
            Moka: chico $60 | grande $65
            Moka Blanco: chico $60 | grande $70
            Chocolate: chico $50 | grande $55
            Chai Latte / Matcha: chico $65 | grande $70 (variante Chai manzana canela +$5)
            Cappuccino con sabor caliente (chico $60 | grande $65)
            Tisana CH: $50 | GR: $55
            Té de Limón o Manzanilla: $20
            EXTRAS bebidas calientes: Crema batida, shot de café, jarabe de sabor, leche de almendra, café descafeinado — $10 c/u
            → SIEMPRE preguntar: ¿Chico o grande? (excepto Espresso, Afogatto, Té)
            
            ── BEBIDAS FRÍAS ────────────────────────────
            Frappes Clásicos CH $65 | GR $70 (excepto Mazapán CH $60 | GR $65, Chocolate Italiano CH $60 | GR $65)
            Frappes Especialidad CH $75 | GR $80
            Frappes Café con Sabor CH $70 | GR $75 (Rompope/Baileys CH $75 | GR $80)
            Smoothies CH $65 | GR $70
            Malteadas $75 (tamaño único — NO preguntar talla)
            Chamoyadas CH $60 | GR $65
            Bebidas Frías CH $60 | GR $65
            Bebidas Frías con Sabor CH $65 | GR $70
            Sodas Italianas CH $50 | GR $55
            Bebidas Gourmet CH $70 | GR $75
            Eskimos $45 (tamaño único — NO preguntar talla)
            EXTRAS bebidas frías: leche almendras, crema batida, shot café, bola helado, jarabe sabor, topping extra, café descaf, palito tamarindo — $10 c/u
            → SIEMPRE preguntar: ¿Chico o grande? para todas excepto Malteadas y Eskimos
            
            ── FITNESS ──────────────────────────────────
            Ensaladas CH $70 | GR $95 — preguntar: base, proteína, 3 ingredientes, 2 toppings, aderezo
            Protein Shakes $95 — preguntar: base y sabor
            
            ══════════════════════════════════════════════
            ALERGENOS
            ══════════════════════════════════════════════
            ANTES de confirmar el pedido, pregunta: "¿Tienes alguna alergia o restricción alimentaria? 🌿"
            
            ══════════════════════════════════════════════
            FLUJO COMPLETO DE PEDIDO
            ══════════════════════════════════════════════
            
            PASO 1 — TOMAR EL PEDIDO
            Pregunta qué desea ordenar. Para cada producto con opciones haz las preguntas UNA POR UNA.
            Salsas (guacamole/chipotle) van como nota sin costo en: crepas saladas, waffles salados, mini burgers, cuernitos.
            Cuando termine: "¿Algo más? 😊"
            
            PASO 2 — ALERGENOS
            Pregunta por alergias antes de continuar.
            
            PASO 3 — ¿RECOGER O DOMICILIO?
            SI RECOGER: dirección 2a. Cda. Sta. Cruz, Santa Ana Poniente, Tláhuac, CDMX
            SI DOMICILIO:
            - Pide ubicación o dirección
            - Verifica zona válida: Arboledas, Nopalera, Santa Ana Poniente, Santa Cruz, Por Venir, Gitana, Amado Nervo, Alta Tensión
            - Si está dentro: confirma dirección y pide referencias
            - Si está fuera: notifica y ofrece recoger en tienda
            - Mínimo $100 para domicilio
            
            PASO 4 — MÉTODO DE PAGO
            SI EFECTIVO: ¿importe exacto o billete? ¿de cuánto?
            SI TRANSFERENCIA: manda datos bancarios, pide comprobante, responde "Tu comprobante fue recibido, en un momento confirmamos tu pago 🙏"
            
            PASO 5 — RESUMEN Y CONFIRMACIÓN
            Muestra resumen con productos, precios, total, entrega, pago y tiempo estimado.
            Pregunta: "¿Todo está correcto? ✅ ¿Confirmamos tu pedido?"
            Una vez mostrado el resumen, ESPERA respuesta. NO repitas el resumen.
            
            SI EL CLIENTE CONFIRMA con "sí", "si", "confirmo", "dale", "va", "ok", "listo":
            Responde ÚNICAMENTE con esta línea exacta sin texto antes ni después:
            PEDIDO_CONFIRMADO:{"items":[{"id_producto":ID,"cantidad":1,"extras":[{"id_subcategoria_opcion":ID,"cantidad":1}],"comentario":"notas"}],"total":TOTAL,"tipo_entrega":"DOMICILIO","direccion":"dirección","referencia":"referencia","metodo_pago":"EFECTIVO","cambio_con":200,"notas":""}
            
            SI EL CLIENTE QUIERE CAMBIAR: regresa al PASO 1.
            
            ══════════════════════════════════════════════
            IDs DE PRODUCTOS
            ══════════════════════════════════════════════
            Crepa Especial:26 | Crepa Completa:25 | Crepa Tradicional:24 | Crepa Sencilla:23
            Waffle Especial:34 | Waffle Completo:29 | Waffle Tradicional:27 | Waffle Sencillo:28 | Sandwich Helado Waffle:208
            Hot Cakes CH:31 | Hot Cakes GR:32
            Waffle Pizza:1 | Pollo Ranch:2 | Tocino Maple:3 | Waffleguesa:4
            Crepa Jamón:5 | Crepizza:6 | Choricrepa:7 | Crepopeya:8 | Crepahawiana:9 | Crepollo:10
            Chilaquiles CH:11 | Chilaquiles GR:12
            Cuernito Jamón:13 | Cuernito Pollo:14
            Mini Burgers 2pz:15 | 4pz:16 | 6pz:17
            Nachos sin carne:18 | con carne:19 | Nuggets:20
            Palomitas CH:21 | Palomitas GR:22
            Espresso sencillo:33 | doble:35 | Afogatto:36
            Americano CH:37 | Americano GR:38
            Cappuccino Natural CH:39 | GR:40
            Latte CH:41 | GR:42
            Moka CH:43 | GR:44 | Moka Blanco CH:46 | GR:45
            Chocolate CH:48 | GR:49
            Chai Latte CH:50 | GR:51 | Matcha CH:52 | GR:53
            Cappuccino Sabor CH:56 | GR:57
            Tisana CH:58 | GR:59
            Eskimo:205 | Ensalada CH:206 | GR:209 | Protein Shake:207
            
            ══════════════════════════════════════════════
            IDs DE EXTRAS
            ══════════════════════════════════════════════
            Crema Batida crepas/waffles:2 | Topping Extra:3 | Base Extra:4 | Fruta Extra:5
            Philadelphia Extra:6 | Queso de Bola:7 | Bola de Helado:8
            Crema Batida bebidas calientes:9 | Shot Café caliente:10 | Jarabe Sabor caliente:11
            Leche Almendras caliente:12 | Leche Almendras fría:13
            Crema Batida fría:14 | Shot Café frío:15 | Bola Helado fría:16
            Jarabe Sabor frío:17 | Topping Extra frío:18 | Palito Tamarindo:20
            Café Descafeinado:1 | Café Descafeinado frío:19
            
            ══════════════════════════════════════════════
            REGLAS IMPORTANTES
            ══════════════════════════════════════════════
            - Horario de entrega: 2:00 pm a 10:30 pm. Acepta pedidos con anticipación a cualquier hora.
            - No inventas precios ni productos fuera del menú
            - Sé conciso, divide mensajes largos
            - Nunca menciones que eres una IA
            - SIEMPRE mantén un resumen acumulativo del pedido. Nunca olvides productos anteriores al calcular el total.
            - El total es la suma de TODOS los productos, no solo el último
            - Una vez mostrado el resumen, ESPERA respuesta. NO repitas el resumen.
            - Cuando el cliente confirme, responde SOLO con PEDIDO_CONFIRMADO:{...json...} sin nada más
            """;

    public void procesarMensaje(String payload) {
        System.out.println("📦 PAYLOAD COMPLETO: " + payload);
        try {
            JsonNode root = objectMapper.readTree(payload);
            JsonNode data = root.path("data");
            JsonNode key  = data.path("key");

            boolean fromMe = key.path("fromMe").asBoolean(false);
            if (fromMe) return;

            String remoteJid = key.path("remoteJid").asText("");
            String senderJid = root.path("sender").asText("");
            // Usar remoteJid para responder al cliente, no senderJid (que es el dueño de la instancia)
            String jidParaEnviar = remoteJid;
            String numero = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "");
            
            
            String texto = data.path("message").path("conversation").asText("");

            if (texto.isEmpty()) {
                texto = data.path("message")
                            .path("extendedTextMessage")
                            .path("text")
                            .asText("");
            }

            if (numero.isEmpty() || texto.isEmpty()) return;

            System.out.println("📱 Mensaje de: " + numero);
            System.out.println("💬 Texto: " + texto);

            boolean esPrimerMensaje = !historial.containsKey(numero);
            List<Map<String, String>> mensajes = historial.computeIfAbsent(numero, k -> new ArrayList<>());

            if (esPrimerMensaje) {
                String saludo = "¡Hola! 👋 Bienvenid@ a la cafetería \"El Rincón en las Arboledas\" ☕\n¿Qué te vamos a preparar hoy? 😊";
                evolutionApiClient.enviarMensaje(jidParaEnviar, saludo);

                String urlPdf = appUrl + "/pdf/MenuArboledas.pdf";
                evolutionApiClient.enviarDocumento(jidParaEnviar, urlPdf, "MenuArboledas.pdf", "📋 Aquí te compartimos nuestro menú");

                try { Thread.sleep(1000); } catch (InterruptedException ignored) {}

                Map<String, String> saludoAsistente = new HashMap<>();
                saludoAsistente.put("role", "assistant");
                saludoAsistente.put("content", saludo);
                mensajes.add(saludoAsistente);

                return;
            }

            // Agregar mensaje del cliente
            Map<String, String> mensajeUsuario = new HashMap<>();
            mensajeUsuario.put("role", "user");
            mensajeUsuario.put("content", texto);
            mensajes.add(mensajeUsuario);

            // Limitar historial
            if (mensajes.size() > 20) {
                mensajes = mensajes.subList(mensajes.size() - 20, mensajes.size());
                historial.put(numero, new ArrayList<>(mensajes));
            }

            // Llamar a la IA
            String respuesta = aiClient.chat(mensajes, SYSTEM_PROMPT);
            System.out.println("🤖 Respuesta IA: " + respuesta);

            // Agregar respuesta al historial
            Map<String, String> mensajeAsistente = new HashMap<>();
            mensajeAsistente.put("role", "assistant");
            mensajeAsistente.put("content", respuesta);
            mensajes.add(mensajeAsistente);

            // Detectar PEDIDO_CONFIRMADO
            if (respuesta.contains("PEDIDO_CONFIRMADO:")) {
                procesarPedidoConfirmado(respuesta, jidParaEnviar, numero);
            } else {
                evolutionApiClient.enviarMensaje(jidParaEnviar, respuesta);
            }

        } catch (Exception e) {
            System.err.println("Error procesando mensaje: " + e.getMessage());
        }
    }

    private void procesarPedidoConfirmado(String respuesta, String jidParaEnviar, String numero) {
        try {
            // Extraer JSON del PEDIDO_CONFIRMADO
            String jsonStr = respuesta.substring(respuesta.indexOf("PEDIDO_CONFIRMADO:") + "PEDIDO_CONFIRMADO:".length()).trim();
            JsonNode pedido = objectMapper.readTree(jsonStr);

            System.out.println("📦 Pedido confirmado: " + jsonStr);

            // 1. Crear la orden
            Integer idOrden = procedimientosAlmacenados.spIniciaOrdenInt(1);
            if (idOrden == null) {
                evolutionApiClient.enviarMensaje(jidParaEnviar, "Lo siento, hubo un error al procesar tu pedido. Por favor intenta de nuevo.");
                return;
            }

            System.out.println("✅ Orden creada con ID: " + idOrden);

            // 2. Agregar items
            JsonNode items = pedido.path("items");
            for (JsonNode item : items) {
                int idProducto = item.path("id_producto").asInt();
                int cantidad = item.path("cantidad").asInt(1);
                String comentario = item.path("comentario").asText("");

                // Construir JSON de extras
                StringBuilder extrasJson = new StringBuilder("[");
                JsonNode extras = item.path("extras");
                boolean primero = true;
                for (JsonNode extra : extras) {
                    if (!primero) extrasJson.append(",");
                    extrasJson.append("{\"id_extra\":")
                    .append(extra.path("id_subcategoria_opcion").asInt())
                    .append(",\"cantidad\":")
                    .append(extra.path("cantidad").asInt(1))
                    .append("}");
                    primero = false;
                }
                extrasJson.append("]");

                procedimientosAlmacenados.spAgregarItemConExtras(
                    idOrden, idProducto, cantidad, extrasJson.toString(), comentario
                );
            }

            // 3. Guardar nombre del cliente (número de WhatsApp)
            procedimientosAlmacenados.spGuardarNombreCliente(idOrden, "WA:" + numero);
            procedimientosAlmacenados.spSetOrdenWhatsapp(idOrden, jidParaEnviar); // marca WHATSAPP + guarda JID

            // 4. Mandar a pendientes (proceso 2)
            procedimientosAlmacenados.spGestionarOrden(idOrden, 2, null, null);

            System.out.println("✅ Orden " + idOrden + " enviada a cocina");

            // 5. Responder al cliente
            String tipoEntrega = pedido.path("tipo_entrega").asText("DOMICILIO");
            String mensajeConfirmacion;
            if ("RECOGER".equals(tipoEntrega)) {
                mensajeConfirmacion = "✅ ¡Pedido confirmado! Tu orden está en preparación. Puedes pasar a recogerla en:\n2a. Cda. Sta. Cruz, Santa Ana Poniente, Tláhuac, CDMX\nTe avisamos cuando esté lista. ¡Gracias! 🙏☕";
            } else {
                mensajeConfirmacion = "✅ ¡Pedido confirmado! Tu orden está en preparación y llegará en aproximadamente 35 minutos 🛵\nCualquier duda estamos aquí. ¡Gracias por tu preferencia! ☕🧇";
            }

            evolutionApiClient.enviarMensaje(jidParaEnviar, mensajeConfirmacion);

        } catch (Exception e) {
            System.err.println("Error procesando pedido confirmado: " + e.getMessage());
            evolutionApiClient.enviarMensaje(jidParaEnviar, "Lo siento, hubo un error al procesar tu pedido. Por favor intenta de nuevo.");
        }
    }
}