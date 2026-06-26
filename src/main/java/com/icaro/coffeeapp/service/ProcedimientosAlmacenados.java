package com.icaro.coffeeapp.service;

import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.util.ArrayList;
import java.util.Collections;
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

    // ── Encoder BCrypt ────────────────────────────────────────
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    // ════════════════════════════════════════════════════════
    // ÓRDENES
    // ════════════════════════════════════════════════════════

    public Integer spIniciaOrdenInt(Integer tipoProceso) {
        final String SQL = "{call sp_inicia_orden(?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setInt(1, tipoProceso);
            boolean result = cs.execute();
            if (result) {
                try (ResultSet rs = cs.getResultSet()) {
                    if (rs.next()) return rs.getInt(1);
                }
            }
        } catch (SQLException e) {
            log.error("spIniciaOrdenInt error: {}", e.getMessage());
        }
        return null;
    }

    public Integer spAgregarItemConExtras(Integer idOrden, Integer idProducto,
            Integer cantidadProducto, String listaExtrasJson, String comentario) {
        final String SQL = "{call sp_agregar_item_con_extras(?, ?, ?, ?, ?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

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
                            Integer idItem = rs.getInt("id_item");
                            log.debug(">>> id_item obtenido: {}", idItem);
                            return idItem;
                        }
                    }
                    break;
                } else {
                    if (cs.getUpdateCount() == -1) break;
                }
                isResultSet = cs.getMoreResults();
            }
        } catch (SQLException e) {
            log.error("spAgregarItemConExtras error: {}", e.getMessage());
        }
        return null;
    }

    public Integer spGestionarOrden(Integer pIdOrden, Integer pTipoProceso,
            Integer pIdRol, Integer pTipoPago) {
        final String SQL = "{call sp_gestionar_orden(?,?,?,?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setInt(1, pIdOrden);
            cs.setInt(2, pTipoProceso);
            if (pIdRol  == null) cs.setNull(3, Types.INTEGER); else cs.setInt(3, pIdRol);
            if (pTipoPago == null) cs.setNull(4, Types.INTEGER); else cs.setInt(4, pTipoPago);

            boolean hasResultSet = cs.execute();
            if (!hasResultSet) return 0;

            int filas = 0;
            try (ResultSet rs = cs.getResultSet()) {
                while (rs.next()) filas++;
            }
            return filas;

        } catch (SQLException e) {
            log.error("spGestionarOrden error: {}", e.getMessage());
            return -1;
        }
    }

    public List<Map<String, Object>> spGestionarOrdenSelect(Integer pIdOrden,
            Integer pTipoProceso, Integer pIdRol, Integer pTipoPago) {
        final String SQL = "{call sp_gestionar_orden(?,?,?,?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            if (pIdOrden == null) cs.setNull(1, Types.INTEGER); else cs.setInt(1, pIdOrden);
            cs.setInt(2, pTipoProceso);
            if (pIdRol   == null) cs.setNull(3, Types.INTEGER); else cs.setInt(3, pIdRol);
            if (pTipoPago == null) cs.setNull(4, Types.INTEGER); else cs.setInt(4, pTipoPago);

            boolean hasResultSet = cs.execute();
            if (!hasResultSet) return new ArrayList<>();

            try (ResultSet rs = cs.getResultSet()) {
                if (rs == null) return new ArrayList<>();
                return mapResultSetGeneric(rs);
            }

        } catch (SQLException e) {
            log.error("spGestionarOrdenSelect error: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    public Integer spEliminarItem(Integer idOrdenItem) {
        final String SQL = "{call sp_eliminar_item(?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setInt(1, idOrdenItem);
            boolean hasResultSet = cs.execute();
            if (hasResultSet) {
                try (ResultSet rs = cs.getResultSet()) {
                    if (rs.next()) return rs.getInt("filas_afectadas");
                }
            }
            return 0;

        } catch (SQLException e) {
            log.error("spEliminarItem error: {}", e.getMessage());
            return -1;
        }
    }

    public List<Map<String, Object>> spResumenOrden(Integer idOrden) {
        final String SQL = "{call sp_resumen_orden(?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setInt(1, idOrden);
            boolean hasRs = cs.execute();
            if (!hasRs) return new ArrayList<>();

            try (ResultSet rs = cs.getResultSet()) {
                if (rs == null) return new ArrayList<>();
                return mapResultSetSimple(rs);
            }

        } catch (SQLException e) {
            log.error("spResumenOrden error: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    public Map<String, List<Map<String, Object>>> spOperadorOrdenes(Integer idRol) {
        final String SQL = "{call sp_gestionar_orden(?, ?, ?, ?)}";
        Map<String, List<Map<String, Object>>> resultado = new HashMap<>();
        resultado.put("ordenes", new ArrayList<>());
        resultado.put("items",   new ArrayList<>());

        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setNull(1, Types.INTEGER);
            cs.setInt (2, 7);
            cs.setNull(3, Types.INTEGER);
            cs.setNull(4, Types.INTEGER);

            boolean isResultSet = cs.execute();
            int rsCount = 0;

            while (true) {
                if (isResultSet) {
                    try (ResultSet rs = cs.getResultSet()) {
                        List<Map<String, Object>> lista = leerResultSet(rs);
                        if (rsCount == 0) resultado.put("ordenes", lista);
                        else if (rsCount == 1) resultado.put("items", lista);
                        rsCount++;
                    }
                } else {
                    if (cs.getUpdateCount() == -1) break;
                }
                isResultSet = cs.getMoreResults();
            }

        } catch (SQLException e) {
            log.error("spOperadorOrdenes error: {}", e.getMessage());
        }
        return resultado;
    }

    public void spGuardarNombreCliente(Integer idOrden, String nombreCliente) {
        final String SQL = "UPDATE orden SET n_nombre_cliente = ? WHERE id_orden = ?";
        try (Connection conn = conexionJDBC.getConexion2();
             PreparedStatement ps = conn.prepareStatement(SQL)) {

            if (nombreCliente != null && !nombreCliente.isBlank())
                ps.setString(1, nombreCliente.trim());
            else
                ps.setNull(1, Types.VARCHAR);
            ps.setInt(2, idOrden);
            ps.executeUpdate();

        } catch (SQLException e) {
            log.error("spGuardarNombreCliente error: {}", e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════
    // CATÁLOGO
    // ════════════════════════════════════════════════════════

    public int spGestionCatalogo(Integer vpTipoProceso, String vNombre, BigDecimal vPrecio,
            String vDescripcion, Integer vRol, Integer vId) {
        final String SQL = "{call sp_gestion_catalogo(?,?,?,?,?,?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setInt(1, vpTipoProceso);
            if (vNombre != null)      cs.setString(2, vNombre);      else cs.setNull(2, Types.VARCHAR);
            if (vPrecio != null)      cs.setBigDecimal(3, vPrecio);   else cs.setNull(3, Types.DECIMAL);
            if (vDescripcion != null) cs.setString(4, vDescripcion);  else cs.setNull(4, Types.VARCHAR);
            if (vRol != null)         cs.setInt(5, vRol);             else cs.setNull(5, Types.INTEGER);
            if (vId != null)          cs.setInt(6, vId);              else cs.setNull(6, Types.INTEGER);

            return cs.executeUpdate();

        } catch (SQLException e) {
            log.error("spGestionCatalogo error: {}", e.getMessage());
            return -1;
        }
    }

    public List<Map<String, Object>> spVistaCatalogos(Integer vpTipoProceso) {
        final String SQL = "{CALL sp_vista_catalogos(?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setInt(1, vpTipoProceso);
            try (ResultSet rs = cs.executeQuery()) {
                return mapResultSetSimple(rs);
            }

        } catch (SQLException e) {
            log.error("spVistaCatalogos error: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    // ════════════════════════════════════════════════════════
    // REPORTES
    // ════════════════════════════════════════════════════════

    public List<Map<String, Object>> spReportes(Integer tipoProceso, Integer idTipoPago) {
        final String SQL = "{call sp_reportes(?, ?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setInt(1, tipoProceso);
            if (idTipoPago == null) cs.setNull(2, Types.INTEGER); else cs.setInt(2, idTipoPago);

            boolean hasResultSet = cs.execute();
            if (!hasResultSet) return new ArrayList<>();

            try (ResultSet rs = cs.getResultSet()) {
                if (rs == null) return new ArrayList<>();
                return mapResultSetGeneric(rs);
            }

        } catch (SQLException e) {
            log.error("spReportes error: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    // ════════════════════════════════════════════════════════
    // ROLES
    // ════════════════════════════════════════════════════════

    public List<Map<String, Object>> obtenerRoles() {
        final String SQL = "SELECT id_rol, rol, description FROM sys_roles_usuario";
        List<Map<String, Object>> roles = new ArrayList<>();
        try (Connection conn = conexionJDBC.getConexion2();
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(SQL)) {

            while (rs.next()) {
                Map<String, Object> row = new HashMap<>();
                row.put("ID",         rs.getInt("id_rol"));
                row.put("Nombre",     rs.getString("rol"));
                row.put("Descripcion", rs.getString("description"));
                roles.add(row);
            }
        } catch (SQLException e) {
            log.error("obtenerRoles error: {}", e.getMessage());
        }
        return roles;
    }

    // ════════════════════════════════════════════════════════
    // USUARIOS
    // ════════════════════════════════════════════════════════

    public List<Map<String, Object>> spListarUsuarios() {
        final String SQL = "{CALL sp_gestion_usuarios(?, NULL, NULL, NULL, NULL, NULL)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setInt(1, 1);
            try (ResultSet rs = cs.executeQuery()) {
                return mapResultSetSimple(rs);
            }
        } catch (SQLException e) {
            log.error("spListarUsuarios error: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    public Map<String, Object> spObtenerUsuarioPorId(Integer id) {
        final String SQL = "{CALL sp_gestion_usuarios(?, NULL, NULL, NULL, NULL, ?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setInt(1, 2);
            cs.setInt(2, id);
            try (ResultSet rs = cs.executeQuery()) {
                if (rs.next()) {
                    Map<String, Object> fila = new LinkedHashMap<>();
                    ResultSetMetaData meta = rs.getMetaData();
                    for (int i = 1; i <= meta.getColumnCount(); i++)
                        fila.put(meta.getColumnLabel(i), rs.getObject(i));
                    return fila;
                }
            }
        } catch (SQLException e) {
            log.error("spObtenerUsuarioPorId error: {}", e.getMessage());
        }
        return null;
    }

    public Map<String, Object> spCrearUsuario(String username, String passwordPlano,
            String telefono, Integer idRol) {
        String hashBcrypt = passwordEncoder.encode(passwordPlano);
        final String SQL = "{CALL sp_gestion_usuarios(?, ?, ?, ?, ?, NULL)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setInt(1, 3);
            cs.setString(2, username);
            cs.setString(3, hashBcrypt);
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
        } catch (SQLException e) {
            log.error("spCrearUsuario error: {}", e.getMessage());
        }
        return Map.of("resultado", -1, "mensaje", "Error interno al crear usuario");
    }

    public Map<String, Object> spEditarUsuario(Integer id, String username,
            String passwordPlano, String telefono, Integer idRol) {
        String hashBcrypt = (passwordPlano != null && !passwordPlano.isBlank())
                ? passwordEncoder.encode(passwordPlano) : null;
        final String SQL = "{CALL sp_gestion_usuarios(?, ?, ?, ?, ?, ?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setInt(1, 4);
            cs.setString(2, username);
            if (hashBcrypt != null) cs.setString(3, hashBcrypt); else cs.setNull(3, Types.VARCHAR);
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
        } catch (SQLException e) {
            log.error("spEditarUsuario error: {}", e.getMessage());
        }
        return Map.of("resultado", -1, "mensaje", "Error interno al editar usuario");
    }

    public Map<String, Object> spEliminarUsuario(Integer id) {
        final String SQL = "{CALL sp_gestion_usuarios(?, NULL, NULL, NULL, NULL, ?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

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
        } catch (SQLException e) {
            log.error("spEliminarUsuario error: {}", e.getMessage());
        }
        return Map.of("resultado", -1, "mensaje", "Error interno al eliminar usuario");
    }

    public Map<String, Object> spBuscarUsuarioLogin(String username) {
        final String SQL = "{CALL sp_gestion_usuarios(?, ?, NULL, NULL, NULL, NULL)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setInt(1, 6);
            cs.setString(2, username);
            try (ResultSet rs = cs.executeQuery()) {
                if (rs.next()) {
                    Map<String, Object> fila = new LinkedHashMap<>();
                    ResultSetMetaData meta = rs.getMetaData();
                    for (int i = 1; i <= meta.getColumnCount(); i++)
                        fila.put(meta.getColumnLabel(i), rs.getObject(i));
                    return fila;
                }
            }
        } catch (SQLException e) {
            log.error("spBuscarUsuarioLogin error: {}", e.getMessage());
        }
        return null;
    }

    public boolean spVerificarUsername(String username, Integer idExcluir) {
        final String SQL = "{CALL sp_gestion_usuarios(?, ?, NULL, NULL, NULL, ?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setInt(1, 7);
            cs.setString(2, username);
            cs.setInt(3, idExcluir != null ? idExcluir : 0);
            try (ResultSet rs = cs.executeQuery()) {
                if (rs.next()) return rs.getInt("disponible") == 1;
            }
        } catch (SQLException e) {
            log.error("spVerificarUsername error: {}", e.getMessage());
        }
        return false;
    }

    public boolean spValidarAccesoModulo(String passwordIngresado) {
        final String SQL = "{CALL sp_gestion_usuarios(8, NULL, NULL, NULL, NULL, NULL)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            try (ResultSet rs = cs.executeQuery()) {
                if (rs.next()) {
                    String hashGuardado = rs.getString("hash_config");
                    return passwordEncoder.matches(passwordIngresado, hashGuardado);
                }
            }
        } catch (SQLException e) {
            log.error("spValidarAccesoModulo error: {}", e.getMessage());
        }
        return false;
    }

    // ════════════════════════════════════════════════════════
    // CIERRE DE DÍA
    // ════════════════════════════════════════════════════════

    public Map<String, Object> spEjecutarCierreDia(String username, String observaciones) {
        final String SQL = "{CALL sp_cierre_dia(1, ?, ?, NULL)}";
        Map<String, Object> resultado = new LinkedHashMap<>();
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setString(1, username);
            cs.setString(2, observaciones != null ? observaciones : "");
            try (ResultSet rs = cs.executeQuery()) {
                if (rs.next()) {
                    resultado.put("resultado", rs.getInt("resultado"));
                    resultado.put("mensaje",   rs.getString("mensaje"));
                    resultado.put("id_cierre", rs.getObject("id_cierre"));
                }
            }
        } catch (SQLException e) {
            log.error("spEjecutarCierreDia error: {}", e.getMessage());
            resultado.put("resultado", -1);
            resultado.put("mensaje", "Error: " + e.getMessage());
        }
        return resultado;
    }

    public List<Map<String, Object>> spListarCierres() {
        final String SQL = "{CALL sp_cierre_dia(2, NULL, NULL, NULL)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL);
             ResultSet rs = cs.executeQuery()) {

            return mapResultSetSimple(rs);

        } catch (SQLException e) {
            log.error("spListarCierres error: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    // ════════════════════════════════════════════════════════
    // INVENTARIO — sp_gestion_inventario
    // ════════════════════════════════════════════════════════

    private List<Map<String, Object>> ejecutarSpInventario(
            int tipoProceso, Integer idInsumo, String nombre,
            Integer idCategoria, Integer idUnidad,
            BigDecimal stockInicial, BigDecimal stockMinimo,
            BigDecimal cantidadEntrada, String descripcion, String usuario) {

        final String SQL = "{CALL sp_gestion_inventario(?,?,?,?,?,?,?,?,?,?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setInt(1, tipoProceso);
            setIntOrNull(cs, 2, idInsumo);
            setStrOrNull(cs, 3, nombre);
            setIntOrNull(cs, 4, idCategoria);
            setIntOrNull(cs, 5, idUnidad);
            setBdOrNull (cs, 6, stockInicial);
            setBdOrNull (cs, 7, stockMinimo);
            setBdOrNull (cs, 8, cantidadEntrada);
            setStrOrNull(cs, 9, descripcion);
            setStrOrNull(cs, 10, usuario);

            try (ResultSet rs = cs.executeQuery()) {
                return mapResultSet(rs);
            }

        } catch (SQLException e) {
            log.error("sp_gestion_inventario proceso {}: {}", tipoProceso, e.getMessage());
            return Collections.emptyList();
        }
    }

    private Map<String, Object> ejecutarSpInventarioEscritura(
            int tipoProceso, Integer idInsumo, String nombre,
            Integer idCategoria, Integer idUnidad,
            BigDecimal stockInicial, BigDecimal stockMinimo,
            BigDecimal cantidadEntrada, String descripcion, String usuario) {

        List<Map<String, Object>> rows = ejecutarSpInventario(
                tipoProceso, idInsumo, nombre, idCategoria, idUnidad,
                stockInicial, stockMinimo, cantidadEntrada, descripcion, usuario);
        if (!rows.isEmpty()) return rows.get(0);
        return Map.of("resultado", -1, "mensaje", "Sin respuesta del servidor");
    }

    // ════════════════════════════════════════════════════════
    // RECETAS — sp_gestion_recetas
    // ════════════════════════════════════════════════════════

    private List<Map<String, Object>> ejecutarSpRecetas(
            int tipoProceso, Integer idProducto, Integer idInsumo,
            BigDecimal cantidadRequerida, Integer idProductoInsumo) {

        final String SQL = "{CALL sp_gestion_recetas(?,?,?,?,?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setInt(1, tipoProceso);
            setIntOrNull(cs, 2, idProducto);
            setIntOrNull(cs, 3, idInsumo);
            setBdOrNull (cs, 4, cantidadRequerida);
            setIntOrNull(cs, 5, idProductoInsumo);

            try (ResultSet rs = cs.executeQuery()) {
                return mapResultSet(rs);
            }

        } catch (SQLException e) {
            log.error("sp_gestion_recetas proceso {}: {}", tipoProceso, e.getMessage());
            return Collections.emptyList();
        }
    }

    private Map<String, Object> ejecutarSpRecetasEscritura(
            int tipoProceso, Integer idProducto, Integer idInsumo,
            BigDecimal cantidadRequerida, Integer idProductoInsumo) {

        List<Map<String, Object>> rows = ejecutarSpRecetas(
                tipoProceso, idProducto, idInsumo, cantidadRequerida, idProductoInsumo);
        if (!rows.isEmpty()) return rows.get(0);
        return Map.of("resultado", -1, "mensaje", "Sin respuesta del servidor");
    }

    // ════════════════════════════════════════════════════════
    // WRAPPERS PÚBLICOS — Inventario
    // ════════════════════════════════════════════════════════

    public List<Map<String, Object>> spInvGestionar(
            int tipoProceso, Integer idInsumo, String nombre,
            Integer idCategoria, Integer idUnidad,
            BigDecimal stockInicial, BigDecimal stockMinimo,
            BigDecimal cantidadEntrada, String descripcion, String usuario) {
        return ejecutarSpInventario(tipoProceso, idInsumo, nombre, idCategoria, idUnidad,
                stockInicial, stockMinimo, cantidadEntrada, descripcion, usuario);
    }

    public Map<String, Object> spInvGestionarEscritura(
            int tipoProceso, Integer idInsumo, String nombre,
            Integer idCategoria, Integer idUnidad,
            BigDecimal stockInicial, BigDecimal stockMinimo,
            BigDecimal cantidadEntrada, String descripcion, String usuario) {
        return ejecutarSpInventarioEscritura(tipoProceso, idInsumo, nombre, idCategoria, idUnidad,
                stockInicial, stockMinimo, cantidadEntrada, descripcion, usuario);
    }

    public List<Map<String, Object>> spRecetasGestionar(
            int tipoProceso, Integer idProducto, Integer idInsumo,
            BigDecimal cantidadRequerida, Integer idProductoInsumo) {
        return ejecutarSpRecetas(tipoProceso, idProducto, idInsumo, cantidadRequerida, idProductoInsumo);
    }

    public Map<String, Object> spRecetasGestionarEscritura(
            int tipoProceso, Integer idProducto, Integer idInsumo,
            BigDecimal cantidadRequerida, Integer idProductoInsumo) {
        return ejecutarSpRecetasEscritura(tipoProceso, idProducto, idInsumo, cantidadRequerida, idProductoInsumo);
    }

    // ════════════════════════════════════════════════════════
    // MÉTODOS PÚBLICOS — Inventario individuales
    // ════════════════════════════════════════════════════════

    public List<Map<String, Object>> spListarInsumos() {
        return ejecutarSpInventario(1, null, null, null, null, null, null, null, null, null);
    }
    public Map<String, Object> spCrearInsumo(String nombre, Integer idCategoria,
            Integer idUnidad, BigDecimal stockInicial, BigDecimal stockMinimo, String usuario) {
        return ejecutarSpInventarioEscritura(2, null, nombre, idCategoria, idUnidad,
                stockInicial, stockMinimo, null, null, usuario);
    }
    public Map<String, Object> spEditarInsumo(Integer idInsumo, String nombre,
            Integer idCategoria, Integer idUnidad, BigDecimal stockMinimo, String usuario) {
        return ejecutarSpInventarioEscritura(3, idInsumo, nombre, idCategoria, idUnidad,
                null, stockMinimo, null, null, usuario);
    }
    public Map<String, Object> spDesactivarInsumo(Integer idInsumo, String usuario) {
        return ejecutarSpInventarioEscritura(4, idInsumo, null, null, null, null, null, null, null, usuario);
    }
    public Map<String, Object> spEntradaStock(Integer idInsumo,
            BigDecimal cantidad, String descripcion, String usuario) {
        return ejecutarSpInventarioEscritura(5, idInsumo, null, null, null, null, null, cantidad, descripcion, usuario);
    }
    public List<Map<String, Object>> spListarCategoriasInsumo() {
        return ejecutarSpInventario(6, null, null, null, null, null, null, null, null, null);
    }
    public List<Map<String, Object>> spListarUnidadesMedida() {
        return ejecutarSpInventario(7, null, null, null, null, null, null, null, null, null);
    }
    public Map<String, Object> spCrearCategoriaInsumo(String nombre, String descripcion) {
        return ejecutarSpInventarioEscritura(8, null, nombre, null, null, null, null, null, descripcion, null);
    }
    public Map<String, Object> spCrearUnidadMedida(String nombre, String abreviacion) {
        return ejecutarSpInventarioEscritura(9, null, nombre, null, null, null, null, null, abreviacion, null);
    }
    public List<Map<String, Object>> spLogInventario() {
        return ejecutarSpInventario(10, null, null, null, null, null, null, null, null, null);
    }

    // ════════════════════════════════════════════════════════
    // MÉTODOS PÚBLICOS — Recetas individuales
    // ════════════════════════════════════════════════════════

    public List<Map<String, Object>> spListarRecetaProducto(Integer idProducto) {
        return ejecutarSpRecetas(1, idProducto, null, null, null);
    }
    public Map<String, Object> spAgregarInsumoReceta(Integer idProducto,
            Integer idInsumo, BigDecimal cantidadRequerida) {
        return ejecutarSpRecetasEscritura(2, idProducto, idInsumo, cantidadRequerida, null);
    }
    public Map<String, Object> spEditarCantidadReceta(Integer idProductoInsumo,
            BigDecimal cantidadRequerida) {
        return ejecutarSpRecetasEscritura(3, null, null, cantidadRequerida, idProductoInsumo);
    }
    public Map<String, Object> spEliminarInsumoReceta(Integer idProductoInsumo) {
        return ejecutarSpRecetasEscritura(4, null, null, null, idProductoInsumo);
    }
    public List<Map<String, Object>> spListarProductosConReceta() {
        return ejecutarSpRecetas(5, null, null, null, null);
    }
    public List<Map<String, Object>> spListarOpcionesConReceta() {
        return ejecutarSpRecetas(10, null, null, null, null);
    }
    public List<Map<String, Object>> spListarRecetaOpcion(Integer idSubcategoriaOpcion) {
        return ejecutarSpRecetas(6, idSubcategoriaOpcion, null, null, null);
    }
    public Map<String, Object> spAgregarInsumoRecetaOpcion(Integer idSubcategoriaOpcion,
            Integer idInsumo, BigDecimal cantidadRequerida) {
        return ejecutarSpRecetasEscritura(7, idSubcategoriaOpcion, idInsumo, cantidadRequerida, null);
    }
    public Map<String, Object> spEditarCantidadRecetaOpcion(Integer idOpcionInsumo,
            BigDecimal cantidadRequerida) {
        return ejecutarSpRecetasEscritura(8, null, null, cantidadRequerida, idOpcionInsumo);
    }
    public Map<String, Object> spEliminarInsumoRecetaOpcion(Integer idOpcionInsumo) {
        return ejecutarSpRecetasEscritura(9, null, null, null, idOpcionInsumo);
    }

    // ════════════════════════════════════════════════════════
    // HELPERS PRIVADOS
    // ════════════════════════════════════════════════════════

    private List<Map<String, Object>> leerResultSet(ResultSet rs) throws SQLException {
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

    private List<Map<String, Object>> mapResultSet(ResultSet rs) throws SQLException {
        List<Map<String, Object>> lista = new ArrayList<>();
        ResultSetMetaData meta = rs.getMetaData();
        int cols = meta.getColumnCount();
        while (rs.next()) {
            Map<String, Object> row = new LinkedHashMap<>();
            for (int i = 1; i <= cols; i++) {
                Object val = rs.getObject(i);
                if (val instanceof java.sql.Timestamp)
                    val = ((java.sql.Timestamp) val).toInstant()
                        .atZone(java.time.ZoneId.of("America/Mexico_City"))
                        .toLocalDateTime().toString();
                else if (val instanceof java.sql.Date)
                    val = val.toString();
                row.put(meta.getColumnLabel(i), val);
            }
            lista.add(row);
        }
        return lista;
    }

    private List<Map<String, Object>> mapResultSetGeneric(ResultSet rs) throws SQLException {
        List<Map<String, Object>> lista = new ArrayList<>();
        ResultSetMetaData meta = rs.getMetaData();
        int cols = meta.getColumnCount();
        while (rs.next()) {
            Map<String, Object> row = new HashMap<>();
            for (int i = 1; i <= cols; i++) {
                Object val = rs.getObject(i);
                if (val instanceof java.time.LocalDateTime) val = val.toString();
                if (val instanceof java.sql.Timestamp)
                    val = ((java.sql.Timestamp) val).toInstant()
                        .atZone(java.time.ZoneId.of("America/Mexico_City"))
                        .toLocalDateTime().toString();
                if (val instanceof java.sql.Date) val = val.toString();
                row.put(meta.getColumnLabel(i), val);
            }
            lista.add(row);
        }
        return lista;
    }

    private List<Map<String, Object>> mapResultSetSimple(ResultSet rs) throws SQLException {
        List<Map<String, Object>> lista = new ArrayList<>();
        ResultSetMetaData meta = rs.getMetaData();
        int cols = meta.getColumnCount();
        while (rs.next()) {
            Map<String, Object> row = new LinkedHashMap<>();
            for (int i = 1; i <= cols; i++)
                row.put(meta.getColumnLabel(i), rs.getObject(i));
            lista.add(row);
        }
        return lista;
    }

    private void setIntOrNull(CallableStatement cs, int idx, Integer val) throws SQLException {
        if (val != null) cs.setInt(idx, val); else cs.setNull(idx, Types.INTEGER);
    }
    private void setStrOrNull(CallableStatement cs, int idx, String val) throws SQLException {
        if (val != null && !val.isBlank()) cs.setString(idx, val); else cs.setNull(idx, Types.VARCHAR);
    }
    private void setBdOrNull(CallableStatement cs, int idx, BigDecimal val) throws SQLException {
        if (val != null) cs.setBigDecimal(idx, val); else cs.setNull(idx, Types.DECIMAL);
    }

    // ════════════════════════════════════════════════════════════
    // ACTUALIZACIÓN DE ESTATUS WHATSAPP
    // ════════════════════════════════════════════════════════════

    public Integer spSetOrdenWhatsapp(Integer idOrden, String waPhone,
            String direccion, String referencia, String metodoPago,
            Double cambioCon, String tipoEntrega) {
        final String SQL = "{call sp_set_orden_whatsapp(?, ?, ?, ?, ?, ?, ?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {
            cs.setInt(1, idOrden);
            if (waPhone == null || waPhone.isBlank()) cs.setNull(2, Types.VARCHAR);
            else                                      cs.setString(2, waPhone);
            if (direccion == null || direccion.isBlank()) cs.setNull(3, Types.VARCHAR);
            else                                          cs.setString(3, direccion);
            if (referencia == null || referencia.isBlank()) cs.setNull(4, Types.VARCHAR);
            else                                            cs.setString(4, referencia);
            if (metodoPago == null || metodoPago.isBlank()) cs.setNull(5, Types.VARCHAR);
            else                                            cs.setString(5, metodoPago);
            if (cambioCon == null) cs.setNull(6, Types.DECIMAL);
            else                   cs.setDouble(6, cambioCon);
            if (tipoEntrega == null || tipoEntrega.isBlank()) cs.setNull(7, Types.VARCHAR);
            else                                              cs.setString(7, tipoEntrega);
            boolean rs = cs.execute();
            if (rs) { try (ResultSet r = cs.getResultSet()) { if (r.next()) return r.getInt("filas"); } }
        } catch (SQLException e) {
            log.error("spSetOrdenWhatsapp error: {}", e.getMessage());
        }
        return 0;
    }

    /** Lee los datos de entrega/pago WhatsApp de una orden para mostrarlos en pantalla. */
    public Map<String, Object> obtenerInfoWhatsapp(Integer idOrden) {
        final String SQL = "SELECT wa_phone, wa_direccion, wa_referencia, wa_metodo_pago, " +
                           "wa_cambio_con, wa_tipo_entrega, n_nombre_cliente, p_total " +
                           "FROM orden WHERE id_orden = ?";
        Map<String, Object> info = new java.util.HashMap<>();
        try (Connection conn = conexionJDBC.getConexion2();
             PreparedStatement ps = conn.prepareStatement(SQL)) {
            ps.setInt(1, idOrden);
            try (ResultSet r = ps.executeQuery()) {
                if (r.next()) {
                    info.put("telefono",     r.getString("wa_phone"));
                    info.put("direccion",    r.getString("wa_direccion"));
                    info.put("referencia",   r.getString("wa_referencia"));
                    info.put("metodoPago",   r.getString("wa_metodo_pago"));
                    Object cambio = r.getObject("wa_cambio_con");
                    info.put("cambioCon",    cambio);
                    info.put("tipoEntrega",  r.getString("wa_tipo_entrega"));
                    info.put("cliente",      r.getString("n_nombre_cliente"));
                    info.put("total",        r.getObject("p_total"));
                }
            }
        } catch (SQLException e) {
            log.error("obtenerInfoWhatsapp error: {}", e.getMessage());
        }
        return info;
    }

    /** Devuelve true si el numero esta en la lista de bloqueados activos (el bot no debe responderle). */
    public boolean numeroBloqueado(String numero) {
        if (numero == null || numero.isBlank()) return false;
        final String SQL = "SELECT 1 FROM wa_numeros_bloqueados WHERE numero = ? AND f_activo = 1 LIMIT 1";
        try (Connection conn = conexionJDBC.getConexion2();
             PreparedStatement ps = conn.prepareStatement(SQL)) {
            ps.setString(1, numero);
            try (ResultSet r = ps.executeQuery()) {
                return r.next();
            }
        } catch (SQLException e) {
            log.error("numeroBloqueado error: {}", e.getMessage());
            return false; // ante error, no bloquear (mejor responder que dejar al cliente sin atencion)
        }
    }

    public Integer spRegistrarActualizacion(Integer idOrden, String estatus, String mensaje,
            String tiempoEstimado, String telefonoRepartidor, String usuarioAdmin, boolean enviado) {
        final String SQL = "{call sp_actualizacion_orden(?, ?, ?, ?, ?, ?, ?, ?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {
            cs.setInt(1, 1);
            cs.setInt(2, idOrden);
            cs.setString(3, estatus);
            cs.setString(4, mensaje);
            if (tiempoEstimado == null || tiempoEstimado.isBlank())         cs.setNull(5, Types.VARCHAR); else cs.setString(5, tiempoEstimado);
            if (telefonoRepartidor == null || telefonoRepartidor.isBlank()) cs.setNull(6, Types.VARCHAR); else cs.setString(6, telefonoRepartidor);
            if (usuarioAdmin == null || usuarioAdmin.isBlank())             cs.setNull(7, Types.VARCHAR); else cs.setString(7, usuarioAdmin);
            cs.setInt(8, enviado ? 1 : 0);
            boolean rs = cs.execute();
            if (rs) { try (ResultSet r = cs.getResultSet()) { if (r.next()) return r.getInt("id_actualizacion"); } }
        } catch (SQLException e) {
            log.error("spRegistrarActualizacion error: {}", e.getMessage());
        }
        return null;
    }

    public List<Map<String, Object>> spHistorialActualizaciones(Integer idOrden) {
        final String SQL = "{call sp_actualizacion_orden(?, ?, ?, ?, ?, ?, ?, ?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {
            cs.setInt(1, 2);
            cs.setInt(2, idOrden);
            cs.setNull(3, Types.VARCHAR); cs.setNull(4, Types.VARCHAR);
            cs.setNull(5, Types.VARCHAR); cs.setNull(6, Types.VARCHAR);
            cs.setNull(7, Types.VARCHAR); cs.setNull(8, Types.INTEGER);
            boolean rs = cs.execute();
            if (rs) { try (ResultSet r = cs.getResultSet()) { return mapResultSetSimple(r); } }
        } catch (SQLException e) {
            log.error("spHistorialActualizaciones error: {}", e.getMessage());
        }
        return new ArrayList<>();
    }

    public Integer spMarcarActualizacionEnviada(Integer idActualizacion) {
        final String SQL = "{call sp_actualizacion_orden(?, ?, ?, ?, ?, ?, ?, ?)}";
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {
            cs.setInt(1, 3);
            cs.setInt(2, idActualizacion);
            cs.setNull(3, Types.VARCHAR); cs.setNull(4, Types.VARCHAR);
            cs.setNull(5, Types.VARCHAR); cs.setNull(6, Types.VARCHAR);
            cs.setNull(7, Types.VARCHAR); cs.setNull(8, Types.INTEGER);
            boolean rs = cs.execute();
            if (rs) { try (ResultSet r = cs.getResultSet()) { if (r.next()) return r.getInt("filas"); } }
        } catch (SQLException e) {
            log.error("spMarcarActualizacionEnviada error: {}", e.getMessage());
        }
        return 0;
    }

    public Map<String, Object> spDatosEnvioOrden(Integer idOrden) {
        final String SQL = "SELECT id_orden, source, wa_phone, n_estatus_orden, n_nombre_cliente FROM orden WHERE id_orden = ?";
        try (Connection conn = conexionJDBC.getConexion2();
             PreparedStatement ps = conn.prepareStatement(SQL)) {
            ps.setInt(1, idOrden);
            try (ResultSet r = ps.executeQuery()) {
                List<Map<String, Object>> filas = mapResultSetSimple(r);
                if (!filas.isEmpty()) return filas.get(0);
            }
        } catch (SQLException e) {
            log.error("spDatosEnvioOrden error: {}", e.getMessage());
        }
        return Collections.emptyMap();
    }
}
