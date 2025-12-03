package com.icaro.coffeeapp.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.icaro.coffeeapp.model.Producto;

public interface ProductoRepository extends JpaRepository<Producto, Integer> {

    List<Producto> findByCategoria_Idcategoria(Integer idcategoria);

}
