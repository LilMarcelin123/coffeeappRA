package com.icaro.coffeeapp.repository;

import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

import com.icaro.coffeeapp.model.SysUser;

@Repository
public interface SysUserRepository extends CrudRepository<SysUser, Integer> {
	public SysUser findByUsername(String username);
}