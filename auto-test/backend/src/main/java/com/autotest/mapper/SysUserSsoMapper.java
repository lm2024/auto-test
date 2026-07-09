package com.autotest.mapper;

import com.autotest.model.entity.SysUserSso;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface SysUserSsoMapper {
    int insert(SysUserSso sso);
    SysUserSso selectBySubject(@Param("ssoProvider") String ssoProvider, @Param("ssoSubject") String ssoSubject);
    int deleteByUserId(@Param("userId") Long userId);
}
