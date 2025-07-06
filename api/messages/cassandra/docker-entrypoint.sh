#!/bin/bash
set -e

# Check if this is the primary node using NODE_TYPE environment variable
echo "Container hostname: $HOSTNAME"
echo "Node type: ${NODE_TYPE:-unknown}"

# Function to wait for primary node to be ready
wait_for_primary() {
    echo "Secondary node waiting for primary node (cassandra-1) to be ready..."
    max_attempts=60
    attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if cqlsh cassandra-1 -e "describe keyspaces" > /dev/null 2>&1; then
            echo "Primary node is ready!"
            return 0
        fi
        echo "Primary node not ready yet, waiting... (attempt $((attempt + 1))/$max_attempts)"
        sleep 10
        attempt=$((attempt + 1))
    done

    echo "WARNING: Primary node not ready after $max_attempts attempts, continuing anyway..."
    return 1
}

if [ "${NODE_TYPE}" = "primary" ]; then
    echo "Primary node detected, starting Cassandra and running initialization scripts..."

    # Start Cassandra in the background
    echo "Starting Cassandra..."
    /usr/local/bin/docker-entrypoint.sh cassandra -f &
    CASSANDRA_PID=$!

    # Wait for Cassandra to be ready
    echo "Waiting for Cassandra to start..."
    max_attempts=60
    attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if cqlsh -e "describe keyspaces" > /dev/null 2>&1; then
            echo "Cassandra is ready!"
            break
        fi
        echo "Cassandra not ready yet, waiting... (attempt $((attempt + 1))/$max_attempts)"
        sleep 10
        attempt=$((attempt + 1))
    done

    if [ $attempt -eq $max_attempts ]; then
        echo "ERROR: Cassandra failed to start after $max_attempts attempts"
        exit 1
    fi

    # Wait a bit more for cluster formation
    sleep 30

    echo "Running initialization scripts..."
    for file in /opt/cassandra-init/*.cql; do
        if [ -f "$file" ]; then
            echo "Executing $file..."
            if ! cqlsh -f "$file"; then
                echo "Warning: Failed to execute $file"
            fi
        fi
    done
    echo "Schema initialization complete!"

    # Wait for Cassandra process
    wait $CASSANDRA_PID

else
    echo "Secondary node (hostname: $HOSTNAME), waiting for primary then starting Cassandra..."

    # Wait for primary node to be ready
    wait_for_primary

    # Start Cassandra normally in foreground
    echo "Starting Cassandra on secondary node..."
    exec /usr/local/bin/docker-entrypoint.sh cassandra -f
fi

echo "Cassandra cluster node is ready and running"
echo "Waiting for Cassandra process to continue running..."

# Keep container alive - wait for Cassandra process
wait $CASSANDRA_PID
echo "Cassandra process has exited"
