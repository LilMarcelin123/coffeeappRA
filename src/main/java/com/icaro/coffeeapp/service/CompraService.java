package com.icaro.coffeeapp.service;

import java.math.BigDecimal;
import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.icaro.coffeeapp.utils.ConexionJDBC;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Compras del dia: lo que se compra para operar (fruta, pollo,
 * desechables...) con su concepto, su monto y de donde salio el dinero.
 *
 * Todo pasa por sp_gestion_compras. Una compra de CAJA anota ademas su
 * SALIDA en caja_movimiento dentro del mismo procedimiento, asi que el
 * arqueo la descuenta solo y este servicio no suma ni resta nada.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CompraService {

    /** 1 registrar · 2 compras de un dia · 3 cancelar · 4 condensado del dia */
    private static final String SQL = "{CALL sp_gestion_compras(?,?,?,?,?,?,?,?)}";

    private final ConexionJDBC conexionJDBC;

    // ── API publica ─────────────────────────────────────────────

    /** Anota una compra. origen: CAJA o FUERA (con detalle). */
    public Map<String, Object> registrar(String concepto, BigDecimal monto, String origen,
                                         String origenDetalle, String usuario) {
        return unaFila(1, concepto, monto, origen, origenDetalle, usuario, null, null);
    }

    /** Compras activas de un dia de negocio. Sin dia, las de hoy. */
    public List<Map<String, Object>> delDia(LocalDate dia) {
        return filas(2, null, null, null, null, null, dia, null);
    }

    /** Cancela una compra mientras su salida no haya entrado en un arqueo. */
    public Map<String, Object> cancelar(int idCompra, String usuario) {
        return unaFila(3, null, null, null, null, usuario, null, idCompra);
    }

    /** Venta del dia, compras de caja y de fuera, y el resultado. Sin dia, hoy. */
    public Map<String, Object> condensado(LocalDate dia) {
        return unaFila(4, null, null, null, null, null, dia, null);
    }

    // ── Plomeria ────────────────────────────────────────────────

    private List<Map<String, Object>> filas(int proceso, String concepto, BigDecimal monto,
                                            String origen, String origenDetalle, String usuario,
                                            LocalDate dia, Integer id) {
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            enlazar(cs, proceso, concepto, monto, origen, origenDetalle, usuario, dia, id);

            try (ResultSet rs = cs.executeQuery()) {
                return mapear(rs);
            }

        } catch (SQLException e) {
            log.error("sp_gestion_compras proceso {}: {}", proceso, e.getMessage());
            return new ArrayList<>();
        }
    }

    private Map<String, Object> unaFila(int proceso, String concepto, BigDecimal monto,
                                        String origen, String origenDetalle, String usuario,
                                        LocalDate dia, Integer id) {
        List<Map<String, Object>> filas = filas(proceso, concepto, monto, origen,
                                                origenDetalle, usuario, dia, id);
        if (!filas.isEmpty()) return filas.get(0);

        Map<String, Object> error = new LinkedHashMap<>();
        error.put("resultado", -1);
        error.put("mensaje", "La base no respondio a la operacion de compras.");
        return error;
    }

    private void enlazar(CallableStatement cs, int proceso, String concepto, BigDecimal monto,
                         String origen, String origenDetalle, String usuario,
                         LocalDate dia, Integer id) throws SQLException {

        cs.setInt(1, proceso);
        texto(cs, 2, concepto);

        if (monto == null) cs.setNull(3, Types.DECIMAL); else cs.setBigDecimal(3, monto);

        texto(cs, 4, origen);
        texto(cs, 5, origenDetalle);
        texto(cs, 6, usuario);

        if (dia == null) cs.setNull(7, Types.DATE);
        else             cs.setDate(7, java.sql.Date.valueOf(dia));

        if (id == null) cs.setNull(8, Types.INTEGER); else cs.setInt(8, id);
    }

    private void texto(CallableStatement cs, int pos, String valor) throws SQLException {
        if (valor == null || valor.isBlank()) cs.setNull(pos, Types.VARCHAR);
        else                                  cs.setString(pos, valor.trim());
    }

    private List<Map<String, Object>> mapear(ResultSet rs) throws SQLException {
        List<Map<String, Object>> salida = new ArrayList<>();
        if (rs == null) return salida;

        ResultSetMetaData meta = rs.getMetaData();
        int columnas = meta.getColumnCount();

        while (rs.next()) {
            Map<String, Object> fila = new LinkedHashMap<>();
            for (int i = 1; i <= columnas; i++) {
                fila.put(meta.getColumnLabel(i), rs.getObject(i));
            }
            salida.add(fila);
        }
        return salida;
    }
}
