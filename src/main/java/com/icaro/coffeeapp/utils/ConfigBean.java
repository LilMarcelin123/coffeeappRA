package com.icaro.coffeeapp.utils;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.fasterxml.jackson.databind.ObjectMapper;

@Configuration
public class ConfigBean {
	
	@Bean
	ObjectMapper getObjectMapper() {
		return new ObjectMapper();
	}
}

