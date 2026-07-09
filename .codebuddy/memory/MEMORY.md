# 长期记忆

## 项目技术栈

- **后端**: Java 8, Spring Boot 2.7.7, MyBatis 2.3.1, MySQL 8.0, Maven, LangChain4j 0.35.0
- **前端**: Vue 3.4, Vite 5, Element Plus 2.5, LogicFlow, Monaco Editor
- **数据库**: MySQL 8.0 (Docker), utf8mb4

## 后端私有化仓库

- `backend/local-repo/` 为工程内私有 Maven 仓库 (~103MB)，支持离线构建
- 离线构建命令: `mvn -o -Dmaven.repo.local=./local-repo clean package -DskipTests`
- 构建脚本: `backend/build-offline.bat` (Windows) / `build-offline.sh` (Linux/Mac)
- 参考: easy-ops 工程的 local-repo 方案
