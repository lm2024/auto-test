package com.autotest.service;

import com.autotest.model.entity.SysUser;
import com.autotest.model.vo.UserVO;

import java.util.Map;

public interface UserService {
    UserVO createUser(String username, String password, String displayName, String role, Long tenantId);
    UserVO updateUser(Long id, String displayName, String password, String role, Integer status);
    void deleteUser(Long id);
    UserVO getUserById(Long id);
    Map<String, Object> listUsers(String keyword, Long tenantId, int pageNo, int pageSize);
    Map<String, Object> login(String username, String password);
}
