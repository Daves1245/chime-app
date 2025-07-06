FROM cassandra:latest

# Copy schema files
COPY init-scripts/ /opt/cassandra-init/

# Create a custom entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose the default Cassandra ports
EXPOSE 9042 9160

# Use our custom entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
