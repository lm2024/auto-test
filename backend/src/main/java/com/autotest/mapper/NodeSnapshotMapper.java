package com.autotest.mapper;

import com.autotest.model.entity.NodeSnapshot;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface NodeSnapshotMapper {
    int batchInsert(@Param("list") List<NodeSnapshot> list);
    List<NodeSnapshot> selectByVersionId(@Param("versionId") Long versionId);
    int deleteByVersionId(@Param("versionId") Long versionId);
}
