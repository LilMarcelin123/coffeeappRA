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

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

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

	
	public Integer spAgregarItemConExtras(Integer idOrden, Integer idProducto,
	        Integer cantidadProducto, String listaExtrasJson, String comentario) {
Integer idItem = null;

try {
conexionJDBC.getConexion();
CallableStatement cs = ConexionJDBC.conn.prepareCall("{call sp_agregar_item_con_extras(?, ?, ?, ?)}");

cs = ConexionJDBC.conn.prepareCall("{call sp_agregar_item_con_extras(?, ?, ?, ?, ?)}");
cs.setInt(1, idOrden);
cs.setInt(2, idProducto);
cs.setInt(3, cantidadProducto);
cs.setString(4, listaExtrasJson);
if (comentario == null || comentario.isBlank()) cs.setNull(5, Types.VARCHAR);
else                                             cs.setString(5, comentario);

boolean isResultSet = cs.execute();


while (true) {
if (isResultSet) {
try (ResultSet rs = cs.getResultSet()) {
if (rs.next()) {
idItem = rs.getInt("id_item");
System.out.println(">>> id_item obtenido: " + idItem);
}
}
break; // ya encontramos el ResultSet, salir
} else {
int updateCount = cs.getUpdateCount();
if (updateCount == -1) break; // no hay más resultados
}
isResultSet = cs.getMoreResults();
}

} catch (Exception e) {
    e.printStackTrace(); // ya lo tienes
    System.out.println(">>> ERROR spAgregarItemConExtras: " + e.getMessage());
}

finally {
try { conexionJDBC.cerrarConexion(); } catch (Exception ignored) {}
}

return idItem;
}
	
	
	
	public Integer spGestionarOrden(Integer pIdOrden, Integer pTipoProceso, Integer pIdRol, Integer pTipoPago) {

	    CallableStatement cs = null;
	    ResultSet rs = null;

	    try {
	        conexionJDBC.getConexion();

	        cs = ConexionJDBC.conn.prepareCall("{call sp_gestionar_orden(?,?,?,?)}");
	        cs.setInt(1, pIdOrden);
	        cs.setInt(2, pTipoProceso);

	        if (pIdRol == null) {
	            cs.setNull(3, Types.INTEGER);
	        } else {
	            cs.setInt(3, pIdRol);
	        }

	        if (pTipoPago == null) {
	            cs.setNull(4, Types.INTEGER);
	        } else {
	            cs.setInt(4, pTipoPago);
	        }

	        boolean hasResultSet = cs.execute();

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

	
	
	public List<Map<String, Object>> spGestionarOrdenSelect(Integer pIdOrden, Integer pTipoProceso, Integer pIdRol, Integer pTipoPago) {

	    CallableStatement cs = null;
	    ResultSet rs = null;

	    try {
	        conexionJDBC.getConexion();

	        cs = ConexionJDBC.conn.prepareCall("{call sp_gestionar_orden(?,?,?,?)}");

	        if (pIdOrden == null) cs.setNull(1, Types.INTEGER);
	        else cs.setInt(1, pIdOrden);

	        cs.setInt(2, pTipoProceso);

	        if (pIdRol == null) cs.setNull(3, Types.INTEGER);
	        else cs.setInt(3, pIdRol);

	        if (pTipoPago == null) cs.setNull(4, Types.INTEGER);
	        else cs.setInt(4, pTipoPago);

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
	                    val = ((java.sql.Timestamp) val).toInstant()
	                        .atZone(java.time.ZoneId.of("America/Mexico_City"))
	                        .toLocalDateTime().toString();
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

	
	
	
	
	
	
	public Integer spEliminarItem(Integer idOrdenItem) {

	    CallableStatement cs = null;
	    ResultSet rs = null;

	    try {
	        conexionJDBC.getConexion();

	        cs = ConexionJDBC.conn.prepareCall("{call sp_eliminar_item(?)}");
	        cs.setInt(1, idOrdenItem);

	        boolean hasResultSet = cs.execute();

	        if (hasResultSet) {
	            rs = cs.getResultSet();
	            if (rs.next()) {
	                return rs.getInt("filas_afectadas");
	            }
	        }

	        return 0;

	    } catch (Exception e) {
	        e.printStackTrace();
	        return -1;
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

	
	

public List<Map<String, Object>> spReportes(Integer tipoProceso, Integer idTipoPago) {

    CallableStatement cs = null;
    ResultSet rs = null;

    try {
        conexionJDBC.getConexion();

        cs = ConexionJDBC.conn.prepareCall("{call sp_reportes(?, ?)}");
        cs.setInt(1, tipoProceso);

        if (idTipoPago == null) {
            cs.setNull(2, Types.INTEGER);
        } else {
            cs.setInt(2, idTipoPago);
        }

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
                    val = ((java.sql.Timestamp) val).toInstant()
                        .atZone(java.time.ZoneId.of("America/Mexico_City"))
                        .toLocalDateTime().toString();
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




private List<Map<String, Object>> leerResultSet(ResultSet rs) throws Exception {
    List<Map<String, Object>> lista = new ArrayList<>();
    ResultSetMetaData meta = rs.getMetaData();
    int cols = meta.getColumnCount();

    while (rs.next()) {
        Map<String, Object> row = new HashMap<>();
        for (int i = 1; i <= cols; i++) {
            Object val = rs.getObject(i);
            if (val instanceof java.sql.Timestamp)
                val = ((java.sql.Timestamp) val).toInstant()
                    .atZone(java.time.ZoneId.of("America/Mexico_City"))
                    .toLocalDateTime().toString();
            if (val instanceof java.sql.Date)
                val = val.toString();
            row.put(meta.getColumnLabel(i), val);
        }
        lista.add(row);
    }
    return lista;
}

public Map<String, List<Map<String, Object>>> spOperadorOrdenes(Integer idRol) {
    CallableStatement cs = null;

    Map<String, List<Map<String, Object>>> resultado = new HashMap<>();
    resultado.put("ordenes", new ArrayList<>());
    resultado.put("items",   new ArrayList<>());

    try {
        conexionJDBC.getConexion();

        cs = ConexionJDBC.conn.prepareCall("{call sp_gestionar_orden(?, ?, ?, ?)}");
        
        
        cs.setNull(1, Types.INTEGER);
        cs.setInt (2, 7);
        cs.setNull(3, Types.INTEGER);  
        cs.setNull(4, Types.INTEGER);

        
        
        

        boolean isResultSet = cs.execute();
        int rsCount = 0;

        while (true) {
            if (isResultSet) {
                ResultSet rs = cs.getResultSet();
                List<Map<String, Object>> lista = leerResultSet(rs);
                rs.close();

                System.out.println(">>> ResultSet #" + rsCount + " — filas: " + lista.size());

                if (rsCount == 0) resultado.put("ordenes", lista);
                else if (rsCount == 1) resultado.put("items", lista);

                rsCount++;
            } else {
                int updateCount = cs.getUpdateCount();
                if (updateCount == -1) break; // no hay más resultados
                System.out.println(">>> UpdateCount: " + updateCount);
            }

            isResultSet = cs.getMoreResults();
        }

        System.out.println(">>> Total ResultSets leídos: " + rsCount);

    } catch (Exception e) {
        e.printStackTrace();
    } finally {
        try { if (cs != null) cs.close(); } catch (Exception ignored) {}
        try { conexionJDBC.cerrarConexion(); } catch (Exception ignored) {}
    }

    return resultado;
}





//════════════════════════════════════════════════════════════════════════════
//PEGAR ESTOS MÉTODOS DENTRO DE LA CLASE ProcedimientosAlmacenados
//Agregar este import al inicio del archivo si no lo tienes:
//import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
//════════════════════════════════════════════════════════════════════════════


// ── Encoder BCrypt (reutilizable, igual al que usa Spring Security) ────────
private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();


// ─────────────────────────────────────────────────────────────────────────
// LISTAR TODOS LOS USUARIOS  (proceso 1)
// Uso: GET /api/usuarios
// ─────────────────────────────────────────────────────────────────────────
public List<Map<String, Object>> spListarUsuarios() {
    List<Map<String, Object>> lista = new ArrayList<>();
    String sql = "{CALL sp_gestion_usuarios(?, NULL, NULL, NULL, NULL, NULL)}";

    try (Connection conn = conexionJDBC.getConexion2();
         CallableStatement cs = conn.prepareCall(sql)) {

        cs.setInt(1, 1);

        try (ResultSet rs = cs.executeQuery()) {
            ResultSetMetaData meta = rs.getMetaData();
            int cols = meta.getColumnCount();

            while (rs.next()) {
                Map<String, Object> fila = new LinkedHashMap<>();
                for (int i = 1; i <= cols; i++) {
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


// ─────────────────────────────────────────────────────────────────────────
// OBTENER USUARIO POR ID  (proceso 2)  — NO devuelve password
// Uso: GET /api/usuarios/{id}
// ─────────────────────────────────────────────────────────────────────────
public Map<String, Object> spObtenerUsuarioPorId(Integer id) {
    String sql = "{CALL sp_gestion_usuarios(?, NULL, NULL, NULL, NULL, ?)}";

    try (Connection conn = conexionJDBC.getConexion2();
         CallableStatement cs = conn.prepareCall(sql)) {

        cs.setInt(1, 2);
        cs.setInt(2, id);

        try (ResultSet rs = cs.executeQuery()) {
            if (rs.next()) {
                Map<String, Object> fila = new LinkedHashMap<>();
                ResultSetMetaData meta = rs.getMetaData();
                for (int i = 1; i <= meta.getColumnCount(); i++) {
                    fila.put(meta.getColumnLabel(i), rs.getObject(i));
                }
                return fila;
            }
        }

    } catch (SQLException | ClassNotFoundException e) {
        e.printStackTrace();
    }
    return null;
}


// ─────────────────────────────────────────────────────────────────────────
// CREAR USUARIO  (proceso 3)
// Spring encripta el password con BCrypt AQUÍ, antes de pasar al SP
// Devuelve: Map con "resultado"(0=OK,1=user dup,2=email dup), "mensaje", "nuevo_id"
// ─────────────────────────────────────────────────────────────────────────
public Map<String, Object> spCrearUsuario(String username, String passwordPlano,
                                          String telefono, Integer idRol) {
    // ── Encriptar contraseña ANTES de tocar la BD ──
    String hashBcrypt = passwordEncoder.encode(passwordPlano);

    String sql = "{CALL sp_gestion_usuarios(?, ?, ?, ?, ?, NULL)}";

    try (Connection conn = conexionJDBC.getConexion2();
         CallableStatement cs = conn.prepareCall(sql)) {

        cs.setInt(1, 3);
        cs.setString(2, username);
        cs.setString(3, hashBcrypt);   // ← hash, nunca texto plano
        cs.setString(4, telefono);
        cs.setInt(5, idRol);

        try (ResultSet rs = cs.executeQuery()) {
            if (rs.next()) {
                Map<String, Object> respuesta = new LinkedHashMap<>();
                respuesta.put("resultado", rs.getInt("resultado"));
                respuesta.put("mensaje",   rs.getString("mensaje"));
                respuesta.put("nuevo_id",  rs.getObject("nuevo_id"));
                return respuesta;
            }
        }

    } catch (SQLException | ClassNotFoundException e) {
        e.printStackTrace();
    }

    return Map.of("resultado", -1, "mensaje", "Error interno al crear usuario");
}


// ─────────────────────────────────────────────────────────────────────────
// EDITAR USUARIO  (proceso 4)
// passwordPlano = null o vacío → el SP NO cambia el password
// passwordPlano con valor     → Spring encripta y el SP lo actualiza
// Devuelve: Map con "resultado"(0=OK,1=user dup,2=email dup), "mensaje"
// ─────────────────────────────────────────────────────────────────────────
public Map<String, Object> spEditarUsuario(Integer id, String username,
                                           String passwordPlano, String telefono,
                                           Integer idRol) {
    // ── Encriptar solo si viene nuevo password ──
    String hashBcrypt = (passwordPlano != null && !passwordPlano.isBlank())
            ? passwordEncoder.encode(passwordPlano)
            : null;

    String sql = "{CALL sp_gestion_usuarios(?, ?, ?, ?, ?, ?)}";

    try (Connection conn = conexionJDBC.getConexion2();
         CallableStatement cs = conn.prepareCall(sql)) {

        cs.setInt(1, 4);
        cs.setString(2, username);

        if (hashBcrypt != null) cs.setString(3, hashBcrypt);
        else                    cs.setNull(3, Types.VARCHAR);  // SP detecta NULL → no cambia pass

        cs.setString(4, telefono);
        cs.setInt(5, idRol);
        cs.setInt(6, id);

        try (ResultSet rs = cs.executeQuery()) {
            if (rs.next()) {
                Map<String, Object> respuesta = new LinkedHashMap<>();
                respuesta.put("resultado", rs.getInt("resultado"));
                respuesta.put("mensaje",   rs.getString("mensaje"));
                return respuesta;
            }
        }

    } catch (SQLException | ClassNotFoundException e) {
        e.printStackTrace();
    }

    return Map.of("resultado", -1, "mensaje", "Error interno al editar usuario");
}


// ─────────────────────────────────────────────────────────────────────────
// ELIMINAR USUARIO  (proceso 5)
// Devuelve: Map con "resultado"(0=OK, 3=no encontrado, -1=error), "mensaje"
// ─────────────────────────────────────────────────────────────────────────
public Map<String, Object> spEliminarUsuario(Integer id) {
    String sql = "{CALL sp_gestion_usuarios(?, NULL, NULL, NULL, NULL, ?)}";

    try (Connection conn = conexionJDBC.getConexion2();
         CallableStatement cs = conn.prepareCall(sql)) {

        cs.setInt(1, 5);
        cs.setInt(2, id);

        try (ResultSet rs = cs.executeQuery()) {
            if (rs.next()) {
                Map<String, Object> respuesta = new LinkedHashMap<>();
                respuesta.put("resultado", rs.getInt("resultado"));
                respuesta.put("mensaje",   rs.getString("mensaje"));
                return respuesta;
            }
        }

    } catch (SQLException | ClassNotFoundException e) {
        e.printStackTrace();
    }

    return Map.of("resultado", -1, "mensaje", "Error interno al eliminar usuario");
}


// ─────────────────────────────────────────────────────────────────────────
// BUSCAR POR USERNAME — Spring Security (proceso 6)
// Lo llama UserDetailsService.loadUserByUsername()
// Devuelve la fila completa incluyendo password hash para que BCrypt compare
// ─────────────────────────────────────────────────────────────────────────
public Map<String, Object> spBuscarUsuarioLogin(String username) {
    String sql = "{CALL sp_gestion_usuarios(?, ?, NULL, NULL, NULL, NULL)}";

    try (Connection conn = conexionJDBC.getConexion2();
         CallableStatement cs = conn.prepareCall(sql)) {

        cs.setInt(1, 6);
        cs.setString(2, username);

        try (ResultSet rs = cs.executeQuery()) {
            if (rs.next()) {
                Map<String, Object> fila = new LinkedHashMap<>();
                ResultSetMetaData meta = rs.getMetaData();
                for (int i = 1; i <= meta.getColumnCount(); i++) {
                    fila.put(meta.getColumnLabel(i), rs.getObject(i));
                }
                return fila;
            }
        }

    } catch (SQLException | ClassNotFoundException e) {
        e.printStackTrace();
    }
    return null;
}


// ─────────────────────────────────────────────────────────────────────────
// VERIFICAR USERNAME DISPONIBLE  (proceso 7)
// idExcluir = 0  → nuevo usuario
// idExcluir = id → edición (excluye al propio usuario del chequeo)
// Devuelve: true si está disponible, false si ya existe
// ─────────────────────────────────────────────────────────────────────────
public boolean spVerificarUsername(String username, Integer idExcluir) {
    String sql = "{CALL sp_gestion_usuarios(?, ?, NULL, NULL, NULL, ?)}";

    try (Connection conn = conexionJDBC.getConexion2();
         CallableStatement cs = conn.prepareCall(sql)) {

        cs.setInt(1, 7);
        cs.setString(2, username);
        cs.setInt(3, idExcluir != null ? idExcluir : 0);

        try (ResultSet rs = cs.executeQuery()) {
            if (rs.next()) {
                return rs.getInt("disponible") == 1;
            }
        }

    } catch (SQLException | ClassNotFoundException e) {
        e.printStackTrace();
    }
    return false;
}



//════════════════════════════════════════════════════════════════════════════
//AGREGAR A ProcedimientosAlmacenados.java
//════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────
// VALIDAR CONTRASEÑA MAESTRA DE MÓDULOS  (proceso 8)
// El SP devuelve el hash BCrypt guardado en sys_config.
// Spring compara el texto plano ingresado contra ese hash con BCrypt.
// Devuelve: true = acceso permitido, false = contraseña incorrecta
// ─────────────────────────────────────────────────────────────────────────
public boolean spValidarAccesoModulo(String passwordIngresado) {
    String sql = "{CALL sp_gestion_usuarios(8, NULL, NULL, NULL, NULL, NULL)}";

    try (Connection conn = conexionJDBC.getConexion2();
         CallableStatement cs = conn.prepareCall(sql)) {

        cs.setInt(1, 8);

        try (ResultSet rs = cs.executeQuery()) {
            if (rs.next()) {
                String hashGuardado = rs.getString("hash_config");
                // BCrypt compara el texto plano contra el hash de BD
                return passwordEncoder.matches(passwordIngresado, hashGuardado);
            }
        }

    } catch (SQLException | ClassNotFoundException e) {
        e.printStackTrace();
    }
    return false;
}

//════════════════════════════════════════════════════════════
//AGREGAR A ProcedimientosAlmacenados.java
//════════════════════════════════════════════════════════════

// Ejecutar cierre del dia
public Map<String, Object> spEjecutarCierreDia(String username, String observaciones) {
    String sql = "{CALL sp_cierre_dia(1, ?, ?, NULL)}";
    Map<String, Object> resultado = new LinkedHashMap<>();
    try (Connection conn = conexionJDBC.getConexion2();
         CallableStatement cs = conn.prepareCall(sql)) {
        cs.setString(1, username);
        cs.setString(2, observaciones != null ? observaciones : "");
        try (ResultSet rs = cs.executeQuery()) {
            if (rs.next()) {
                resultado.put("resultado", rs.getInt("resultado"));
                resultado.put("mensaje",   rs.getString("mensaje"));
                resultado.put("id_cierre", rs.getObject("id_cierre"));
            }
        }
    } catch (SQLException | ClassNotFoundException e) {
        e.printStackTrace();
        resultado.put("resultado", -1);
        resultado.put("mensaje", "Error: " + e.getMessage());
    }
    return resultado;
}

// Listar historial de cierres
public List<Map<String, Object>> spListarCierres() {
    String sql = "{CALL sp_cierre_dia(2, NULL, NULL, NULL)}";
    List<Map<String, Object>> lista = new ArrayList<>();
    try (Connection conn = conexionJDBC.getConexion2();
         CallableStatement cs = conn.prepareCall(sql);
         ResultSet rs = cs.executeQuery()) {
        ResultSetMetaData meta = rs.getMetaData();
        int cols = meta.getColumnCount();
        while (rs.next()) {
            Map<String, Object> row = new LinkedHashMap<>();
            for (int i = 1; i <= cols; i++) row.put(meta.getColumnLabel(i), rs.getObject(i));
            lista.add(row);
        }
    } catch (SQLException | ClassNotFoundException e) { e.printStackTrace(); }
    return lista;
}


	
	

}