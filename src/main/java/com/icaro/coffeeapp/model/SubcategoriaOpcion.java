package com.icaro.coffeeapp.model;

import java.math.BigDecimal;
import jakarta.persistence.*;

@Entity
@Table(name = "subcategoria_opcion")
public class SubcategoriaOpcion {

    @Id
    @Column(name = "id_subcategoria_opcion")
    private Integer id;

    // 🚨 AQUÍ EL CAMBIO IMPORTANTE
    @ManyToOne
    @JoinColumn(name = "id_subcategoria", referencedColumnName = "id_subcategoria")
    private Subcategoria subcategoria;

    @Column(name = "n_nombre_subcategoria_opciones")
    private String nombre;

    @Column(name = "p_precio_extra", precision = 10, scale = 2)
    private BigDecimal precioExtra;

    public SubcategoriaOpcion() {}

    public SubcategoriaOpcion(Integer id, Subcategoria subcategoria, String nombre, BigDecimal precioExtra) {
        this.id = id;
        this.subcategoria = subcategoria;
        this.nombre = nombre;
        this.precioExtra = precioExtra;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Subcategoria getSubcategoria() {
        return subcategoria;
    }

    public void setSubcategoria(Subcategoria subcategoria) {
        this.subcategoria = subcategoria;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public BigDecimal getPrecioExtra() {
        return precioExtra;
    }

    public void setPrecioExtra(BigDecimal precioExtra) {
        this.precioExtra = precioExtra;
    }
}

