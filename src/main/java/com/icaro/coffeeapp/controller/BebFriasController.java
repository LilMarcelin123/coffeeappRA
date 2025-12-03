package com.icaro.coffeeapp.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class BebFriasController {

    @GetMapping("/bebfrias/iniciobf")
    public String bebfriasInicio() {
        return "bebfrias/iniciobf"; 
    }
}
