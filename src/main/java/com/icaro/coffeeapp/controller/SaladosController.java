package com.icaro.coffeeapp.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SaladosController {

    @GetMapping("/salados/iniciosa")
    public String saladosInicio() {
        return "salados/iniciosa"; 
    }
}
