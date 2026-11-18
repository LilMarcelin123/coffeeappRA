package com.icaro.coffeeapp.service;

import java.math.BigDecimal;
import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.stereotype.Service;

import com.icaro.coffeeapp.utils.ConexionJDBC;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Apertura de caja: el fondo con el que se abre cada dia de negocio.
 *
 * Todo pasa por sp_gestion_apertura. Este servicio solo recuerda en
 * memoria el ultimo dia que YA quedo abierto, para que el candado de
 * las pantallas de administrador no consulte la base en cada clic:
 * una vez abierta la caja de hoy, ya no se vuelve a preguntar hasta
 * que cambie el dia de negocio (01:00).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AperturaCajaService {

    private static final String SQL  = "{CALL sp_gestion_apertura(?,?,?,?)}";
    private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

    private final ConexionJDBC conexionJDBC;

    /** Ultimo dia de negocio confirmado como abierto. */
    private final AtomicReference<LocalDate> diaAbierto = new AtomicReference<>();

    /** Dia de negocio en curso: de 01:00 a 01:00, igual que caja y el cierre. */
    public static LocalDate diaDeNegocio() {
        return LocalDateTime.now(ZONA).minusHours(1).toLocalDate();
    }

    /**
     * ¿Ya se abrio la caja del dia en curso?
     *
     * Si la base no responde, deja pasar: un fallo de conexion no debe
     * dejar al negocio sin poder cobrar. El fondo en ese caso cuenta 0
     * y el arqueo lo va a evidenciar.
     */
    public boolean cajaAbiertaHoy() {
        LocalDate hoy = diaDeNegocio();
        if (hoy.equals(diaAbierto.get())) return true;

        Map<String, Object> apertura = consultar();
        if (apertura == null) return true;

        boolean abierta = apertura.get("f_abierta") instanceof Number n && n.intValue() == 1;
        if (abierta) diaAbierto.set(hoy);
        return abierta;
    }

    /** La apertura del dia en curso (f_abierta = 0 si todavia no hay). Null si la base fallo. */
    public Map<String, Object> consultar() {
        return llamar(2, null, null, null);
    }

    /** Registra el fondo del dia. Devuelve resultado (1, 0, -1) y mensaje. */
    public Map<String, Object> registrar(BigDecimal fondo, String responsable, String usuario) {
        Map<String, Object> salida = llamar(1, fondo, responsable, usuario);
        if (salida == null) {
            salida = new LinkedHashMap<>();
            salida.put("resultado", -1);
            salida.put("mensaje", "La base no respondio. Intenta de nuevo.");
        }
        if (salida.get("resultado") instanceof Number n && n.intValue() == 1) {
            diaAbierto.set(diaDeNegocio());
        }
        return salida;
    }

    // ── Plomeria ────────────────────────────────────────────────

    private Map<String, Object> llamar(int proceso, BigDecimal fondo,
                                       String responsable, String usuario) {
        try (Connection conn = conexionJDBC.getConexion2();
             CallableStatement cs = conn.prepareCall(SQL)) {

            cs.setInt(1, proceso);
            if (fondo == null) cs.setNull(2, Types.DECIMAL); else cs.setBigDecimal(2, fondo);
            texto(cs, 3, responsable);
            texto(cs, 4, usuario);

            try (ResultSet rs = cs.executeQuery()) {
                if (rs == null || !rs.next()) return null;
                ResultSetMetaData meta = rs.getMetaData();
                Map<String, Object> fila = new LinkedHashMap<>();
                for (int i = 1; i <= meta.getColumnCount(); i++) {
                    fila.put(meta.getColumnLabel(i), rs.getObject(i));
                }
                return fila;
            }

        } catch (SQLException e) {
            log.error("sp_gestion_apertura proceso {}: {}", proceso, e.getMessage());
            return null;
        }
    }

    private void texto(CallableStatement cs, int pos, String valor) throws SQLException {
        if (valor == null || valor.isBlank()) cs.setNull(pos, Types.VARCHAR);
        else                                  cs.setString(pos, valor.trim());
    }
}
