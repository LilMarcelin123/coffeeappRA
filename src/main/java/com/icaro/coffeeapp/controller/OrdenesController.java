package com.icaro.coffeeapp.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import com.icaro.coffeeapp.model.Categoria;
import com.icaro.coffeeapp.model.Producto;
import com.icaro.coffeeapp.repository.CategoriaRepository;
import com.icaro.coffeeapp.repository.ProductoRepository;
import com.icaro.coffeeapp.repository.SubcategoriaOpcionRepository;
import com.icaro.coffeeapp.model.Subcategoria;
import com.icaro.coffeeapp.model.SubcategoriaOpcion;
import com.icaro.coffeeapp.repository.SubcategoriaRepository;


@Controller
public class OrdenesController {

	@Autowired
	private SubcategoriaRepository subcategoriaRepository;
	
	@Autowired
	private SubcategoriaOpcionRepository subcategoriaOpcionRepository;
	
    @Autowired
    private CategoriaRepository categoriaRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @GetMapping({"/admin/tomaOrden", "/tomaOrden"})
    public String mostrarTomaOrden(
            @RequestParam(name = "idOrden", required = false) Integer idOrden,
            Model model) {
        List<Categoria> categorias = categoriaRepository.findAll();
        System.out.println("CATEGORIAS ENCONTRADAS: " + categorias.size());
        model.addAttribute("categorias", categorias);

        model.addAttribute("idOrden", idOrden);

        return "admin/tomaOrden";
    }

    
    @GetMapping("/api/productosPorCategoria/{idCategoria}")
    @ResponseBody
    public List<Map<String, Object>> productosPorCategoria(@PathVariable Integer idCategoria) {

        List<Producto> productos = productoRepository.findByCategoria_Idcategoria(idCategoria);

        return productos.stream().map(p -> {
            Map<String, Object> item = new HashMap<>();
            item.put("id", p.getIdproducto());
            item.put("nombre", p.getNnombreproducto());
            item.put("precio", p.getPreciobase());
            item.put("descripcion", p.getDescripcion());
            return item;
        }).collect(Collectors.toList());

    }

    @GetMapping("/api/subcategoriaPorCategoria/{idCategoria}")
    @ResponseBody
    public Map<String, Object> subcategoriaPorCategoria(@PathVariable Integer idCategoria) {

 
        return subcategoriaRepository.findById(idCategoria)
                .map(s -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", s.getIdsubcategoria());
                    item.put("nombre", s.getNnombresubcategoria());
                    return item;
                })
                .orElseGet(HashMap::new); 
    }
    
    @GetMapping("/api/opcionesPorSubcategoria/{idSubcategoria}")
    @ResponseBody
    public List<Map<String, Object>> opcionesPorSubcategoria(@PathVariable Integer idSubcategoria) {
        List<SubcategoriaOpcion> opciones =
                subcategoriaOpcionRepository.findBySubcategoria_Idsubcategoria(idSubcategoria);

        return opciones.stream().map(o -> {
            Map<String, Object> item = new HashMap<>();
            item.put("id", o.getId());
            item.put("nombre", o.getNombre());
            item.put("precio", o.getPrecioExtra());
            return item;
        }).collect(Collectors.toList());
    }

}
