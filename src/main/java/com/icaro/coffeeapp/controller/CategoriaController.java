/*
package com.icaro.coffeeapp.controller;

import com.icaro.coffeeapp.model.Categoria;
import com.icaro.coffeeapp.repository.CategoriaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.List;

@Controller
public class CategoriaController {

    @Autowired
    private CategoriaRepository categoriaRepository;

    @GetMapping("/admin/tomaOrden")
    public String mostrarFormularioAgregarProducto(Model model) {

        List<Categoria> categorias = categoriaRepository.findAll();

        System.out.println("CATEGORIAS ENCONTRADAS: " + categorias.size());

        model.addAttribute("categorias", categorias);

        return "admin/tomaOrden";   // -> templates/admin/tomaOrden.html
    }
}
*/