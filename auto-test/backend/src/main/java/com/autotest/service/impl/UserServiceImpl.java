package com.autotest.service.impl;

import com.autotest.exception.BusinessException;
import com.autotest.mapper.SysUserMapper;
import com.autotest.model.entity.SysUser;
import com.autotest.model.vo.UserVO;
import com.autotest.service.UserService;
import com.autotest.util.JwtUtil;
import com.autotest.util.PasswordValidator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class UserServiceImpl implements UserService {

    @Autowired
    private SysUserMapper userMapper;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserVO createUser(String username, String password, String displayName, String role, Long tenantId) {
        if (userMapper.selectByUsername(username) != null) {
            throw new BusinessException(409, "用户名已存在: " + username);
        }
        
        // 验证密码强度
        PasswordValidator.PasswordStrengthResult result = PasswordValidator.validatePassword(password);
        if (!result.isValid()) {
            throw new BusinessException(400, result.getMessage());
        }
        
        SysUser user = new SysUser();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setDisplayName(displayName != null ? displayName : username);
        user.setRole(role != null ? role : "USER");
        user.setTenantId(tenantId);
        user.setStatus(1);
        userMapper.insert(user);
        return toVO(user);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserVO updateUser(Long id, String displayName, String password, String role, Integer status) {
        SysUser existing = userMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException(404, "用户不存在");
        }
        
        // 如果提供了新密码，验证密码强度
        if (password != null && !password.isEmpty()) {
            PasswordValidator.PasswordStrengthResult result = PasswordValidator.validatePassword(password);
            if (!result.isValid()) {
                throw new BusinessException(400, result.getMessage());
            }
        }
        
        SysUser user = new SysUser();
        user.setId(id);
        if (displayName != null) user.setDisplayName(displayName);
        if (password != null && !password.isEmpty()) user.setPassword(passwordEncoder.encode(password));
        if (role != null) user.setRole(role);
        if (status != null) user.setStatus(status);
        userMapper.update(user);
        return toVO(userMapper.selectById(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteUser(Long id) {
        userMapper.deleteById(id);
    }

    @Override
    public UserVO getUserById(Long id) {
        SysUser user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException(404, "用户不存在");
        }
        return toVO(user);
    }

    @Override
    public Map<String, Object> listUsers(String keyword, Long tenantId, int pageNo, int pageSize) {
        int offset = (pageNo - 1) * pageSize;
        List<SysUser> list = userMapper.selectList(keyword, tenantId, offset, pageSize);
        int total = userMapper.countList(keyword, tenantId);
        Map<String, Object> data = new HashMap<>();
        data.put("list", list.stream().map(this::toVO).collect(Collectors.toList()));
        data.put("total", total);
        data.put("pageNo", pageNo);
        data.put("pageSize", pageSize);
        return data;
    }

    @Override
    public Map<String, Object> login(String username, String password) {
        SysUser user = userMapper.selectByUsername(username);
        if (user == null) {
            throw new BusinessException(401, "用户名或密码错误");
        }
        if (user.getStatus() != 1) {
            throw new BusinessException(403, "账号已被禁用");
        }
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new BusinessException(401, "用户名或密码错误");
        }
        userMapper.updateLoginTime(user.getId());
        String token = JwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole(), user.getTenantId());
        Map<String, Object> result = new HashMap<>();
        result.put("token", token);
        result.put("user", toVO(user));
        return result;
    }

    private UserVO toVO(SysUser user) {
        UserVO vo = new UserVO();
        vo.setId(user.getId());
        vo.setUsername(user.getUsername());
        vo.setDisplayName(user.getDisplayName());
        vo.setRole(user.getRole());
        vo.setTenantId(user.getTenantId());
        vo.setStatus(user.getStatus());
        vo.setLastLoginTime(user.getLastLoginTime());
        vo.setCreateTime(user.getCreateTime());
        return vo;
    }
}
