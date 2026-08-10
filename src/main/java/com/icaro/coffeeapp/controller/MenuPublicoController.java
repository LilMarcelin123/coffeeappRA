package com.icaro.coffeeapp.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import com.icaro.coffeeapp.model.Categoria;
import com.icaro.coffeeapp.model.Producto;
import com.icaro.coffeeapp.repository.CategoriaRepository;
import com.icaro.coffeeapp.repository.ProductoRepository;

@RestController
public class MenuPublicoController {

    @Autowired
    private CategoriaRepository categoriaRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @GetMapping("/menu/api/catalogo")
    public List<Map<String, Object>> catalogo() {
        return categoriaRepository.findAll().stream()
                .filter(c -> c.getFcategoriaactivo() == null || c.getFcategoriaactivo() == 1)
                .map(c -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id",     c.getIdcategoria());
                    item.put("nombre", c.getNnombrecategoria());
                    return item;
                }).collect(Collectors.toList());
    }

    @GetMapping("/menu/api/productos/{idCategoria}")
    public List<Map<String, Object>> productos(@PathVariable Integer idCategoria) {
        List<Producto> productos = productoRepository.findByCategoria_Idcategoria(idCategoria);
        return productos.stream()
            .filter(p -> p.getProductoActivo() == null || p.getProductoActivo() == 1)
            .map(p -> {
            Map<String, Object> item = new HashMap<>();
            item.put("id",          p.getIdproducto());
            item.put("nombre",      p.getNnombreproducto());
            item.put("precio",      p.getPreciobase());
            item.put("descripcion", p.getDescripcion());
            return item;
        }).collect(Collectors.toList());
    }
}
