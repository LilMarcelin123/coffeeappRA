package com.icaro.coffeeapp.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.MonthDay;

import org.junit.jupiter.api.Test;

/** Fechas limite del calendario de temporadas y valores forzados. */
class TemporadaAdviceTest {

    private static String auto(int mes, int dia) {
        return TemporadaAdvice.resolver("auto", MonthDay.of(mes, dia));
    }

    @Test
    void halloween() {
        assertEquals("ninguna",   auto(9, 30));
        assertEquals("halloween", auto(10, 1));
        assertEquals("halloween", auto(11, 2));
        assertEquals("navidad",   auto(11, 3));
    }

    @Test
    void navidadCruzaElAnio() {
        assertEquals("navidad", auto(11, 3));
        assertEquals("navidad", auto(11, 12));
        assertEquals("navidad", auto(12, 31));
        assertEquals("navidad", auto(1, 1));
        assertEquals("navidad", auto(1, 6));
        assertEquals("ninguna", auto(1, 7));
        assertEquals("ninguna", auto(6, 15));
        assertEquals("ninguna", auto(9, 30));
    }

    @Test
    void forzado() {
        MonthDay julio = MonthDay.of(7, 1);
        assertEquals("navidad",   TemporadaAdvice.resolver("navidad", julio));
        assertEquals("halloween", TemporadaAdvice.resolver(" Halloween ", julio));
        assertEquals("ninguna",   TemporadaAdvice.resolver("ninguna", MonthDay.of(12, 24)));
        assertEquals("navidad",   TemporadaAdvice.resolver(null, MonthDay.of(12, 24)));
        assertEquals("navidad",   TemporadaAdvice.resolver("", MonthDay.of(12, 24)));
    }

    @Test
    void valorDesconocidoNoRompeLaVista() {
        assertEquals("ninguna", TemporadaAdvice.resolver("navidd", MonthDay.of(12, 24)));
        assertEquals("ninguna", TemporadaAdvice.resolver("../../x", MonthDay.of(12, 24)));
    }
}
