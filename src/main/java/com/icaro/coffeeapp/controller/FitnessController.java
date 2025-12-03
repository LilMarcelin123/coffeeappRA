package com.icaro.coffeeapp.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class FitnessController {

    @GetMapping("/fitness/iniciofit")
    public String fitnessInicio() {
        return "fitness/iniciofit"; 
    }
}
