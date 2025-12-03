package com.icaro.coffeeapp.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.icaro.coffeeapp.model.Categoria;

public interface CategoriaRepository extends JpaRepository<Categoria, Integer> {
    List<Categoria> findByFcategoriaactivo(Integer fcategoriaactivo);
}
