package com.icaro.coffeeapp.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import lombok.RequiredArgsConstructor;

@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final AperturaCajaInterceptor aperturaCajaInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Todo lo del administrador, mas las rutas de orden que no
        // cuelgan de /admin. La pantalla de apertura queda fuera.
        registry.addInterceptor(aperturaCajaInterceptor)
                .addPathPatterns(
                        "/admin/**",
                        "/tomaOrden", "/tomaOrden/**",
                        "/procesoInicialOrden",
                        "/api/acceso-modulo")
                .excludePathPatterns(
                        AperturaCajaInterceptor.PANTALLA_APERTURA,
                        AperturaCajaInterceptor.PANTALLA_APERTURA + "/**");
    }
}
