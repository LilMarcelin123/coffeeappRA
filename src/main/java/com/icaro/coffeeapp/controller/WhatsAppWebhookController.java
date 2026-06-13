package com.icaro.coffeeapp.controller;

import com.icaro.coffeeapp.service.WhatsAppService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/webhook/whatsapp")
public class WhatsAppWebhookController {

    @Autowired
    private WhatsAppService whatsAppService;

    @PostMapping({"", "/", "/**"})
    public ResponseEntity<String> recibirMensaje(@RequestBody String payload) {
        try {
            whatsAppService.procesarMensaje(payload);
            return ResponseEntity.ok("OK");
        } catch (Exception e) {
            System.err.println("Error procesando webhook: " + e.getMessage());
            return ResponseEntity.ok("OK"); // Siempre 200 para Evolution API
        }
    }
}