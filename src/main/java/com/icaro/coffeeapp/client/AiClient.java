package com.icaro.coffeeapp.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Component
public class AiClient {

    @Value("${ai.api.key}")
    private String apiKey;

    @Value("${ai.model}")
    private String model;

    @Value("${ai.api.url}")
    private String apiUrl;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public String chat(List<Map<String, String>> messages, String systemPrompt) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            Map<String, Object> body = Map.of(
                "model", model,
                "messages", prepararMensajes(messages, systemPrompt),
                "max_tokens", 4096,
                "temperature", 0.3
            );

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(apiUrl, request, String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode choice = root.path("choices").get(0);
            System.out.println("🔍 finish_reason: " + choice.path("finish_reason").asText());
            System.out.println("🔍 usage: " + root.path("usage").toString());
            return choice.path("message").path("content").asText();

        } catch (Exception e) {
            System.err.println("Error llamando IA: " + e.getMessage());
            return "Lo siento, en este momento no puedo procesar tu mensaje. Intenta de nuevo.";
        }
    }

    private List<Map<String, String>> prepararMensajes(List<Map<String, String>> messages, String systemPrompt) {
        var lista = new java.util.ArrayList<Map<String, String>>();
        lista.add(Map.of("role", "system", "content", systemPrompt));
        lista.addAll(messages);
        return lista;
    }
}