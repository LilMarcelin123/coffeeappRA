package com.icaro.coffeeapp.service;

import java.sql.CallableStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.sql.ResultSetMetaData;


import lombok.extern.slf4j.Slf4j;
import com.icaro.coffeeapp.utils.ConexionJDBC;

@Service
@Slf4j
public class ProcedimientosAlmacenados {
	@Autowired
	private ConexionJDBC conexionJDBC;
	
	public Integer spIniciaOrdenInt(Integer tipoProceso) {
	    Integer idOrden = null;

	    try {
	        conexionJDBC.getConexion();

	        CallableStatement cs = ConexionJDBC.conn.prepareCall("{call sp_inicia_orden(?)}");
	        cs.setInt(1, tipoProceso);

	        boolean result = cs.execute();

	        if (result) {
	            ResultSet rs = cs.getResultSet();
	            if (rs.next()) {
	                idOrden = rs.getInt(1);
	            }
	            rs.close();
	        }

	    } catch (Exception e) {
	        e.printStackTrace();
	    } finally {
	        try { conexionJDBC.cerrarConexion(); } catch (Exception ignored) {}
	    }

	    return idOrden;
	}

}