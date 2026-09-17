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
 * Caja: la libreta de entradas y salidas de efectivo, y el arqueo.
 *
 * Todo pasa por sp_gestion_caja. Ese procedimiento es el unico que
 * sabe donde empieza el turno en curso (el ultimo arqueo del dia, o
 * la 01:00 si todavia no hay ninguno) y cuanto vale el fondo de caja,
 * asi que ni este servicio ni el navegador calculan nada de eso.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CajaService {

    /** 1 registrar mov · 2 movs del turno · 3 resumen · 4 arqueo · 5 historial · 6 movs de un arqueo · 7 borrar mov */
    private static final String SQL = "{CALL sp_gestion_caja(?,?,?,?,?,?,?,?,?)}";

    private final ConexionJDBC conexionJDBC;

    // ── API publica ─────────────────────────────────────────────

    /** Anota una salida o entrada de efectivo. Devuelve resultado + mensaje. */
    public Map<String, Object> registrarMovimiento(String tipo, String categoria,
                                                   BigDecimal monto, String concepto,
                                                   String usuario) {
        return unaFila(1, tipo, categoria, monto, concepto, usuario, null, null, null);
    }

    /** Movimientos del turno en curso, todavia sin arquear. */
    public List<Map<String, Object>> movimientosDelTurno() {
        return filas(2, null, null, null, null, null, null, null, null);
    }

    /** Fondo, venta en efectivo, entradas, salidas y lo que deberia haber en caja. */
    public Map<String, Object> resumenDelTurno() {
        return unaFila(3, null, null, null, null, null, null, null, null);
    }

    /** Cierra el turno con lo que se conto fisicamente y sella sus movimientos. */
    public Map<String, Object> registrarArqueo(BigDecimal contado, String observaciones,
                                               String usuario) {
        return unaFila(4, null, null, contado, observaciones, usuario, null, null, null);
    }

    /** Arqueos de un rango de dias de negocio. Sin fechas, los de hoy. */
    public List<Map<String, Object>> historialArqueos(LocalDate desde, LocalDate hasta) {
        return filas(5, null, null, null, null, null, desde, hasta, null);
    }

    /** Los movimientos que quedaron dentro de un arqueo ya firmado. */
    public List<Map<String, Object>> movimientosDeArqueo(int idArqueo) {
        return filas(6, null, null, null, null, null, null, null, idArqueo);
    }

    /** Borra un movimiento mientras no se haya arqueado. */
    public Map<String, Object> borrarMovimiento(int idMovimiento) {
        return unaFila(7, null, null, null, null, null, null, null, idMovimiento);
    }

    // ── Plomeria ────────────────────────────────────────────────

    private List<Map<String, Object>> filas(int proceso, String tipo, String categoria,
                                            BigDecimal monto, String concepto, String usuario,
                                            LocalDate desde, LocalDate hasta, Integer id) {
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            enlazar(cs, proceso, tipo, categoria, monto, concepto, usuario, desde, hasta, id);

            try (ResultSet rs = cs.executeQuery()) {
                return mapear(rs);
            }

        } catch (SQLException e) {
            log.error("sp_gestion_caja proceso {}: {}", proceso, e.getMessage());
            return new ArrayList<>();
        }
    }

    private Map<String, Object> unaFila(int proceso, String tipo, String categoria,
                                        BigDecimal monto, String concepto, String usuario,
                                        LocalDate desde, LocalDate hasta, Integer id) {
        List<Map<String, Object>> filas = filas(proceso, tipo, categoria, monto,
                                                concepto, usuario, desde, hasta, id);
        if (!filas.isEmpty()) return filas.get(0);

        Map<String, Object> error = new LinkedHashMap<>();
        error.put("resultado", -1);
        error.put("mensaje", "La base no respondio a la operacion de caja.");
        return error;
    }

    private void enlazar(CallableStatement cs, int proceso, String tipo, String categoria,
                         BigDecimal monto, String concepto, String usuario,
                         LocalDate desde, LocalDate hasta, Integer id) throws SQLException {

        cs.setInt(1, proceso);
        texto(cs, 2, tipo);
        texto(cs, 3, categoria);

        if (monto == null) cs.setNull(4, Types.DECIMAL); else cs.setBigDecimal(4, monto);

        texto(cs, 5, concepto);
        texto(cs, 6, usuario);
        fecha(cs, 7, desde);
        fecha(cs, 8, hasta);

        if (id == null) cs.setNull(9, Types.INTEGER); else cs.setInt(9, id);
    }

    private void texto(CallableStatement cs, int pos, String valor) throws SQLException {
        if (valor == null || valor.isBlank()) cs.setNull(pos, Types.VARCHAR);
        else                                  cs.setString(pos, valor.trim());
    }

    private void fecha(CallableStatement cs, int pos, LocalDate valor) throws SQLException {
        if (valor == null) cs.setNull(pos, Types.DATE);
        else               cs.setDate(pos, java.sql.Date.valueOf(valor));
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
