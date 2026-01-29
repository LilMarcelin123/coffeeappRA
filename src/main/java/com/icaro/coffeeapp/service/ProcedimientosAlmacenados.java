package com.icaro.coffeeapp.service;

import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.math.BigDecimal;

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
			try {
				conexionJDBC.cerrarConexion();
			} catch (Exception ignored) {
			}
		}

		return idOrden;
	}

	public Integer spAgregarItemConExtras(Integer idOrden, Integer idProducto, Integer cantidadProducto,
			String listaExtrasJson) {

		Integer idItem = null;

		try {
			conexionJDBC.getConexion();
			CallableStatement cs = ConexionJDBC.conn.prepareCall("{call sp_agregar_item_con_extras(?, ?, ?, ?)}");

			cs.setInt(1, idOrden);
			cs.setInt(2, idProducto);
			cs.setInt(3, cantidadProducto);
			cs.setString(4, listaExtrasJson);

			boolean result = cs.execute();

			if (result) {
				try (ResultSet rs = cs.getResultSet()) {
					if (rs.next()) {
						idItem = rs.getInt("id_item");
					}
				}
			}

		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				conexionJDBC.cerrarConexion();
			} catch (Exception ignored) {
			}
		}

		return idItem;
	}
	
	
	
	public Integer spGestionarOrden(Integer pIdOrden, Integer pTipoProceso, Integer pIdRol) {

        CallableStatement cs = null;
        ResultSet rs = null;

        try {
            conexionJDBC.getConexion();

            cs = ConexionJDBC.conn.prepareCall("{call sp_gestionar_orden(?,?,?)}");
            cs.setInt(1, pIdOrden);
            cs.setInt(2, pTipoProceso);

            if (pIdRol == null) {
                cs.setNull(3, Types.INTEGER);
            } else {
                cs.setInt(3, pIdRol);
            }

            boolean hasResultSet = cs.execute();

            // Si el SP no devolvió ResultSet
            if (!hasResultSet) {
                return 0;
            }

            rs = cs.getResultSet();
            int filas = 0;

            while (rs.next()) {
                filas++;
            }

            return filas;

        } catch (Exception e) {
            e.printStackTrace();
            return -1; 
        } finally {
            try { if (rs != null) rs.close(); } catch (Exception ignored) {}
            try { if (cs != null) cs.close(); } catch (Exception ignored) {}
            try { conexionJDBC.cerrarConexion(); } catch (Exception ignored) {}
        }
    }
	
	
	
	public List<Map<String, Object>> spGestionarOrdenSelect(Integer pIdOrden, Integer pTipoProceso, Integer pIdRol) {

	    CallableStatement cs = null;
	    ResultSet rs = null;

	    try {
	        conexionJDBC.getConexion();

	        cs = ConexionJDBC.conn.prepareCall("{call sp_gestionar_orden(?,?,?)}");

	        if (pIdOrden == null) cs.setNull(1, Types.INTEGER);
	        else cs.setInt(1, pIdOrden);

	        cs.setInt(2, pTipoProceso);

	        if (pIdRol == null) cs.setNull(3, Types.INTEGER);
	        else cs.setInt(3, pIdRol);

	        boolean hasResultSet = cs.execute();
	        if (!hasResultSet) return new ArrayList<>();

	        rs = cs.getResultSet();
	        if (rs == null) return new ArrayList<>();

	        List<Map<String, Object>> lista = new ArrayList<>();
	        ResultSetMetaData meta = rs.getMetaData();
	        int colCount = meta.getColumnCount();

	        while (rs.next()) {
	            Map<String, Object> row = new HashMap<>();
	            for (int i = 1; i <= colCount; i++) {
	            	Object val = rs.getObject(i);

	            	if (val instanceof java.time.LocalDateTime) {
	            	    val = val.toString();
	            	}
	            	if (val instanceof java.sql.Timestamp) {
	            	    val = ((java.sql.Timestamp) val).toLocalDateTime().toString();
	            	}
	            	if (val instanceof java.sql.Date) {
	            	    val = val.toString();
	            	}

	            	row.put(meta.getColumnLabel(i), val);

	            }
	            lista.add(row);
	        }

	        return lista;

	    } catch (Exception e) {
	        e.printStackTrace();
	        return new ArrayList<>();
	    } finally {
	        try { if (rs != null) rs.close(); } catch (Exception ignored) {}
	        try { if (cs != null) cs.close(); } catch (Exception ignored) {}
	        try { conexionJDBC.cerrarConexion(); } catch (Exception ignored) {}
	    }
	}
	
	
	
	
	
	
	public List<Map<String, Object>> spResumenOrden(Integer idOrden) {

	    CallableStatement cs = null;
	    ResultSet rs = null;

	    try {
	        conexionJDBC.getConexion();

	        cs = ConexionJDBC.conn.prepareCall("{call sp_resumen_orden(?)}");
	        cs.setInt(1, idOrden);

	        boolean hasRs = cs.execute();
	        if (!hasRs) return new ArrayList<>();

	        rs = cs.getResultSet();
	        if (rs == null) return new ArrayList<>();

	        List<Map<String, Object>> lista = new ArrayList<>();
	        ResultSetMetaData meta = rs.getMetaData();
	        int colCount = meta.getColumnCount();

	        while (rs.next()) {
	            Map<String, Object> row = new HashMap<>();
	            for (int i = 1; i <= colCount; i++) {
	                row.put(meta.getColumnLabel(i), rs.getObject(i));
	            }
	            lista.add(row);
	        }

	        return lista;

	    } catch (Exception e) {
	        e.printStackTrace();
	        return new ArrayList<>();
	    } finally {
	        try { if (rs != null) rs.close(); } catch (Exception ignored) {}
	        try { if (cs != null) cs.close(); } catch (Exception ignored) {}
	        try { conexionJDBC.cerrarConexion(); } catch (Exception ignored) {}
	    }
	
}
	
	
	
	public int spGestionCatalogo(Integer vpTipoProceso, String vNombre, BigDecimal vPrecio,
            String vDescripcion, Integer vRol, Integer vId) {
String sql = "{call sp_gestion_catalogo(?,?,?,?,?,?)}";
try (Connection conn = conexionJDBC.getConexion2();
CallableStatement cs = conn.prepareCall(sql)) {

cs.setInt(1, vpTipoProceso);
if (vNombre != null) cs.setString(2, vNombre); else cs.setNull(2, Types.VARCHAR);
if (vPrecio != null) cs.setBigDecimal(3, vPrecio); else cs.setNull(3, Types.DECIMAL);
if (vDescripcion != null) cs.setString(4, vDescripcion); else cs.setNull(4, Types.VARCHAR);
if (vRol != null) cs.setInt(5, vRol); else cs.setNull(5, Types.INTEGER);
if (vId != null) cs.setInt(6, vId); else cs.setNull(6, Types.INTEGER);

return cs.executeUpdate();
} catch (SQLException | ClassNotFoundException e) {
e.printStackTrace();
return -1;
}
}


	public List<Map<String, Object>> obtenerRoles() {
	    List<Map<String, Object>> roles = new ArrayList<>();
	    String sql = "SELECT id_rol, rol, description FROM sys_roles_usuario";

	    try (Connection conn = conexionJDBC.getConexion2();
	         Statement st = conn.createStatement();
	         ResultSet rs = st.executeQuery(sql)) {

	        while (rs.next()) {
	            Map<String, Object> row = new HashMap<>();
	            row.put("ID", rs.getInt("id_rol"));
	            row.put("Nombre", rs.getString("rol"));
	            row.put("Descripcion", rs.getString("description"));
	            roles.add(row);
	        }
	    } catch (SQLException | ClassNotFoundException e) {
	        e.printStackTrace();
	    }
	    return roles;
	}

	
	public List<Map<String, Object>> spVistaCatalogos(Integer vpTipoProceso) {
	    List<Map<String, Object>> lista = new ArrayList<>();
	    String sql = "{CALL sp_vista_catalogos(?)}";

	    try (Connection conn = conexionJDBC.getConexion2();
	         CallableStatement cs = conn.prepareCall(sql)) {

	        cs.setInt(1, vpTipoProceso);
	        try (ResultSet rs = cs.executeQuery()) {
	            ResultSetMetaData meta = rs.getMetaData();
	            int columnas = meta.getColumnCount();

	            while (rs.next()) {
	                Map<String, Object> fila = new LinkedHashMap<>();
	                for (int i = 1; i <= columnas; i++) {
	                    fila.put(meta.getColumnLabel(i), rs.getObject(i));
	                }
	                lista.add(fila);
	            }
	        }
	    } catch (SQLException | ClassNotFoundException e) {
	        e.printStackTrace();
	    }
	    return lista;
	}


}