package com.autotest.controller;

import com.autotest.model.vo.Result;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

@RestController
@RequestMapping("/api/upload")
public class UploadController {

    private static final String UPLOAD_DIR = System.getProperty("user.dir") + "/uploads";

    @PostMapping("/file")
    public Result<?> uploadFile(@RequestParam("file") MultipartFile file,
                                 @RequestParam(value = "nodeCode", required = false) String nodeCode) {
        if (file.isEmpty()) {
            return Result.error("文件不能为空");
        }

        String originalName = file.getOriginalFilename();
        String ext = "";
        if (originalName != null && originalName.contains(".")) {
            ext = originalName.substring(originalName.lastIndexOf("."));
        }

        String fileId = "FILE_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
        String savedName = fileId + ext;

        try {
            Path dirPath = Paths.get(UPLOAD_DIR);
            if (!Files.exists(dirPath)) {
                Files.createDirectories(dirPath);
            }

            Path filePath = dirPath.resolve(savedName);
            Files.copy(file.getInputStream(), filePath);

            Map<String, Object> data = new HashMap<>();
            data.put("fileId", fileId);
            data.put("fileName", originalName);
            data.put("savedName", savedName);
            data.put("size", file.getSize());
            data.put("contentType", file.getContentType());
            data.put("filePath", filePath.toAbsolutePath().toString());
            return Result.success(data);
        } catch (IOException e) {
            return Result.error("文件上传失败: " + e.getMessage());
        }
    }

    @GetMapping("/file")
    public Result<?> getFile(@RequestParam String fileId) {
        try {
            Path dirPath = Paths.get(UPLOAD_DIR);
            File dir = dirPath.toFile();
            if (!dir.exists()) {
                return Result.error("文件不存在");
            }

            File[] files = dir.listFiles((d, name) -> name.startsWith(fileId));
            if (files == null || files.length == 0) {
                return Result.error("文件不存在");
            }

            File file = files[0];
            Map<String, Object> data = new HashMap<>();
            data.put("fileId", fileId);
            data.put("fileName", file.getName());
            data.put("size", file.length());
            data.put("filePath", file.getAbsolutePath());
            return Result.success(data);
        } catch (Exception e) {
            return Result.error("获取文件失败: " + e.getMessage());
        }
    }

    @DeleteMapping("/file")
    public Result<?> deleteFile(@RequestParam String fileId) {
        try {
            Path dirPath = Paths.get(UPLOAD_DIR);
            File dir = dirPath.toFile();
            if (!dir.exists()) {
                return Result.success();
            }

            File[] files = dir.listFiles((d, name) -> name.startsWith(fileId));
            if (files != null) {
                for (File file : files) {
                    file.delete();
                }
            }
            return Result.success();
        } catch (Exception e) {
            return Result.error("删除文件失败: " + e.getMessage());
        }
    }
}
