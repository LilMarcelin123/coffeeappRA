package com.icaro.coffeeapp.utils;

import java.sql.Connection;
import java.sql.SQLException;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class ConexionJDBC {

    @Autowired
    private DataSource dataSource;

    public Connection getConexion2() throws SQLException {
        return dataSource.getConnection();
    }

    public void cerrarConexion(Connection conn) throws SQLException {
        if (conn != null && !conn.isClosed()) {
            conn.close();
        }
    }
}