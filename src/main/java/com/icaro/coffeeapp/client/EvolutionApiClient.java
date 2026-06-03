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

        Map<String, Object> textMessage = new HashMap<>();
        textMessage.put("text", texto);

        Map<String, Object> body = new HashMap<>();
        body.put("number", numeroDestino);
        body.put("textMessage", textMessage);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            restTemplate.postForEntity(url, request, String.class);
        } catch (Exception e) {
            System.err.println("Error enviando mensaje WhatsApp: " + e.getMessage());
        }
    }
}