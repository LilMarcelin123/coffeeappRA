package com.icaro.coffeeapp.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        http
            .csrf(AbstractHttpConfigurer::disable)
            .headers(headers ->
                headers.frameOptions(frameOptions -> frameOptions.sameOrigin())
            )
            .authorizeHttpRequests(auth -> auth
            		.requestMatchers("/login", "/postLogin",
                            "/img/**", "/css/**", "/js/**", "/webjars/**",
                            "/pdf/**",
                            "/webhook/whatsapp",
                            "/webhook/whatsapp/**").permitAll()

                .requestMatchers("/admin/**").hasRole("ADMINISTRADOR")
                .requestMatchers("/tomaOrden/**").hasRole("ADMINISTRADOR")

                .requestMatchers("/bebcalientes/**").hasRole("OPERADOR_BEBIDAS_CALIENTES")
                .requestMatchers("/salados/**").hasRole("OPERADOR_SALADOS")
                .requestMatchers("/crepas/**").hasRole("OPERADOR_CREPAS_WAFFLES")
                .requestMatchers("/bebfrias/**").hasRole("OPERADOR_BEBIDAS_FRIAS")
                .requestMatchers("/fitness/**").hasRole("OPERADOR_FITNESS")

                .requestMatchers("/operador/**").hasAnyRole(
                    "OPERADOR_SALADOS",
                    "OPERADOR_CREPAS_WAFFLES",
                    "OPERADOR_BEBIDAS_CALIENTES",
                    "OPERADOR_BEBIDAS_FRIAS",
                    "OPERADOR_FITNESS"
                )

                .anyRequest().authenticated()
            )
            .formLogin(form -> form
                .loginPage("/login")
                .defaultSuccessUrl("/postLogin", true)
                .permitAll()
            )
            .logout(logout -> logout
                .logoutUrl("/logout")
                .logoutSuccessUrl("/login?logout")
                .invalidateHttpSession(true)
                .deleteCookies("JSESSIONID")
            )
            .sessionManagement(session -> session
                .invalidSessionUrl("/login?error")
                .sessionFixation(sf -> sf.migrateSession())
                .maximumSessions(1)
                    .maxSessionsPreventsLogin(false)
                    .expiredUrl("/login?expired")
            );

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
