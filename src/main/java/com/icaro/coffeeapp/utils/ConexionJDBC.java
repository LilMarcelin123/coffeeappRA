package com.icaro.coffeeapp.utils;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ConexionJDBC {
	
	@Value("${spring.datasource.username}")
	private String user;
	@Value("${spring.datasource.password}")
	private String password;
	@Value("${spring.datasource.url}")
	private String url;
	
	public static Connection conn = null;
	
	public void getConexion() throws ClassNotFoundException, SQLException {
		Class.forName("com.mysql.cj.jdbc.Driver");
		conn = DriverManager.getConnection(url, user, password);
	}
	
	public Connection getConexion2() throws ClassNotFoundException, SQLException {
	    Class.forName("com.mysql.cj.jdbc.Driver");
	    // ← ya NO asigna a conn estático, solo devuelve la conexión local
	    return DriverManager.getConnection(url, user, password);
	}
	
	public void cerrarConexion() throws SQLException {
		conn.close();
	}
	
}