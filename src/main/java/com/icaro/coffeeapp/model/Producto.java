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
    
    public Producto() {
    }

    public Producto(Integer idproducto, Categoria categoria, String nnombreproducto,
    		BigDecimal preciobase, String descripcion, Integer productoActivo) {
        this.idproducto = idproducto;
        this.categoria = categoria;
        this.nnombreproducto = nnombreproducto;
        this.preciobase = preciobase;
        this.descripcion = descripcion;
        this.productoActivo = productoActivo;
    }



    public Integer getIdproducto() {
        return idproducto;
    }

    public void setIdproducto(Integer idproducto) {
        this.idproducto = idproducto;
    }

    public Categoria getCategoria() {
        return categoria;
    }

    public void setCategoria(Categoria categoria) {
        this.categoria = categoria;
    }

    public String getNnombreproducto() {
        return nnombreproducto;
    }

    public void setNnombreproducto(String nnombreproducto) {
        this.nnombreproducto = nnombreproducto;
    }

    public BigDecimal getPreciobase() {
        return preciobase;
    }

    public void setPreciobase(BigDecimal preciobase) {
        this.preciobase = preciobase;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public Integer getProductoActivo() {
        return productoActivo;
    }

    public void setProductoActivo(Integer productoActivo) {
        this.productoActivo = productoActivo;
    }

}
