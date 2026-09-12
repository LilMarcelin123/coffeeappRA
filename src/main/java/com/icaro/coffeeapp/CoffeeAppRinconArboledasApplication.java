package com.icaro.coffeeapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CoffeeAppRinconArboledasApplication {

	public static void main(String[] args) {
		SpringApplication.run(CoffeeAppRinconArboledasApplication.class, args);
	}

}
