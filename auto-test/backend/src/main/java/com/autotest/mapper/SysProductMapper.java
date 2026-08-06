package com.autotest.mapper;

import com.autotest.model.entity.SysProduct;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SysProductMapper {
    int insert(SysProduct product);
    int update(SysProduct product);
    int deleteById(@Param("id") Long id);
    SysProduct selectById(@Param("id") Long id);
    SysProduct selectByProductCode(@Param("productCode") String productCode);
    List<SysProduct> selectList(@Param("tenantId") Long tenantId,
                                @Param("productName") String productName,
                                @Param("status") Integer status,
                                @Param("offset") int offset,
                                @Param("pageSize") int pageSize);
    int countList(@Param("tenantId") Long tenantId,
                  @Param("productName") String productName,
                  @Param("status") Integer status);
}
