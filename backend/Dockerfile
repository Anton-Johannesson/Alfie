FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
COPY src ./src
RUN mvn -B package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/target/alfie-backend-0.1.0-SNAPSHOT.jar /app/alfie-backend.jar
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "/app/alfie-backend.jar"]
