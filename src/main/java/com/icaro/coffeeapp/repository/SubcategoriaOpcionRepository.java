package com.icaro.coffeeapp.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.icaro.coffeeapp.model.SubcategoriaOpcion;

public interface SubcategoriaOpcionRepository extends JpaRepository<SubcategoriaOpcion, Integer> {

    List<SubcategoriaOpcion> findBySubcategoria_Idsubcategoria(Integer idsubcategoria);

}

