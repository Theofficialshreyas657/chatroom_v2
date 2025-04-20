const mysql = require('mysql2');

// Create connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root', // Change this to your MySQL password
  database: 'simple_chat',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initial database setup
const setupDatabase = async () => {
  try {
    // Create database if not exists
    await pool.promise().query(`CREATE DATABASE IF NOT EXISTS simple_chat`);
    
    // Use the database
    await pool.promise().query(`USE simple_chat`);
    
    // Create users table
    await pool.promise().query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create messages table
    await pool.promise().query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    console.log('Database setup completed');
  } catch (error) {
    console.error('Database setup error:', error);
  }
};
// In db.js - Add a test connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
    connection.release();
  }
});
// Run setup
setupDatabase();

// Export pool with promise support
module.exports = pool.promise();