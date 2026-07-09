package com.autotest.mapper;

import com.autotest.model.entity.TestChain;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface TestChainMapper {
    int insert(TestChain chain);
    int update(TestChain chain);
    int deleteByChainCode(@Param("chainCode") String chainCode);
    TestChain selectByChainCode(@Param("chainCode") String chainCode);
    List<TestChain> selectList(@Param("chainName") String chainName, @Param("executeMode") Integer executeMode);
    List<TestChain> selectListByCategory(@Param("chainName") String chainName,
                                         @Param("executeMode") Integer executeMode,
                                         @Param("systemCategories") List<String> systemCategories,
                                         @Param("funcCategories") List<String> funcCategories,
                                         @Param("priority") Integer priority,
                                         @Param("categoryIds") List<Long> categoryIds,
                                         @Param("offset") int offset,
                                         @Param("pageSize") int pageSize);
    int countByCategory(@Param("chainName") String chainName,
                        @Param("executeMode") Integer executeMode,
                        @Param("systemCategories") List<String> systemCategories,
                        @Param("funcCategories") List<String> funcCategories,
                        @Param("priority") Integer priority,
                        @Param("categoryIds") List<Long> categoryIds);
    int countByChainCode(@Param("chainCode") String chainCode);
    int countByChainName(@Param("chainName") String chainName);
}
