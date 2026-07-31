require('dotenv').config();
const { sql } = require('../server/repositories/DatabaseClient');

async function testFix() {
  const userId = 'QfFHObizucheVqFmJzOufoB6lKp1';
  
  const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
  console.log('User internal ID:', user[0].id);
  const internalId = user[0].id;

  const recentRooms = await sql`
      SELECT r.room_id, r.language, r.updated_at, r.code 
      FROM rooms r
      JOIN user_rooms ur ON r.id = ur.room_id
      WHERE ur.user_id = ${internalId}
      ORDER BY r.updated_at DESC
      LIMIT 10
  `;
  console.log('recentRooms:', recentRooms);

  const totalRooms = await sql`SELECT COUNT(*) FROM user_rooms WHERE user_id = ${internalId}`;
  console.log('totalRooms count:', totalRooms[0].count);

  const sessions = await sql`
      SELECT * FROM sessions WHERE user_id = ${internalId} ORDER BY last_active DESC
  `;
  console.log('sessions count:', sessions.length);
}

testFix().catch(console.error);
