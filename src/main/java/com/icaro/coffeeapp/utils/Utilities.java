package com.icaro.coffeeapp.utils;

import java.util.List;

public class Utilities {
	
	public static String parametrizacionByComas(List<String> parametros) {
		return String.join(",", parametros);
	}
	
	public static String parametrizacionBySaltoLinea(List<String> parametros) {
		return String.join("\n", parametros);
	}	

}