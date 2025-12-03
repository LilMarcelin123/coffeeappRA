package com.icaro.coffeeapp.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class CrepasController {

    @GetMapping("/crepas/iniciocr")
    public String crepasInicio() {
        return "crepas/iniciocr"; 
    }
}
