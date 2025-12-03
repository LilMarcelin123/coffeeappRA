package com.icaro.coffeeapp.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "sys_roles_usuario")
@AllArgsConstructor
@NoArgsConstructor
@Data
public class SysRolesUsuario {
	@Id
	@Column(name = "id_rol")
	private Integer idrole;
	
	@Column(name = "rol")
	private String rol;

	@Column(name = "description")
	private String description;

	
}