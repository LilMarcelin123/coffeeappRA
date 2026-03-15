package com.icaro.coffeeapp.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.math.BigDecimal;

@Entity
@Table(name = "producto")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Producto {

    @Id
    @Column(name = "id_producto")
    private Integer idproducto;

    @ManyToOne
    @JoinColumn(name = "id_categoria")
    private Categoria categoria;

    @Column(name = "n_nombre_producto")
    private String nnombreproducto;

    @Column(name = "p_precio_base", precision = 10, scale = 2)
    private BigDecimal preciobase;

    @Column(name = "n_descripcion")
    private String descripcion;

    @Column(name = "f_producto_activo")
    private Integer productoActivo;
}