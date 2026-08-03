@echo off
set JAVA_HOME=C:\Program Files\Java\jdk1.8.0_202
set PATH=%JAVA_HOME%\bin;%PATH%
cd /d "C:\Users\Li\Downloads\GitHub\auto-test\auto-test\backend"
"C:\Users\Li\Downloads\apps\open-source\maven\apache-maven-3.9.16-bin\apache-maven-3.9.16\bin\mvn.cmd" -o spring-boot:run
