const session = require('express-session');

class MySQLSessionStore extends session.Store {
  constructor(pool, options = {}) {
    super();
    this.pool = pool;
    this.defaultTtlMs = Number(options.defaultTtlMs || 8 * 60 * 60 * 1000);
    this.pruneTimer = setInterval(() => {
      this.prune().catch((error) => console.error('Erro ao limpar sessoes:', error.message));
    }, 30 * 60 * 1000);
    this.pruneTimer.unref?.();
  }

  expiry(sessionData) {
    const expires = sessionData?.cookie?.expires;
    return expires ? new Date(expires) : new Date(Date.now() + this.defaultTtlMs);
  }

  async get(sid, callback) {
    try {
      const [rows] = await this.pool.query(
        'SELECT data, expires_at FROM sessoes_admin WHERE session_id = ? LIMIT 1',
        [sid]
      );
      if (!rows.length) return callback(null, null);
      if (new Date(rows[0].expires_at).getTime() <= Date.now()) {
        await this.destroyAsync(sid);
        return callback(null, null);
      }
      return callback(null, JSON.parse(rows[0].data));
    } catch (error) {
      return callback(error);
    }
  }

  async set(sid, sessionData, callback = () => {}) {
    try {
      const expiresAt = this.expiry(sessionData);
      const data = JSON.stringify(sessionData);
      await this.pool.query(
        `INSERT INTO sessoes_admin (session_id, expires_at, data)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE expires_at = ?, data = ?`,
        [sid, expiresAt, data, expiresAt, data]
      );
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async touch(sid, sessionData, callback = () => {}) {
    try {
      await this.pool.query(
        'UPDATE sessoes_admin SET expires_at = ? WHERE session_id = ?',
        [this.expiry(sessionData), sid]
      );
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async destroyAsync(sid) {
    await this.pool.query('DELETE FROM sessoes_admin WHERE session_id = ?', [sid]);
  }

  destroy(sid, callback = () => {}) {
    this.destroyAsync(sid).then(() => callback(null)).catch(callback);
  }

  async prune() {
    await this.pool.query('DELETE FROM sessoes_admin WHERE expires_at <= NOW()');
  }
}

module.exports = MySQLSessionStore;
