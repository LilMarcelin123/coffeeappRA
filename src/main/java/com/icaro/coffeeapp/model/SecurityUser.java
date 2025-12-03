package com.icaro.coffeeapp.model;

import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;

@AllArgsConstructor
@NoArgsConstructor
public class SecurityUser implements UserDetails {

    private static final long serialVersionUID = -2510729751029070538L;
    private SysUser user;

    public SecurityUser(SysUser user) {
        this.user = user;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        String roleName;

        switch (user.getId_rol()) {
            case 1 -> roleName = "ROLE_ADMINISTRADOR";
            case 2 -> roleName = "ROLE_OPERADOR_SALADOS";
            case 3 -> roleName = "ROLE_OPERADOR_CREPAS_WAFFLES";
            case 4 -> roleName = "ROLE_OPERADOR_BEBIDAS_CALIENTES";
            case 5 -> roleName = "ROLE_OPERADOR_BEBIDAS_FRIAS";
            case 6 -> roleName = "ROLE_OPERADOR_FITNESS";
            default -> roleName = "ROLE_USER";
        }

        return Collections.singletonList(new SimpleGrantedAuthority(roleName));
    }

    @Override
    public String getPassword() {
        return user.getPassword();
    }

    @Override
    public String getUsername() {
        return user.getUsername();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
