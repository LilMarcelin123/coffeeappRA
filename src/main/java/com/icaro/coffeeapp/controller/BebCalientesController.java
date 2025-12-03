package com.icaro.coffeeapp.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class BebCalientesController {

    @GetMapping("/bebcalientes/iniciobc")
    public String bebcalientesInicio() {
        return "bebcalientes/iniciobc"; 
    }
}
