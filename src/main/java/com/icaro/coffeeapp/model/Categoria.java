package com.icaro.coffeeapp.model;


import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "categoria")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Categoria {

    @Id
    @Column
    (name= "id_categoria")
    private Integer idcategoria;
    
    @Column(name= "n_nombre_categoria")
    private String nnombrecategoria;
    
    @Column(name= "f_categoria_activo")
    private Integer fcategoriaactivo;
    
    public Integer getIdcategoria() {
        return idcategoria;
    }

    public String getNnombrecategoria() {
        return nnombrecategoria;
    }

    public Integer getFcategoriaactivo() {
        return fcategoriaactivo;
    }
}
