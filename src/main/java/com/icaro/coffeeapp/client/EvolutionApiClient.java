package com.icaro.coffeeapp.client;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class EvolutionApiClient {

    @Value("${evolution.api.url}")
    private String evolutionApiUrl;

    @Value("${evolution.api.key}")
    private String evolutionApiKey;

    @Value("${evolution.api.instance}")
    private String instanceName;

    private final RestTemplate restTemplate = new RestTemplate();

    public void enviarMensaje(String numeroDestino, String texto) {
        String url = evolutionApiUrl + "/message/sendText/" + instanceName;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", evolutionApiKey);

        // Evolution API v2: campos planos en el body (text directo, no anidado)
        Map<String, Object> body = new HashMap<>();
        body.put("number", numeroDestino.contains("@") ? numeroDestino : numeroDestino + "@s.whatsapp.net");
        body.put("text", texto);

        System.out.println("📤 Body enviado: " + body);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
            System.out.println("✅ Respuesta Evolution: " + response.getBody());
        } catch (Exception e) {
            System.err.println("Error enviando mensaje WhatsApp: " + e.getMessage());
        }
    }


    public void enviarDocumento(String numeroDestino, String urlDocumento, String nombreArchivo, String caption) {
        String url = evolutionApiUrl + "/message/sendMedia/" + instanceName;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", evolutionApiKey);

        // Evolution API v2: campos planos en el body (no anidados en mediaMessage)
        Map<String, Object> body = new HashMap<>();
        body.put("number", numeroDestino.contains("@") ? numeroDestino : numeroDestino + "@s.whatsapp.net");
        body.put("mediatype", "document");
        body.put("mimetype", "application/pdf");
        body.put("media", urlDocumento);
        body.put("fileName", nombreArchivo);
        body.put("caption", caption);

        System.out.println("📤 Body PDF: " + body);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
            System.out.println("✅ PDF enviado: " + response.getBody());
        } catch (Exception e) {
            System.err.println("Error enviando PDF: " + e.getMessage());
        }
    }

}
