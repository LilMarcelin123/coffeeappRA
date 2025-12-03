package com.icaro.coffeeapp.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
class LoginController {
	
	@GetMapping("/login")
	public String login() {
		return "security/login.html";
	}
}