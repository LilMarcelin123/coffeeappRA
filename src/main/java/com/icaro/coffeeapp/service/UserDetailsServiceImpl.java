package com.icaro.coffeeapp.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.icaro.coffeeapp.model.SecurityUser;
import com.icaro.coffeeapp.model.SysUser;
import com.icaro.coffeeapp.repository.SysUserRepository;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {
	
    @Autowired
    private SysUserRepository userRepository;   
    
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        System.out.println("Buscando usuario: " + username);  

        SysUser user = userRepository.findByUsername(username);
        if (user == null) {
            System.out.println("Usuario no encontrado");
            throw new UsernameNotFoundException("Usuario no encontrado");
        }

        System.out.println("Usuario encontrado: " + user.getUsername() + " con rol " + user.getId_rol());
        return new SecurityUser(user);
    }
}
