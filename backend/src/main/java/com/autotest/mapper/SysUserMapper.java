package com.autotest.mapper;

import com.autotest.model.entity.SysUser;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SysUserMapper {
    int insert(SysUser user);
    int update(SysUser user);
    int deleteById(@Param("id") Long id);
    SysUser selectById(@Param("id") Long id);
    SysUser selectByUsername(@Param("username") String username);
    List<SysUser> selectList(@Param("keyword") String keyword,
                             @Param("tenantId") Long tenantId,
                             @Param("offset") int offset,
                             @Param("pageSize") int pageSize);
    int countList(@Param("keyword") String keyword, @Param("tenantId") Long tenantId);
    int updateLoginTime(@Param("id") Long id);
}
