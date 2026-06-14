package com.autotest.mapper;

import com.autotest.model.entity.ChainVersion;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ChainVersionMapper {
    int insert(ChainVersion version);
    int update(ChainVersion version);
    ChainVersion selectByChainCodeAndVersion(@Param("chainCode") String chainCode, @Param("version") Integer version);
    List<ChainVersion> selectByChainCode(@Param("chainCode") String chainCode);
    List<ChainVersion> selectRecentByChainCode(@Param("chainCode") String chainCode, @Param("limit") int limit);
    int getMaxVersion(@Param("chainCode") String chainCode);
    int countByChainCode(@Param("chainCode") String chainCode);
    int deleteByChainCodeAndVersion(@Param("chainCode") String chainCode, @Param("version") Integer version);
    int deleteByChainCodeBeforeVersion(@Param("chainCode") String chainCode, @Param("version") Integer version);
}
