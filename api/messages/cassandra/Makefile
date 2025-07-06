.PHONY: build up down logs shell test clean status cluster-status

PROJECT_NAME=chime
CONTAINER_NAME=chime-messages-cassandra-1

# Build the custom Cassandra image
build:
	docker-compose build --no-cache

# Start Cassandra cluster with schema
up:
	docker-compose -p $(PROJECT_NAME) up -d
	@echo "Waiting for Cassandra to be ready..."
	@echo "This may take 2-3 minutes for initialization..."
	@until docker exec $(CONTAINER_NAME) cqlsh -e "describe keyspaces" > /dev/null 2>&1; do \
		echo "Cassandra not ready yet, waiting..."; \
		sleep 15; \
	done
	@echo "Cassandra is ready!"

# Stop containers
down:
	docker-compose -p $(PROJECT_NAME) down

# View logs for all nodes
logs:
	docker-compose -p $(PROJECT_NAME) logs -f

# View logs for cassandra
logs-cassandra:
	docker-compose -p $(PROJECT_NAME) logs -f cassandra-1

# Connect to Cassandra shell
shell:
	docker exec -it $(CONTAINER_NAME) cqlsh

# Test connection and show schema
test:
	docker exec -it $(CONTAINER_NAME) cqlsh -e "USE chime; DESCRIBE TABLES; SELECT * FROM messages LIMIT 5;"

# Check cluster status
cluster-status:
	docker exec -it $(CONTAINER_NAME) nodetool status

# Clean up everything including volumes
clean:
	docker-compose -p $(PROJECT_NAME) down -v
	docker rmi $$(docker images -q -f reference="*chime*") 2>/dev/null || true
	docker rmi $$(docker images -q -f reference="*cassandra*") 2>/dev/null || true

# Show status
status:
	docker-compose -p $(PROJECT_NAME) ps
