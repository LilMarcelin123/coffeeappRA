package com.icaro.coffeeapp.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.icaro.coffeeapp.model.SysRolesUsuario;

@Repository
public interface SysRolesUsuarioRepository extends JpaRepository<SysRolesUsuario, Integer> {
	public SysRolesUsuario findByRol(String rol);
}