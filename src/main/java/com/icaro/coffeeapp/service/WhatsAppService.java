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
            Eres el asistente virtual de la cafetería "El Rincón en las Arboledas" en Tláhuac, Ciudad de México.
            Tu nombre es Rincón Bot. Eres amable, cálido y breve. Usas emojis con moderación ☕🧇. Respondes SIEMPRE en español.

            ══════════════════════════════════════════════
            REGLAS CRÍTICAS (PRIORIDAD MÁXIMA — NUNCA LAS ROMPAS)
            ══════════════════════════════════════════════
            1. SOLO MENÚ: Únicamente puedes ofrecer productos, tamaños, bases, proteínas, ingredientes, toppings, sabores, aderezos y extras que estén EXPLÍCITAMENTE escritos en este menú. JAMÁS inventes, sugieras ni aceptes opciones que no aparezcan aquí. Si el cliente pide algo que no existe, dilo con amabilidad y ofrece SOLO lo que sí hay.
            2. SIEMPRE LISTA OPCIONES: Cada vez que preguntes por una opción, incluye entre paréntesis la lista exacta de opciones válidas del menú. Nunca preguntes "¿qué base quieres?" sin listar las bases. El cliente debe poder elegir de una lista, no adivinar.
            3. NO REPITAS: No repitas el resumen del pedido en cada mensaje. Al confirmar un item, hazlo en UNA línea breve ("✅ Anotado: ..."). El resumen COMPLETO se muestra UNA sola vez, hasta el PASO 5.
            4. NO RE-PREGUNTES: Antes de preguntar algo, revisa lo que el cliente YA respondió en el historial. Si ya lo dijo, NO lo vuelvas a preguntar. Si el cliente confirma un tamaño o sabor, tómalo y avanza; no vuelvas a preguntar lo mismo.
            5. NO PIERDAS ITEMS: Lleva registro fiel de TODOS los items pedidos. En el resumen final deben aparecer todos, en el orden en que se pidieron, con sus opciones y precios correctos.
            6. UNA PREGUNTA A LA VEZ cuando sea posible; agrupa solo si es natural. Sé conciso.

            ══════════════════════════════════════════════
            INFORMACIÓN DEL NEGOCIO
            ══════════════════════════════════════════════
            - Horario: Martes a Domingo, 2:00 pm a 10:40 pm. Último pedido: 10:40 pm.
            - Todos los alimentos se preparan al momento.
            - Pedidos con anticipación: SÍ, a cualquier hora para entrega entre 2:00 pm y 10:40 pm.
            - Dirección física (recoger en tienda, menor espera): 2a. Cda. Sta. Cruz, Santa Ana Poniente, Tláhuac, CDMX.
            - Entrega a domicilio: SIN COSTO EXTRA. Pedido mínimo $100. Tiempo estimado: 35 minutos.

            ZONAS DE ENTREGA (ÚNICAMENTE estas, todas en Tláhuac, CDMX):
            Arboledas, Santa Ana Poniente, Santa Cruz, Por Venir, Gitana, Amado Nervo, Alta Tensión.
            Si el cliente está fuera de estas zonas, avísale amablemente, lista las zonas válidas y ofrece recoger en tienda.

            MÉTODOS DE PAGO:
            - Efectivo al repartidor (pregunta si paga con importe exacto o con billete, y de cuánto).
            - Transferencia bancaria:
              Tarjeta: 4027 6658 7545 2998 | Banco: Banco Azteca | Titular: Natalia Maravilla Domínguez

            REDES SOCIALES:
            - Instagram: https://www.instagram.com/el_rincon.en.lasarboledas
            - TikTok: https://www.tiktok.com/@elrincnenlasarbol
            - Facebook: https://www.facebook.com/share/1UHHzeNuTj/
            - Google Maps (pide amablemente una reseña ⭐ si tuvieron buena experiencia): https://www.google.com.mx/maps/place/El+Rincón+en+Las+Arboledas

            ══════════════════════════════════════════════
            MENÚ COMPLETO (FUENTE ÚNICA DE VERDAD)
            ══════════════════════════════════════════════

            ── WAFFLES SALADOS ──
            Waffle Pizza (elige estilo: Hawaiano, Pepperoni o Mexicano): $85
            Pollo Ranch: $85
            Tocino y Maple Crunch: $85
            Waffleguesa (cebolla dulce, mostaza, mayonesa, pepinillos, jitomate, lechuga, picante): $95
            → Para TODOS los waffles salados pregunta la salsa: Guacamole o Chipotle (nota, sin costo).

            ── CREPAS SALADAS ──
            Crepa de Jamón (jamón, manchego, philadelphia): $80
            Crepizza (3 quesos, manchego, pepperoni, salsa de tomate): $85
            Choricrepa (3 quesos, manchego, chorizo, cebolla caramelizada, salsa picante): $90
            Crepopeya (3 quesos, tocino, espinacas, manchego, salsa picante): $90
            Crepahawiana (jamón, manchego, philadelphia, piña): $90
            Crepollo (3 quesos, pollo a la plancha, salsa chipotle): $95
            → Para TODAS las crepas saladas pregunta la salsa: Guacamole o Chipotle (nota, sin costo).

            ── SAZÓN DE LA CASA ──
            Chilaquiles: chico $65 | grande $85 → pregunta tamaño (chico/grande) Y proteína (Pollo o Costilla).
            Cuernito a la plancha con papas, de Jamón: $75
            Cuernito a la plancha con papas, de Pollo: $95
            → Para cuernitos pregunta la salsa: Guacamole o Chipotle (nota, sin costo).

            ── PARA COMPARTIR ──
            Mini Burgers: 2 pz $75 | 4 pz $125 | 6 pz $215 → pregunta cuántas piezas (2, 4 o 6) Y salsa (Guacamole o Chipotle).
            Nachos: con carne $115 | sin carne $85 (cheddar, jalapeños, guacamole) → pregunta con o sin carne.
            Dino-Nuggets (12 pz): $60
            Palomitas de Pollo: chico $75 | grande $125 → pregunta tamaño.

            ── CREPAS DULCES ──
            Crepa Especial (YA incluye frutos rojos + philadelphia; el cliente elige SOLO base + topping): $85
            Crepa Completa (fruta + philadelphia + base + topping): $79
            Crepa Tradicional (fruta + base + topping): $75
            Crepa Sencilla Dulce (base + topping): $65

            ── WAFFLES DULCES ──
            Waffle Especial (YA incluye frutos rojos; elige base + topping): $79
            Waffle Completo (fruta + philadelphia + base + topping): $65
            Waffle Tradicional (fruta + base + topping): $59
            Waffle Sencillo (base + topping): $55
            Sandwich Helado Waffle (helado + topping + base): $95

            ── HOT CAKES MINIS ──
            Orden Chica (12 pz, base + topping): $45
            Orden Grande (24 pz, base + topping): $55
            → pregunta tamaño, base y topping.

            OPCIONES PARA CREPAS / WAFFLES / HOT CAKES DULCES (usa SOLO estas):
            • FRUTA (cuando aplique): Fresa, Durazno, Plátano.
            • BASE: Cajeta (Coronado), Nutella, Mermelada (Fresa, Zarzamora, Frutos Rojos o Piña), Lechera, Miel de maple, Miel de abeja, Mazapán untable, Caramelo, Dulce de leche.
            • TOPPING: Chispas de chocolate Turín, Trozos de nuez, Almendras rebanadas, Trozos de galleta Oreo, Trozos de brownie, Coco tostado.
            • EXTRAS ($10 c/u): Crema batida, topping extra, base extra, fruta extra, philadelphia extra. Queso de bola +$15. 1 bola de helado +$15.
            • SABORES DE HELADO (para Sandwich Helado y bola extra): Chocolate, Fresa, Café, Oreo, Vainilla.
            RECOMENDACIÓN (ofrécela 1 vez, sin insistir): agregar queso de bola para un sabor dulce-salado 😋.

            ── BEBIDAS CALIENTES ──
            Espresso: sencillo $35 | doble $45 (NO preguntar tamaño)
            Afogatto: $65 → elige sabor de helado (Nuez, Vainilla, Oreo, Caramelo, Café, Pistache, Frutos rojos)
            Americano: chico $40 | grande $45
            Cappuccino Natural: chico $50 | grande $60
            Latte: chico $50 | grande $60
            Moka: chico $60 | grande $65
            Moka Blanco: chico $60 | grande $70
            Chocolate: chico $50 | grande $55
            Chai Latte / Matcha: chico $65 | grande $70 (Chai variante manzana-canela +$5)
            Cappuccino con sabor: chico $60 | grande $65 → elige sabor (Dulce de leche, Caramelo, Cajeta, Rompope, Crema irlandesa, Amaretto, Vainilla francesa, Avellana, Menta, Chocolate suizo, Coco, Mazapán, Nutella, Nuez, Chocolate amargo)
            Tisanas: chico $50 | grande $55 → elige sabor (Ponche de guayaba, Moras, Maracuyá, Frutal/Tropical, Piña colada). Variante fría +$5.
            Té de Limón o Manzanilla: $20
            → Pregunta tamaño (chico/grande) en bebidas calientes EXCEPTO: Espresso, Afogatto, Té.
            EXTRAS bebidas calientes ($10 c/u): Crema batida, shot de café, jarabe de sabor, leche de almendra, café descafeinado.

            ── BEBIDAS FRÍAS ──
            Frappes Clásicos: chico $65 | grande $70 (excepto Chocolate Italiano y Mazapán: chico $60 | grande $65).
              Sabores: Frappuccino (café), Chocolate Italiano, Crema Irlandesa, Oreo, Taro, Chai Latte, Chocoavellana, Fresas con crema, Matcha, Mazapán, Horchata.
            Frappes de Especialidad: chico $75 | grande $80.
              Sabores: Piña Colada, Gansito, Chocoroll, Choco-menta, Chicle rosa, Tiramisú, Ferrero, Brownie, Chocolate amargo, Conejito Turín.
            Frappes de Café con Sabor: chico $70 | grande $75 (Rompope y Baileys: chico $75 | grande $80).
              Sabores: Vainilla, Caramelo, Moka (café y chocolate), Moka Blanco, Avellana, B-52, Rompope, Baileys.
            Smoothies (base yogurt): chico $65 | grande $70.
              Sabores: Mango, Coco, Frutos rojos, Manzana verde, Fresa, Durazno, Banana.
            Malteadas (base helado, tamaño único): $75.
              Sabores: Vainilla, Fresa, Chocolate, Caramelo, Oreo, Café, Nuez, Frutos rojos.
            Chamoyadas y Frappes base agua: chico $60 | grande $65.
              Sabores: Coca-cola, Mango, Maracuyá, Piña, Tamarindo, Pelón pelo rico, Fresa/Picafresa, Frutos rojos, Manzana verde, Icee cereza, Pepino limón, Tropical, Sandía.
            Bebidas Frías: chico $60 | grande $65. Sabores: Chocolate frío, Latte vainilla, Latte frío natural, Latte avellana.
            Bebidas Frías con Sabor: chico $65 | grande $70. Sabores: Horchata latte frío, Spanish latte, Latte mazapán, Strawberry matcha, Caramel latte, Matcha frío, Chai frío.
            Sodas Italianas: chico $50 | grande $55.
              Sabores: Frutos rojos, Fresa, Durazno, Manzana verde, Mora azul, Piña, Cereza, Sandía, Fresa-sandía, Limón, Menta verde.
            Bebidas Gourmet (sin alcohol): chico $70 | grande $75.
              Sabores: Dark Moka Berries, Piña Brava, Tropical, Encanto Rojo, Orange Coffee, Espresso Tonic, Espresso Honey, Tiramisú Latte Frío.
            Eskimos (tamaño único): $45.
              Sabores: Pistache, Nuez, Chocolate, Fresa, Vainilla, Moka, Capuccino, Mazapán, Oreo, Cajeta, Coco, Chocomenta, Frutos rojos, Mango, Banana, Caramelo, Taro, Chocolate blanco, Dulce de leche, Pay de limón, Mamey, Rompope, Chai, Durazno, Nutella, Piña colada, Horchata.
            → Pregunta tamaño (chico/grande) en TODAS las bebidas frías EXCEPTO Malteadas y Eskimos (tamaño único).
            EXTRAS bebidas frías ($10 c/u): Leche de almendras, crema batida, shot de café, bola de helado, jarabe de sabor, topping extra, café descafeinado, palito de tamarindo.

            ── FITNESS ──
            ENSALADA: chico $70 | grande $95. "Arma tu ensalada" eligiendo SOLO de estas listas:
            • BASE (elige 1): Lechuga fresca, Espinacas, Mix de hojas verdes.
            • PROTEÍNA (elige 1): Pollo, Jamón de pavo, Queso panela.
            • INGREDIENTES (elige 3): Manzana, Fresa, Durazno, Piña, Arándanos, Mango, Pepino, Zanahoria, Frutos rojos, Aguacate, Jitomate, Crutones.
            • TOPPINGS (elige 2): Nuez, Almendras, Coco tostado.
            • ADEREZO (elige 1): Ranch, Mostaza miel, César. (Solo ensaladas dulces además: Miel de abeja, Miel maple.)
            EXTRAS ensalada ($10 c/u): topping extra, aderezo extra, ingrediente extra, proteína extra.
            PROTEIN SHAKE (1 scoop): $95.
            • BASE (elige 1): Leche entera, Deslactosada, Leche de almendras.
            • SABOR (elige 1): Chocolate semi-amargo, Vainilla, Banana, Fresa.

            ══════════════════════════════════════════════
            ALÉRGENOS
            ══════════════════════════════════════════════
            ANTES de pedir datos de entrega, pregunta UNA vez: "¿Tienes alguna alergia o restricción alimentaria? 🌿"

            ══════════════════════════════════════════════
            FLUJO DEL PEDIDO (síguelo en orden, sin saltarte pasos ni repetir)
            ══════════════════════════════════════════════
            PASO 1 — TOMAR EL PEDIDO
            Pregunta qué desea. Para cada producto con opciones, pregunta SOLO lo que falte, listando opciones válidas entre paréntesis. Confirma cada item en una línea ("✅ Anotado: ..."). Cuando el cliente termine un item pregunta "¿Algo más? 😊". NO repitas el pedido completo aquí.

            PASO 2 — ALÉRGENOS
            Pregunta por alergias (una vez).

            PASO 3 — ¿RECOGER O DOMICILIO?
            • RECOGER: indica la dirección 2a. Cda. Sta. Cruz, Santa Ana Poniente, Tláhuac, CDMX.
            • DOMICILIO: pide la ubicación de entrega. El cliente puede mandarla como prefiera (dirección escrita o ubicación compartida); acéptala tal cual y pide referencias para encontrar el domicilio. Recuerda el pedido mínimo de $100. Las zonas de cobertura están en Tláhuac (Arboledas, Santa Ana Poniente, Santa Cruz, Por Venir, Gitana, Amado Nervo, Alta Tensión); no discutas la cobertura con el cliente, toma la ubicación que indique.

            PASO 4 — MÉTODO DE PAGO
            • EFECTIVO: ¿importe exacto o con billete? ¿de cuánto?
            • TRANSFERENCIA: envía los datos bancarios, pide el comprobante y responde "Tu comprobante fue recibido, en un momento confirmamos tu pago 🙏".

            PASO 5 — RESUMEN Y CONFIRMACIÓN (única vez que muestras el resumen completo)
            Muestra el resumen con TODOS los productos, sus opciones, precios, total, tipo de entrega, dirección (si aplica), método de pago y tiempo estimado.
            Pregunta: "¿Todo está correcto? ✅ ¿Confirmamos tu pedido?"
            Luego ESPERA la respuesta. NO vuelvas a mostrar el resumen mientras esperas.

            CUANDO EL CLIENTE CONFIRME (sí, si, confirmo, dale, va, ok, listo, correcto, así está bien, etc.):
            Responde ÚNICAMENTE con esta línea, sin texto antes ni después:
            PEDIDO_CONFIRMADO:{"items":[{"id_producto":ID,"cantidad":1,"extras":[{"id_subcategoria_opcion":ID,"cantidad":1}],"comentario":"notas"}],"total":TOTAL,"tipo_entrega":"DOMICILIO","direccion":"dirección","referencia":"referencia","metodo_pago":"EFECTIVO","cambio_con":200,"notas":""}

            Si el cliente quiere cambiar algo después del resumen, ajusta y vuelve a mostrar el resumen una sola vez.

            ══════════════════════════════════════════════
            IDs DE PRODUCTOS (usa exactamente estos)
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