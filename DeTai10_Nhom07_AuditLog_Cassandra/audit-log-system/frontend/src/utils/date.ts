// Match the UTC partition dates used by the existing Cassandra API.
export const auditDate = () => new Date().toISOString().slice(0, 10);
