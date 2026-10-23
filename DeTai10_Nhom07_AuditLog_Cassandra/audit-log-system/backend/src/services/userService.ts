import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getCassandraClient } from '../config/cassandra.js';
import { auditLogService, AuditLogInput } from './auditLogService.js';

export type UserRole = 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  user_id: string;
  username: string;
  password_hash: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
}

export type SafeUser = Omit<User, 'password_hash'>;

class UserService {
  // In-memory store synchronized with Cassandra
  private users: Map<string, User> = new Map();
  private initialized = false;

  constructor() {
    this.seedDefaultUsers();
  }

  /**
   * Pre-seed standard demo accounts with bcrypt hash (cost 10)
   */
  private seedDefaultUsers(): void {
    const defaultUsers: Array<{
      username: string;
      pass: string;
      full_name: string;
      email: string;
      role: UserRole;
      status: UserStatus;
    }> = [
      {
        username: 'admin',
        pass: 'admin123',
        full_name: 'System Administrator',
        email: 'admin@auditlog.internal',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      {
        username: 'user',
        pass: 'user12345',
        full_name: 'Người dùng demo',
        email: 'user@auditlog.internal',
        role: 'USER',
        status: 'ACTIVE',
      },
    ];

    for (const u of defaultUsers) {
      const hash = bcrypt.hashSync(u.pass, 10);
      const user: User = {
        user_id: uuidv4(),
        username: u.username.toLowerCase(),
        password_hash: hash,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        status: u.status,
        created_at: new Date('2026-10-01T00:00:00.000Z'),
        updated_at: new Date('2026-10-01T00:00:00.000Z'),
      };
      this.users.set(user.username, user);
    }
  }

  /**
   * Sync table and demo accounts to Cassandra if online
   */
  async initDb(): Promise<void> {
    if (this.initialized) return;
    try {
      const client = getCassandraClient();
      // Ensure users table exists in Cassandra
      await client.execute(`
        CREATE TABLE IF NOT EXISTS audit_log_system.users (
          user_id uuid,
          username text,
          password_hash text,
          full_name text,
          email text,
          role text,
          status text,
          created_at timestamp,
          updated_at timestamp,
          PRIMARY KEY (username)
        ) WITH comment = 'Application user accounts with bcrypt hashed passwords and RBAC roles';
      `);

      await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_users_id ON audit_log_system.users (user_id);
      `);

      // Read existing users from Cassandra
      const res = await client.execute('SELECT * FROM audit_log_system.users');
      if (res.rows.length > 0) {
        // Existing database accounts are authoritative; do not retain unpersisted demo accounts.
        this.users.clear();
        for (const row of res.rows) {
          const user: User = {
            user_id: row.user_id ? row.user_id.toString() : uuidv4(),
            username: row.username,
            password_hash: row.password_hash,
            full_name: row.full_name || row.username,
            email: row.email || `${row.username}@auditlog.internal`,
            role: row.role === 'ADMIN' ? 'ADMIN' : 'USER',
            status: (row.status as UserStatus) || 'ACTIVE',
            created_at: row.created_at || new Date(),
            updated_at: row.updated_at || new Date(),
          };
          this.users.set(user.username, user);
        }
      } else {
        // Persist default demo users to Cassandra
        for (const user of this.users.values()) {
          await this.persistToCassandra(user);
        }
      }
      this.initialized = true;
    } catch (error) {
      this.initialized = false;
      throw error;
    }
  }

  private async persistToCassandra(user: User, audit?: AuditLogInput): Promise<void> {
    try {
      const client = getCassandraClient();
      const query = `
        INSERT INTO audit_log_system.users (
          user_id, username, password_hash, full_name, email, role, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [user.user_id, user.username, user.password_hash, user.full_name,
        user.email, user.role, user.status, user.created_at, user.updated_at];
      if (audit) {
        await auditLogService.createLog({ ...audit, details: {
          ...audit.details, target_user_id: user.user_id, target_username: user.username,
        } }, [{ query, params }]);
      } else {
        await client.execute(query, params, { prepare: true });
      }
    } catch (error) {
      throw error;
    }
  }

  private async deleteFromCassandra(username: string, audit?: AuditLogInput): Promise<void> {
    try {
      const client = getCassandraClient();
      const query = 'DELETE FROM audit_log_system.users WHERE username = ?';
      if (audit) await auditLogService.createLog(audit, [{ query, params: [username] }]);
      else await client.execute(query, [username], { prepare: true });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    await this.initDb();
    const cleanUsername = username.trim().toLowerCase();
    // Authentication and role checks always read the current persisted account.
    // A cached demo account must never make login succeed while Cassandra is down.

    try {
      const client = getCassandraClient();
      const res = await client.execute('SELECT * FROM audit_log_system.users WHERE username = ?', [cleanUsername], {
        prepare: true,
      });
      const row = res.first();
      if (!row) return null;

      const user: User = {
        user_id: row.user_id.toString(),
        username: row.username,
        password_hash: row.password_hash,
        full_name: row.full_name,
        email: row.email,
        role: row.role === 'ADMIN' ? 'ADMIN' : 'USER',
        status: row.status as UserStatus,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
      this.users.set(user.username, user);
      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findById(userId: string): Promise<User | null> {
    await this.initDb();
    for (const u of this.users.values()) {
      if (u.user_id === userId) return u;
    }
    return null;
  }

  /**
   * Get all users (Safe version without password hash)
   */
  async getAllUsers(): Promise<SafeUser[]> {
    await this.initDb();
    return Array.from(this.users.values()).map(this.toSafeUser);
  }

  /**
   * Register or Create a new user
   */
  async createUser(data: {
    username: string;
    password: string;
    full_name: string;
    email: string;
    role?: UserRole;
    status?: UserStatus;
  }, audit?: AuditLogInput): Promise<SafeUser> {
    await this.initDb();
    const cleanUsername = data.username.trim().toLowerCase();

    if (this.users.has(cleanUsername)) {
      throw new Error(`Username '${cleanUsername}' already exists`);
    }

    if (!data.password || data.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(data.password, salt);

    const newUser: User = {
      user_id: uuidv4(),
      username: cleanUsername,
      password_hash,
      full_name: data.full_name?.trim() || cleanUsername,
      email: data.email?.trim().toLowerCase() || `${cleanUsername}@auditlog.internal`,
      role: data.role || 'USER',
      status: data.status || 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
    };

    await this.persistToCassandra(newUser, audit);
    this.users.set(cleanUsername, newUser);

    return this.toSafeUser(newUser);
  }

  /**
   * Count how many active ADMIN accounts exist
   */
  async countActiveAdmins(): Promise<number> {
    await this.initDb();
    let count = 0;
    for (const u of this.users.values()) {
      if (u.role === 'ADMIN' && u.status === 'ACTIVE') {
        count++;
      }
    }
    return count;
  }

  /**
   * Update user details (Full Name, Email)
   */
  async updateUser(
    userId: string,
    data: { full_name?: string; email?: string },
    audit?: AuditLogInput
  ): Promise<SafeUser> {
    const storedUser = await this.findById(userId);
    if (!storedUser) throw new Error('User not found');
    const user = { ...storedUser };

    if (data.full_name !== undefined) user.full_name = data.full_name.trim();
    if (data.email !== undefined) user.email = data.email.trim().toLowerCase();
    user.updated_at = new Date();

    await this.persistToCassandra(user, audit);
    this.users.set(user.username, user);

    return this.toSafeUser(user);
  }

  /**
   * Change user role (ADMIN only)
   */
  async changeRole(userId: string, newRole: UserRole, audit?: AuditLogInput): Promise<SafeUser> {
    const storedUser = await this.findById(userId);
    if (!storedUser) throw new Error('User not found');
    const user = { ...storedUser };

    // Protect the last active administrator from being demoted
    if (user.role === 'ADMIN' && newRole !== 'ADMIN') {
      const activeAdmins = await this.countActiveAdmins();
      if (activeAdmins <= 1 && user.status === 'ACTIVE') {
        throw new Error('Cannot demote the last active administrator in the system');
      }
    }

    user.role = newRole;
    user.updated_at = new Date();

    await this.persistToCassandra(user, audit);
    this.users.set(user.username, user);

    return this.toSafeUser(user);
  }

  /**
   * Change user status (ACTIVE / INACTIVE)
   */
  async changeStatus(userId: string, newStatus: UserStatus, audit?: AuditLogInput): Promise<SafeUser> {
    const storedUser = await this.findById(userId);
    if (!storedUser) throw new Error('User not found');
    const user = { ...storedUser };

    // Protect the last active administrator from being deactivated
    if (user.role === 'ADMIN' && user.status === 'ACTIVE' && newStatus === 'INACTIVE') {
      const activeAdmins = await this.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new Error('Cannot disable the last active administrator in the system');
      }
    }

    user.status = newStatus;
    user.updated_at = new Date();

    await this.persistToCassandra(user, audit);
    this.users.set(user.username, user);

    return this.toSafeUser(user);
  }

  /**
   * Change password
   */
  async changePassword(userId: string, oldPass: string, newPass: string, audit?: AuditLogInput): Promise<boolean> {
    const storedUser = await this.findById(userId);
    if (!storedUser) throw new Error('User not found');
    const user = { ...storedUser };

    const isMatch = bcrypt.compareSync(oldPass, user.password_hash);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    if (oldPass === newPass) {
      throw new Error('New password must be different from current password');
    }

    if (!newPass || newPass.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    user.password_hash = bcrypt.hashSync(newPass, 10);
    user.updated_at = new Date();

    await this.persistToCassandra(user, audit);
    this.users.set(user.username, user);

    return true;
  }

  /**
   * Delete a user
   */
  async deleteUser(userId: string, audit?: AuditLogInput): Promise<{ username: string }> {
    const storedUser = await this.findById(userId);
    if (!storedUser) throw new Error('User not found');
    const user = { ...storedUser };

    // Protect the last active administrator from deletion
    if (user.role === 'ADMIN' && user.status === 'ACTIVE') {
      const activeAdmins = await this.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new Error('Cannot delete the last active administrator in the system');
      }
    }

    await this.deleteFromCassandra(user.username, audit);
    this.users.delete(user.username);

    return { username: user.username };
  }

  /**
   * Remove sensitive password_hash from response
   */
  toSafeUser(user: User): SafeUser {
    const { password_hash, ...safe } = user;
    return safe;
  }
}

export const userService = new UserService();
