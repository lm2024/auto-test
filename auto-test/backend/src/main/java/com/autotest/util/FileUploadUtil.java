package com.autotest.util;

import org.apache.http.entity.ContentType;
import org.apache.http.HttpEntity;
import org.apache.http.entity.mime.MultipartEntityBuilder;

import java.io.File;
import java.nio.file.Paths;

/**
 * 上传文件解析与 multipart 组装工具。
 *
 * 链路执行(ExecuteServiceImpl)与节点调试(NodeDebugServiceImpl)共用本工具，
 * 保证「正式执行」和「节点调试」发出的文件请求完全一致：
 * 均按 fileId 在 user.dir/uploads/ 下匹配文件，并以 multipart/form-data
 * 的 "file" 字段发送二进制内容。
 */
public class FileUploadUtil {

    private static final String UPLOAD_DIR = System.getProperty("user.dir") + "/uploads";

    /** 按 fileId 前缀在 uploads 目录匹配已上传文件；不存在返回 null */
    public static File findUploadedFile(String fileId) {
        if (fileId == null || fileId.isEmpty()) {
            return null;
        }
        File dir = Paths.get(UPLOAD_DIR).toFile();
        if (!dir.exists()) {
            return null;
        }
        File[] files = dir.listFiles((d, name) -> name.startsWith(fileId));
        return (files != null && files.length > 0) ? files[0] : null;
    }

    /**
     * 组装 multipart/form-data 文件请求体（字段名固定为 "file"）。
     * fileId 对应文件不存在时返回 null，由调用方决定降级行为。
     */
    public static HttpEntity buildFileMultipartEntity(String fileId) {
        File file = findUploadedFile(fileId);
        if (file == null || !file.exists()) {
            return null;
        }
        MultipartEntityBuilder builder = MultipartEntityBuilder.create();
        builder.addBinaryBody("file", file, ContentType.APPLICATION_OCTET_STREAM, file.getName());
        return builder.build();
    }
}
