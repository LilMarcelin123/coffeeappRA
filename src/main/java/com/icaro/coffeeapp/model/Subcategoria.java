package com.icaro.coffeeapp.model;

import jakarta.persistence.*;

@Entity
@Table(name = "subcategoria")
public class Subcategoria {

    @Id
    @Column(name = "id_subcategoria")
    private Integer idsubcategoria;

    @Column(name = "n_nombre_subcategoria")
    private String nnombresubcategoria;

    public Subcategoria() {}

    public Subcategoria(Integer idsubcategoria, String nnombresubcategoria) {
        this.idsubcategoria = idsubcategoria;
        this.nnombresubcategoria = nnombresubcategoria;
    }

    public Integer getIdsubcategoria() {
        return idsubcategoria;
    }

    public void setIdsubcategoria(Integer idsubcategoria) {
        this.idsubcategoria = idsubcategoria;
    }

    public String getNnombresubcategoria() {
        return nnombresubcategoria;
    }

    public void setNnombresubcategoria(String nnombresubcategoria) {
        this.nnombresubcategoria = nnombresubcategoria;
    }
}